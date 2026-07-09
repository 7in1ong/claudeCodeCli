/**
 * Default Configuration Constants
 *
 * Centralized defaults for the CLI application. Re-exports values
 * from other modules where appropriate and defines application-level
 * constants that were previously scattered across runner.ts.
 */

import { DEFAULT_MODEL, DEFAULT_MAX_TOKENS } from "../llm/types.js";

// Re-export LLM defaults so consumers can import from one place
export { DEFAULT_MODEL, DEFAULT_MAX_TOKENS };

/**
 * Maximum number of retries for transient API errors (429, 5xx).
 */
export const DEFAULT_MAX_RETRIES = 3;

/**
 * Default request timeout in milliseconds for API calls.
 */
export const DEFAULT_TIMEOUT_MS = 60_000;

/**
 * Maximum estimated tokens allowed in the conversation context window.
 * When exceeded, the oldest messages are dropped by ConversationManager.
 */
export const DEFAULT_MAX_CONTEXT_TOKENS = 100_000;

/**
 * Default system prompt sent with every conversation.
 */
export const DEFAULT_SYSTEM_PROMPT = [
  "You are Claude Code, an interactive CLI assistant powered by Anthropic Claude.",
  "You help users with programming tasks: writing, reviewing, debugging, and",
  "refactoring code. You can read/write files, execute shell commands, and list",
  "directory contents using the available tools.",
  "",
  "Be concise, accurate, and practical. Prefer working code over explanations.",
  "When using tools, explain what you're doing briefly.",
].join(" ");

/**
 * CLI version string, displayed in the banner and help output.
 */
export const CLI_VERSION = "0.1.0";
