/**
 * Tools Module
 *
 * Registry of tools available to the LLM agent.
 * Each tool defines its schema, description, and execution logic.
 */

export interface Tool {
  name: string;
  description: string;
  execute: (input: Record<string, unknown>) => Promise<string>;
}

// Tool registry - tools will be registered here as they are implemented
const tools: Map<string, Tool> = new Map();

export function registerTool(tool: Tool): void {
  tools.set(tool.name, tool);
}

export function getTool(name: string): Tool | undefined {
  return tools.get(name);
}

export function listTools(): Tool[] {
  return Array.from(tools.values());
}
