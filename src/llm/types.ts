/**
 * LLM Type Definitions
 *
 * Re-exports and wraps Anthropic SDK types, providing a stable interface
 * for message handling, tool definitions, and streaming events.
 */

import type Anthropic from "@anthropic-ai/sdk";

// Re-export core Anthropic types for use throughout the application
export type Message = Anthropic.Message;
export type MessageParam = Anthropic.MessageParam;
export type ContentBlock = Anthropic.ContentBlock;
export type TextBlock = Anthropic.TextBlock;
export type ToolUseBlock = Anthropic.ToolUseBlock;
export type ToolDefinition = Anthropic.Tool;
export type RawMessageStreamEvent = Anthropic.RawMessageStreamEvent;
export type Usage = Anthropic.Usage;

/**
 * Supported model identifiers.
 * Uses a string union with `string & {}` to allow both known models and custom model IDs.
 */
export type ModelId =
  | "claude-sonnet-4-20250514"
  | "claude-3-7-sonnet-latest"
  | "claude-3-7-sonnet-20250219"
  | "claude-3-5-haiku-latest"
  | "claude-3-5-sonnet-latest"
  | "claude-3-opus-latest"
  | (string & {});

/**
 * Default model to use when none is specified.
 */
export const DEFAULT_MODEL: ModelId = "claude-sonnet-4-20250514";

/**
 * Default maximum tokens for a response.
 */
export const DEFAULT_MAX_TOKENS = 4096;

/**
 * Configuration for creating the LLM client.
 */
export interface ClientConfig {
  /** Anthropic API key. Falls back to ANTHROPIC_API_KEY env var. */
  apiKey?: string;
  /** Model identifier to use. Defaults to DEFAULT_MODEL. */
  model?: ModelId;
  /** Base URL for the API (useful for proxies/testing). */
  baseUrl?: string;
}

/**
 * Parameters for sending a message to the LLM.
 */
export interface SendMessageParams {
  /** Conversation messages (input). */
  messages: MessageParam[];
  /** System prompt to guide the model's behavior. */
  systemPrompt?: string;
  /** Tool definitions available to the model. */
  tools?: ToolDefinition[];
  /** Maximum tokens in the response. Defaults to DEFAULT_MAX_TOKENS. */
  maxTokens?: number;
}

/**
 * Callbacks for handling streaming events.
 * All callbacks are optional — only the ones provided will be invoked.
 */
export interface StreamCallbacks {
  /** Called for each text delta (partial token) as it arrives. */
  onTextDelta?: (text: string) => void;
  /** Called when a tool_use content block starts streaming. */
  onToolUseStart?: (toolUse: { id: string; name: string }) => void;
  /** Called when a tool_use content block completes with its full input. */
  onToolUseComplete?: (toolUse: ToolUseBlock) => void;
  /** Called when the full message is received and streaming ends. */
  onMessageComplete?: (message: Message) => void;
  /** Called on any error during streaming. */
  onError?: (error: Error) => void;
}

/**
 * Result returned after a streaming request completes.
 */
export interface StreamResult {
  /** The complete message from the API. */
  message: Message;
  /** All tool_use blocks found in the message, for convenience. */
  toolUses: ToolUseBlock[];
  /** Whether the model wants to call tools (stop_reason === "tool_use"). */
  hasToolUse: boolean;
}
