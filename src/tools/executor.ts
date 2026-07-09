/**
 * Tool Executor
 *
 * Dispatches tool_use requests from the LLM to the corresponding tool
 * implementations. Handles error capture and result formatting so that
 * tool failures never crash the application.
 *
 * Optionally integrates with a ConfirmationHandler so that mutating tools
 * (bash, write_file) prompt the user for approval before execution.
 */

import Anthropic from "@anthropic-ai/sdk";
import { ToolRegistry } from "./registry.js";

type ContentBlock = Anthropic.Messages.ContentBlock;
type ToolResultBlockParam = Anthropic.Messages.ToolResultBlockParam;

/**
 * Interface for user confirmation prompts.
 * Decouples the executor from the specific UI implementation so it can
 * be mocked in tests or replaced with a non-interactive handler.
 */
export interface ConfirmationHandlerLike {
  confirm(action: string, details: string): Promise<boolean>;
}

/**
 * Options for creating a ToolExecutor.
 */
export interface ToolExecutorOptions {
  /** Optional confirmation handler for tools that require user approval. */
  confirmationHandler?: ConfirmationHandlerLike;
}

/**
 * Executes tools from a ToolRegistry in response to LLM tool_use requests.
 *
 * All tool execution errors are caught and converted into error result
 * messages, ensuring the conversation loop can continue gracefully.
 */
export class ToolExecutor {
  private registry: ToolRegistry;
  private confirmationHandler?: ConfirmationHandlerLike;

  constructor(registry: ToolRegistry, options?: ToolExecutorOptions) {
    this.registry = registry;
    this.confirmationHandler = options?.confirmationHandler;
  }

  /**
   * Execute a single tool by name with the given parameters.
   *
   * When the tool requires confirmation and a handler is configured,
   * the user is prompted before execution. If the user denies the action,
   * the tool is skipped and a "denied" result is returned to the LLM.
   *
   * @param toolName  - Name of the tool to execute.
   * @param toolUseId - The tool_use block ID from the API response.
   * @param params    - Input parameters for the tool.
   * @returns A ToolResultBlockParam with the execution output or error.
   */
  async executeTool(
    toolName: string,
    toolUseId: string,
    params: Record<string, unknown>,
  ): Promise<ToolResultBlockParam> {
    const tool = this.registry.get(toolName);

    if (!tool) {
      return {
        type: "tool_result",
        tool_use_id: toolUseId,
        content: `Error: Tool "${toolName}" not found`,
        is_error: true,
      };
    }

    // ── Confirmation gate ────────────────────────────────────────────
    if (tool.requiresConfirmation && this.confirmationHandler) {
      const action = `Tool: ${toolName}`;
      const details = formatToolInput(toolName, params);
      const approved = await this.confirmationHandler.confirm(action, details);
      if (!approved) {
        return {
          type: "tool_result",
          tool_use_id: toolUseId,
          content: "User denied this operation.",
          is_error: true,
        };
      }
    }

    try {
      const result = await tool.execute(params);
      return {
        type: "tool_result",
        tool_use_id: toolUseId,
        content: result.content,
        is_error: !result.success,
      };
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : String(error);
      return {
        type: "tool_result",
        tool_use_id: toolUseId,
        content: `Error executing tool "${toolName}": ${message}`,
        is_error: true,
      };
    }
  }

  /**
   * Process tool_use blocks from an LLM response content array.
   *
   * Filters for tool_use blocks, executes each tool in parallel, and
   * returns the corresponding tool_result messages ready to be sent
   * back to the API.
   *
   * @param contentBlocks - The content blocks from an Anthropic API response.
   * @returns Array of ToolResultBlockParam messages.
   */
  async executeTools(
    contentBlocks: ContentBlock[],
  ): Promise<ToolResultBlockParam[]> {
    const toolUseBlocks = contentBlocks.filter(
      (block): block is Anthropic.Messages.ToolUseBlock =>
        block.type === "tool_use",
    );

    const results = await Promise.all(
      toolUseBlocks.map((block) =>
        this.executeTool(
          block.name,
          block.id,
          block.input as Record<string, unknown>,
        ),
      ),
    );

    return results;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Format a tool's input parameters into a human-readable string for
 * the confirmation prompt.
 */
function formatToolInput(
  toolName: string,
  params: Record<string, unknown>,
): string {
  switch (toolName) {
    case "bash":
      return `$ ${String(params["command"] ?? "(no command)")}`;
    case "write_file": {
      const path = String(params["file_path"] ?? "(unknown)");
      const content = String(params["content"] ?? "");
      const preview =
        content.length > 200
          ? content.slice(0, 200) + `... (${content.length} chars total)`
          : content;
      return `Path: ${path}\nContent preview:\n${preview}`;
    }
    default:
      return JSON.stringify(params, null, 2);
  }
}

