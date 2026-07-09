/**
 * Conversation Manager
 *
 * Maintains multi-turn conversation context for the Anthropic Messages API.
 * Tracks message history, estimates token usage, and truncates old messages
 * when the context window is exceeded.
 */

import type {
  ContentBlockParam,
  MessageParam,
  ToolResultBlockParam,
  ToolUseBlockParam,
} from "@anthropic-ai/sdk/resources/messages/messages.js";

/**
 * Options for constructing a ConversationManager.
 */
export interface ConversationOptions {
  /** System prompt sent alongside the message history. */
  systemPrompt?: string;
  /**
   * Maximum number of tokens allowed in the conversation context.
   * When exceeded, the oldest messages are dropped.
   * Defaults to 100_000 (a conservative default for most Claude models).
   */
  maxContextTokens?: number;
}

/**
 * Snapshot of the current conversation state, useful for display
 * or serialization by the CLI layer.
 */
export interface ConversationState {
  messageCount: number;
  turnCount: number;
  estimatedTokens: number;
  maxContextTokens: number;
  systemPrompt: string;
}

/**
 * Rough token estimator: ~4 characters per token for English text.
 * This is intentionally simple — an exact tokenizer is not bundled.
 */
const CHARS_PER_TOKEN = 4;

function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * Estimate tokens for a content block array by summing the text content
 * of each block. Non-text blocks (tool_use, tool_result) contribute a
 * small fixed overhead to approximate their serialized form.
 */
function estimateContentTokens(content: string | ContentBlockParam[]): number {
  if (typeof content === "string") {
    return estimateTokens(content);
  }
  let total = 0;
  for (const block of content) {
    if ("text" in block && typeof block.text === "string") {
      total += estimateTokens(block.text);
    } else if (block.type === "tool_use") {
      // tool_use blocks carry name + serialized input
      const toolBlock = block as ToolUseBlockParam;
      total += estimateTokens(toolBlock.name) + estimateTokens(JSON.stringify(toolBlock.input));
    } else if (block.type === "tool_result") {
      const resultBlock = block as ToolResultBlockParam;
      if (typeof resultBlock.content === "string") {
        total += estimateTokens(resultBlock.content);
      } else if (Array.isArray(resultBlock.content)) {
        for (const sub of resultBlock.content) {
          if ("text" in sub && typeof sub.text === "string") {
            total += estimateTokens(sub.text);
          }
        }
      }
    }
    // Add a small overhead per block for type/structure tokens
    total += 4;
  }
  return total;
}

/**
 * ConversationManager
 *
 * Owns the message history that is sent to the Anthropic Messages API on
 * each turn. Responsibilities:
 *   - Append user messages, assistant replies, and tool results
 *   - Track an estimated token count for the conversation
 *   - Truncate the oldest exchanges when the context window is exceeded
 *   - Reset the conversation (supports the `/clear` command)
 */
export class ConversationManager {
  private messages: MessageParam[] = [];
  private systemPrompt: string;
  private maxContextTokens: number;
  private tokenCount = 0;
  private turnCount = 0;

  constructor(options: ConversationOptions = {}) {
    this.systemPrompt = options.systemPrompt ?? "";
    this.maxContextTokens = options.maxContextTokens ?? 100_000;
  }

  // ---------------------------------------------------------------------------
  // Message mutators
  // ---------------------------------------------------------------------------

  /**
   * Append a user message to the conversation.
   * Increments the turn count (one user message = one turn).
   */
  addUserMessage(content: string): void {
    this.messages.push({ role: "user", content });
    this.tokenCount += estimateTokens(content);
    this.turnCount++;
  }

  /**
   * Append an assistant reply. `content` may be a plain string (single text
   * block) or an array of content blocks (text + tool_use, etc.) as returned
   * by the Anthropic API.
   */
  addAssistantMessage(content: string | ContentBlockParam[]): void {
    this.messages.push({ role: "assistant", content });
    this.tokenCount += estimateContentTokens(content);
  }

