/**
 * Streaming Message Handler
 *
 * Processes streaming responses from the Anthropic API, handling text deltas,
 * tool_use blocks, and error recovery with automatic retries.
 */

import type {
  Message,
  RawMessageStreamEvent,
  SendMessageParams,
  StreamCallbacks,
  StreamResult,
  ToolUseBlock,
} from "./types.js";
import { DEFAULT_MAX_TOKENS } from "./types.js";
import { getClient, getModel } from "./client.js";
import { sleep } from "../utils/index.js";

/** Default number of retry attempts for transient API errors. */
const DEFAULT_MAX_RETRIES = 3;

/** Base delay (ms) for exponential backoff between retries. */
const RETRY_BASE_DELAY_MS = 1000;

/**
 * Tracks a content block being accumulated during streaming.
 */
interface AccumulatingBlock {
  type: "text" | "tool_use";
  text?: string;
  id?: string;
  name?: string;
  inputJson?: string;
}

/**
 * Send a message to the LLM and process the streaming response.
 *
 * Iterates over raw SSE events from the API, accumulates the final message,
 * and invokes the provided callbacks for text deltas, tool-use blocks, etc.
 * Automatically retries on transient errors (rate limits, server errors).
 *
 * @param params    - Message parameters (messages, tools, system prompt, etc.).
 * @param callbacks - Optional callbacks invoked during streaming.
 * @returns The complete message along with extracted tool_use blocks.
 */
export async function streamMessage(
  params: SendMessageParams,
  callbacks?: StreamCallbacks,
): Promise<StreamResult> {
  const client = getClient();
  const model = getModel();

  const toolUses: ToolUseBlock[] = [];
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < DEFAULT_MAX_RETRIES; attempt++) {
    try {
      const result = await executeStream(client, model, params, toolUses, callbacks);
      return result;
    } catch (error: unknown) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (isTransientError(error) && attempt < DEFAULT_MAX_RETRIES - 1) {
        const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
        await sleep(delay);
        continue;
      }

      callbacks?.onError?.(lastError);
      throw lastError;
    }
  }

  // Exhausted all retries
  const finalError = lastError ?? new Error("Unknown streaming error");
  callbacks?.onError?.(finalError);
  throw finalError;
}

/**
 * Execute a single streaming request and process all events.
 */
async function executeStream(
  client: ReturnType<typeof getClient>,
  model: string,
  params: SendMessageParams,
  toolUses: ToolUseBlock[],
  callbacks?: StreamCallbacks,
): Promise<StreamResult> {
  const contentBlocks: AccumulatingBlock[] = [];
  let apiMessage: Message | null = null;

  const stream = await client.messages.create({
    model,
    max_tokens: params.maxTokens ?? DEFAULT_MAX_TOKENS,
    stream: true,
    messages: params.messages,
    ...(params.systemPrompt ? { system: params.systemPrompt } : {}),
    ...(params.tools?.length ? { tools: params.tools } : {}),
  });

  for await (const event of stream as AsyncIterable<RawMessageStreamEvent>) {
    processEvent(event, contentBlocks, callbacks, (msg) => {
      apiMessage = msg;
    }, toolUses);
  }

  if (!apiMessage) {
    throw new Error("No message received from API");
  }

  // Use a typed reference — TypeScript can't trace the closure-based assignment
  const msg: Message = apiMessage;

  // Build the final content from accumulated blocks
  const finalContent: Message["content"] = contentBlocks.map((block) => {
    if (block.type === "tool_use") {
      return {
        type: "tool_use" as const,
        id: block.id ?? "",
        name: block.name ?? "",
        input: block.inputJson ? JSON.parse(block.inputJson) : {},
      };
    }
    return {
      type: "text" as const,
      text: block.text ?? "",
      citations: null,
    };
  });

  const finalMessage: Message = {
    id: msg.id,
    model: msg.model,
    role: msg.role,
    type: msg.type,
    stop_reason: msg.stop_reason,
    stop_sequence: msg.stop_sequence,
    usage: msg.usage,
    content: finalContent,
  };

  callbacks?.onMessageComplete?.(finalMessage);

  return {
    message: finalMessage,
    toolUses: [...toolUses],
    hasToolUse: toolUses.length > 0,
  };
}

/**
 * Process a single streaming event and update accumulated state.
 */
function processEvent(
  event: RawMessageStreamEvent,
  contentBlocks: AccumulatingBlock[],
  callbacks: StreamCallbacks | undefined,
  setMessage: (msg: Message) => void,
  toolUses: ToolUseBlock[],
): void {
  switch (event.type) {
    case "message_start": {
      setMessage(event.message);
      break;
    }

    case "content_block_start": {
      const block = event.content_block;
      if (block.type === "text") {
        contentBlocks.push({ type: "text", text: "" });
      } else if (block.type === "tool_use") {
        contentBlocks.push({
          type: "tool_use",
          id: block.id,
          name: block.name,
          inputJson: "",
        });
        callbacks?.onToolUseStart?.({ id: block.id, name: block.name });
      }
      // ThinkingBlock / RedactedThinkingBlock are ignored for now
      break;
    }

    case "content_block_delta": {
      const delta = event.delta;
      const idx = event.index;

      if (delta.type === "text_delta") {
        if (contentBlocks[idx]?.type === "text") {
          contentBlocks[idx].text += delta.text;
        }
        callbacks?.onTextDelta?.(delta.text);
      } else if (delta.type === "input_json_delta") {
        if (contentBlocks[idx]?.type === "tool_use") {
          contentBlocks[idx].inputJson += delta.partial_json;
        }
      }
      // ThinkingDelta / SignatureDelta / CitationsDelta ignored
      break;
    }

    case "content_block_stop": {
      const idx = event.index;
      const block = contentBlocks[idx];
      if (block?.type === "tool_use") {
        const toolUse: ToolUseBlock = {
          type: "tool_use",
          id: block.id ?? "",
          name: block.name ?? "",
          input: block.inputJson ? JSON.parse(block.inputJson) : {},
        };
        toolUses.push(toolUse);
        callbacks?.onToolUseComplete?.(toolUse);
      }
      break;
    }

    case "message_delta": {
      // Stop reason and usage are updated on the message_stop event.
      // We track them but the final message object already carries the metadata
      // from the API — we just ensure our accumulated content is correct.
      break;
    }

    case "message_stop": {
      // Streaming complete — nothing extra to do
      break;
    }
  }
}

/**
 * Determine whether an error is transient and worth retrying.
 */
function isTransientError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;

  // HTTP status-based retry: 429 (rate limit) and 5xx (server errors)
  const status = (error as { status?: number }).status;
  if (status === 429 || (status !== undefined && status >= 500)) {
    return true;
  }

  // Network-level errors
  const message = (error as Error).message ?? "";
  return (
    message.includes("ECONNRESET") ||
    message.includes("ETIMEDOUT") ||
    message.includes("ECONNREFUSED") ||
    message.includes("socket hang up")
  );
}
