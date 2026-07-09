/**
 * Tools Module
 *
 * Provides the tool calling framework: base types, registry, and executor.
 * Use ToolRegistry to manage tools and ToolExecutor to dispatch tool_use
 * requests from the LLM.
 */

export { BaseTool, type ToolResult, type JSONSchema } from "./base.js";
export { ToolRegistry, type AnthropicToolFormat } from "./registry.js";
export { ToolExecutor } from "./executor.js";