  /**
   * Append a tool result as a user-role message, which is the shape the
   * Anthropic API requires for tool_result blocks.
   *
   * Multiple tool results for a single assistant turn should each be added
   * via this method — they will be merged into a single user message when
   * consecutive tool_result messages are detected.
   */
  addToolResult(toolUseId: string, result: string, isError = false): void {
    const toolResult: ToolResultBlockParam = {
      type: "tool_result",
      tool_use_id: toolUseId,
      content: result,
      is_error: isError,
    };

    // Merge consecutive tool results into a single user message so the
    // API receives them in the expected format (one user message with
    // multiple tool_result blocks).
    const last = this.messages[this.messages.length - 1];
    if (
      last &&
      last.role === "user" &&
      Array.isArray(last.content) &&
      last.content.every((b) => b.type === "tool_result")
    ) {
      last.content.push(toolResult);
    } else {
      this.messages.push({ role: "user", content: [toolResult] });
    }
    this.tokenCount += estimateTokens(result) + 4;
  }

  // ---------------------------------------------------------------------------
  // Read accessors
  // ---------------------------------------------------------------------------

  /**
   * Return the current message history in the shape expected by
   * `client.messages.create({ messages, ... })`.
   */
  getMessages(): readonly MessageParam[] {
    return this.messages;
  }

  /** Return the current system prompt. */
  getSystemPrompt(): string {
    return this.systemPrompt;
  }

  /** Set or replace the system prompt. */
  setSystemPrompt(prompt: string): void {
    this.systemPrompt = prompt;
  }

  /** Estimated token count for the current message history. */
  getTokenCount(): number {
    return this.tokenCount;
  }

  /** Number of user→assistant exchanges started so far. */
  getTurnCount(): number {
    return this.turnCount;
  }

  /** Number of messages currently in the history. */
  getMessageCount(): number {
    return this.messages.length;
  }

  /** Whether the estimated token count exceeds the configured limit. */
  needsTruncation(): boolean {
    return this.tokenCount > this.maxContextTokens;
  }

  /** Snapshot of the conversation state for display or serialization. */
  getState(): ConversationState {
    return {
      messageCount: this.messages.length,
      turnCount: this.turnCount,
      estimatedTokens: this.tokenCount,
      maxContextTokens: this.maxContextTokens,
      systemPrompt: this.systemPrompt,
    };
  }

  // ---------------------------------------------------------------------------
  // Context window management
  // ---------------------------------------------------------------------------

  /**
   * Drop the oldest messages until the estimated token count is within
   * the configured limit. Messages are removed in pairs (user + assistant)
   * so the role alternation invariant is preserved. The most recent
   * exchange is always kept.
   *
   * Returns the number of messages removed.
   */
  truncate(): number {
    let removed = 0;

    while (this.messages.length > 2 && this.tokenCount > this.maxContextTokens) {
      const dropped = this.messages.shift();
      if (!dropped) break;
      this.tokenCount -= estimateContentTokens(dropped.content);
      removed++;

      // If the dropped message was a user turn, also drop the matching
      // assistant reply to keep the role sequence valid.
      if (dropped.role === "user") {
        const next = this.messages[0];
        if (next && next.role === "assistant") {
          this.tokenCount -= estimateContentTokens(next.content);
          this.messages.shift();
          removed++;
        }
      }
    }

    return removed;
  }

  // ---------------------------------------------------------------------------
  // Reset (supports /clear)
  // ---------------------------------------------------------------------------

  /**
   * Reset the conversation, clearing all message history and counters.
   * The system prompt is preserved unless explicitly cleared via
   * `setSystemPrompt("")`.
   *
   * This is the handler backing the `/clear` command.
   */
  reset(): void {
    this.messages = [];
    this.tokenCount = 0;
    this.turnCount = 0;
  }
}
