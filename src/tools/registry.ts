/**
 * Tool Registry
 *
 * Manages the collection of available tools. Supports dynamic registration
 * and unregistration, enforces name uniqueness, and generates the Anthropic
 * API tools parameter format.
 */

import { BaseTool, type JSONSchema } from "./base.js";

/**
 * Format compatible with Anthropic API's Tool parameter.
 * Structurally matches Anthropic.Messages.Tool from the SDK.
 */
export interface AnthropicToolFormat {
  name: string;
  description: string;
  input_schema: JSONSchema;
}

/**
 * Registry for managing tools available to the LLM agent.
 *
 * Enforces name uniqueness on registration and provides methods
 * to convert the registered tools into the Anthropic API format.
 */
export class ToolRegistry {
  private tools: Map<string, BaseTool> = new Map();

  /**
   * Register a tool. Throws if a tool with the same name is already registered.
   *
   * @param tool - The tool instance to register.
   */
  register(tool: BaseTool): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool "${tool.name}" is already registered`);
    }
    this.tools.set(tool.name, tool);
  }

  /**
   * Unregister a tool by name.
   *
   * @param name - The name of the tool to remove.
   * @returns true if the tool was found and removed, false otherwise.
   */
  unregister(name: string): boolean {
    return this.tools.delete(name);
  }

  /**
   * Get a tool by name.
   *
   * @param name - The name of the tool to look up.
   * @returns The tool instance, or undefined if not found.
   */
  get(name: string): BaseTool | undefined {
    return this.tools.get(name);
  }

  /**
   * Check whether a tool with the given name is registered.
   */
  has(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * List all registered tools.
   */
  list(): BaseTool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get the number of registered tools.
   */
  get size(): number {
    return this.tools.size;
  }

  /**
   * Remove all registered tools.
   */
  clear(): void {
    this.tools.clear();
  }

  /**
   * Convert all registered tools to the Anthropic API tools parameter format.
   * The returned array can be passed directly as the `tools` field in
   * Anthropic API message create requests.
   */
  toAnthropicTools(): AnthropicToolFormat[] {
    return this.list().map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.inputSchema,
    }));
  }
}
