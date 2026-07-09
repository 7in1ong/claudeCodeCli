/**
 * Command Context
 *
 * Defines the runtime context passed to every slash command.
 * Wraps the conversation manager, tool registry, renderer, and
 * configuration so commands have access to everything they need
 * without tight coupling to the CLI modules.
 */

import type { ConversationManager } from "../llm/conversation.js";
import type { ToolRegistry } from "../tools/registry.js";
import type { Renderer } from "../ui/renderer.js";

/**
 * Configuration snapshot for the CLI runtime.
 * Commands can read or mutate these values (e.g. /model, /theme, /config).
 */
export interface CommandConfig {
  /** Current model identifier. */
  model: string;
  /** Current theme name. */
  theme: string;
  /** Whether the LLM API is available (real or mock mode). */
  llmAvailable: boolean;
  /** Arbitrary key-value pairs for future configuration items. */
  [key: string]: unknown;
}

/**
 * Runtime context passed to every slash command's execute() method.
 *
 * Commands use this to interact with the conversation, inspect tools,
 * render output, and read/modify CLI configuration.
 */
export interface CommandContext {
  /** The active conversation manager (history, system prompt, tokens). */
  conversation: ConversationManager;
  /** The tool registry holding all tools available to the LLM. */
  toolRegistry: ToolRegistry;
  /** Renderer for all CLI output. */
  renderer: Renderer;
  /** Mutable runtime configuration. */
  config: CommandConfig;
  /** Signal the REPL loop to exit. Only used by the /exit command. */
  requestExit: () => void;
}
