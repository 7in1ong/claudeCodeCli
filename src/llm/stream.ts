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

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < DEFAULT_MAX_RETRIES; attempt++) {
    try {
      const result = await executeStream(client, model, params, callbacks);
      return result;
    } catch (error: unknown) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (isTransientError(error) && attempt < DEFAULT_MAX_RETRIES - 1) {
        const delay = calculateRetryDelay(attempt, error);
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
  callbacks?: StreamCallbacks,
): Promise<StreamResult> {
  const contentBlocks: AccumulatingBlock[] = [];
  const toolUses: ToolUseBlock[] = [];
  const messageRef: { current: Message | null } = { current: null };

  const stream = await client.messages.create({
    model,
    max_tokens: params.maxTokens ?? DEFAULT_MAX_TOKENS,
    stream: true,
    messages: params.messages,
    ...(params.systemPrompt ? { system: params.systemPrompt } : {}),
    ...(params.tools?.length ? { tools: params.tools } : {}),
  });

  for await (const event of stream as AsyncIterable<RawMessageStreamEvent>) {
    processEvent(event, contentBlocks, callbacks, toolUses, messageRef);
  }

  if (!messageRef.current) {
    throw new Error("No message received from API");
  }

  const msg: Message = messageRef.current;

  // Build the final content from accumulated blocks
  const finalContent: Message["content"] = contentBlocks.map((block) => {
    if (block.type === "tool_use") {
      let input: Record<string, unknown> = {};
      if (block.inputJson) {
        try {
          input = JSON.parse(block.inputJson) as Record<string, unknown>;
        } catch {
          // Malformed JSON — fall back to empty object
        }
      }
      return {
        type: "tool_use" as const,
        id: block.id ?? "",
        name: block.name ?? "",
        input,
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
  toolUses: ToolUseBlock[],
  messageRef: { current: Message | null },
): void {
  switch (event.type) {
    case "message_start": {
      messageRef.current = event.message;
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
        let input: Record<string, unknown> = {};
        if (block.inputJson) {
          try {
            input = JSON.parse(block.inputJson) as Record<string, unknown>;
          } catch {
            // Malformed JSON — fall back to empty object
          }
        }
        const toolUse: ToolUseBlock = {
          type: "tool_use",
          id: block.id ?? "",
          name: block.name ?? "",
          input,
        };
        toolUses.push(toolUse);
        callbacks?.onToolUseComplete?.(toolUse);
      }
      break;
    }

    case "message_delta": {
      // Merge output token usage from the delta event into the accumulated message.
      // The message_start event provides input_tokens; message_delta provides output_tokens.
      if (messageRef.current) {
        messageRef.current.usage = {
          ...messageRef.current.usage,
          ...event.usage,
        };
        messageRef.current.stop_reason = event.delta.stop_reason;
        messageRef.current.stop_sequence = event.delta.stop_sequence;
      }
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

/**
 * Calculate retry delay with exponential backoff, jitter, and Retry-After support.
 *
 * For 429 errors, prefers the Retry-After header if present.
 * Otherwise uses exponential backoff with random jitter to avoid thundering herd.
 */
function calculateRetryDelay(attempt: number, error: unknown): number {
  // Check for Retry-After header on 429 errors
  const status = (error as { status?: number }).status;
  if (status === 429) {
    const headers = (error as { headers?: Record<string, string> }).headers;
    const retryAfter = headers?.["retry-after"];
    if (retryAfter) {
      const seconds = parseInt(retryAfter, 10);
      if (!isNaN(seconds) && seconds > 0) {
        return seconds * 1000;
      }
    }
  }

  // Exponential backoff with jitter
  const baseDelay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
  const jitter = 0.5 + Math.random(); // Random factor between 0.5 and 1.5
  return Math.floor(baseDelay * jitter);
}
