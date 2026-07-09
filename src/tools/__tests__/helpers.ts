/**
 * Test helpers - Mock tool implementations for unit testing.
 */

import { BaseTool, type ToolResult, type JSONSchema } from "../base.js";

/**
 * A simple mock tool that echoes back input. Used for end-to-end tests.
 */
export class EchoTool extends BaseTool {
  readonly name = "echo";
  readonly description = "Echoes the input message back";
  readonly inputSchema: JSONSchema = {
    type: "object",
    properties: {
      message: { type: "string", description: "The message to echo" },
    },
    required: ["message"],
  };

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const message = String(params["message"] ?? "");
    return { success: true, content: message };
  }
}

/**
 * A mock tool that always throws during execution.
 */
export class ThrowingTool extends BaseTool {
  readonly name = "throwing";
  readonly description = "Always throws an error";
  readonly inputSchema: JSONSchema = {
    type: "object",
    properties: {},
  };

  async execute(_params: Record<string, unknown>): Promise<ToolResult> {
    throw new Error("Intentional test error");
  }
}

/**
 * A mock tool that returns a failure result.
 */
export class FailingTool extends BaseTool {
  readonly name = "failing";
  readonly description = "Always returns a failure result";
  readonly inputSchema: JSONSchema = {
    type: "object",
    properties: {},
  };

  async execute(_params: Record<string, unknown>): Promise<ToolResult> {
    return { success: false, content: "Operation failed", error: "Intentional failure" };
  }
}
