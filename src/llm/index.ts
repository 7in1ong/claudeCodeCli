/**
 * LLM Module
 *
 * Exports for LLM client, streaming handler, and type definitions.
 */

// Client
export { getClient, getModel, resetClient } from "./client.js";

// Streaming
export { streamMessage } from "./stream.js";

// Types
export type {
  ClientConfig,
  Message,
  MessageParam,
  ContentBlock,
  TextBlock,
  ToolUseBlock,
  ToolDefinition,
  RawMessageStreamEvent,
  Usage,
  ModelId,
  SendMessageParams,
  StreamCallbacks,
  StreamResult,
} from "./types.js";

export { DEFAULT_MODEL, DEFAULT_MAX_TOKENS } from "./types.js";
export { ConversationManager } from "./conversation.js";
export type { ConversationOptions, ConversationState } from "./conversation.js";
