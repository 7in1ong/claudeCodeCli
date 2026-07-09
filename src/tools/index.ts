/**
 * Tools Module
 *
 * Provides the tool calling framework: base types, registry, executor,
 * and built-in tool implementations (Read, Write, Bash, ListFiles).
 * Use ToolRegistry to manage tools and ToolExecutor to dispatch tool_use
 * requests from the LLM.
 */

export { BaseTool, type ToolResult, type JSONSchema } from "./base.js";
export { ToolRegistry, type AnthropicToolFormat } from "./registry.js";
export { ToolExecutor } from "./executor.js";

// Built-in tools
export { ReadFileTool } from "./read-file.js";
export { WriteFileTool } from "./write-file.js";
export { BashTool } from "./bash-tool.js";
export { ListFilesTool } from "./list-files.js";

/**
 * Register all built-in tools into a ToolRegistry instance.
 *
 * This is the single entry point for CLI initialization to wire up
 * every tool the LLM can call.
 */
import { ReadFileTool } from "./read-file.js";
import { WriteFileTool } from "./write-file.js";
import { BashTool } from "./bash-tool.js";
import { ListFilesTool } from "./list-files.js";
import { ToolRegistry } from "./registry.js";

export function registerBuiltInTools(registry: ToolRegistry): void {
  registry.register(new ReadFileTool());
  registry.register(new WriteFileTool());
  registry.register(new BashTool());
  registry.register(new ListFilesTool());
}
