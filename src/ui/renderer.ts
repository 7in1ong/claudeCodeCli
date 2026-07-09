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
}
