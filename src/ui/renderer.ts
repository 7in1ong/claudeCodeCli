/**
 * Renderer Interface
 *
 * Defines the contract for all CLI output rendering. Implementations
 * control how messages, tool activity, errors, and system information
 * are displayed to the user.
 *
 * This abstraction allows swapping the plain console renderer for a
 * rich TUI renderer (e.g. blessed/ink) without changing the business
 * logic in the CLI modules.
 *
 * ## Optional TUI methods
 *
 * The interface includes optional methods that TUI renderers can implement
 * to replace readline-based input with their own input system:
 *
 * - `startInteractive(handler)` — Replaces the readline REPL entirely.
 *   The renderer owns stdin and calls `handler(text)` on each submission.
 *
 * - `confirm(action, details)` — Replaces the readline confirmation prompt
 *   with a TUI-native dialog (e.g. modal overlay).
 *
 * - `endStream()` — Signals that a streaming text block has ended.
 *   PlainRenderer prints a newline; InkRenderer commits the accumulated
 *   streaming text as a complete assistant message.
 *
 * - `cleanup()` — Called on shutdown to release resources (unmount Ink,
 *   close readline, etc.).
 */

export interface Renderer {
  /**
   * Display the startup banner with version, model, and connection status.
   */
  renderBanner(version: string, model: string, connected: boolean): void;

  /**
   * Display a user-submitted message.
   */
  renderUserMessage(text: string): void;

  /**
   * Stream assistant text to the output (called for each text delta).
   */
  renderAssistantText(text: string): void;

  /**
   * Signal that a streaming text block has ended.
   * PlainRenderer prints a newline; TUI renderers commit accumulated text.
   */
  endStream?(): void;

  /**
   * Indicate that a tool invocation has started.
   */
  renderToolStart(toolName: string): void;

  /**
   * Display the input parameters for a completed tool_use block.
   */
  renderToolInput(toolName: string, input: unknown): void;

  /**
   * Display a tool execution result.
   */
  renderToolResult(toolName: string, content: string, isError: boolean): void;

  /**
   * Display an error message, optionally with an actionable suggestion.
   */
  renderError(error: string, suggestion?: string): void;

  /**
   * Display an informational system message (e.g. "Conversation cleared",
   * context truncation notice, goodbye message).
   */
  renderSystemMessage(text: string): void;

  /**
   * Display a help listing for available commands.
   */
  renderHelp(commands: Array<{ name: string; description: string }>): void;

  /**
   * Print a visual separator / newline.
   * Used by the agentic loop to separate streaming blocks and exchanges.
   */
  renderNewline(): void;

  /**
   * Start the interactive input loop.
   * When implemented, the renderer owns stdin and calls `handler(text)`
   * for each user submission. Returns a promise that resolves when the
   * user exits (e.g. types "exit" or presses Ctrl+C).
   *
   * When NOT implemented, the runner falls back to the readline-based REPL.
   */
  startInteractive?(
    handler: (input: string) => Promise<void>,
  ): Promise<void>;

  /**
   * Prompt the user for confirmation of a tool action.
   * When implemented, the renderer shows a TUI-native dialog.
   * When NOT implemented, the runner uses the readline-based ConfirmationHandler.
   */
  confirm?(action: string, details: string): Promise<boolean>;

  /**
   * Clean up renderer resources (unmount Ink, close readline, etc.).
   * Called in the runner's finally block.
   */
  cleanup?(): void;
}
