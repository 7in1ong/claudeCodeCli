/**
 * Tool Executor
 *
 * Dispatches tool_use requests from the LLM to the corresponding tool
 * implementations. Handles error capture and result formatting so that
 * tool failures never crash the application.
 */

import Anthropic from "@anthropic-ai/sdk";
import { ToolRegistry } from "./registry.js";

type ContentBlock = Anthropic.Messages.ContentBlock;
type ToolResultBlockParam = Anthropic.Messages.ToolResultBlockParam;

/**
 * Executes tools from a ToolRegistry in response to LLM tool_use requests.
 *
 * All tool execution errors are caught and converted into error result
 * messages, ensuring the conversation loop can continue gracefully.
 */
export class ToolExecutor {
  private registry: ToolRegistry;

  constructor(registry: ToolRegistry) {
    this.registry = registry;
  }

  /**
   * Execute a single tool by name with the given parameters.
   *
   * @param toolName - Name of the tool to execute.
   * @param params - Input parameters for the tool.
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
