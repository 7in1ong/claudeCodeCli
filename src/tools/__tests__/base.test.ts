import { describe, it, expect } from "vitest";
import { BaseTool, type ToolResult, type JSONSchema } from "../base.js";
import { ToolRegistry } from "../registry.js";
import { ToolExecutor } from "../executor.js";

/**
 * A mock add tool for end-to-end testing of the full framework flow:
 * BaseTool subclass -> ToolRegistry -> ToolExecutor -> tool_result
 */
class AddTool extends BaseTool {
  readonly name = "add";
  readonly description = "Adds two numbers and returns the sum";
  readonly inputSchema: JSONSchema = {
    type: "object",
    properties: {
      a: { type: "number", description: "First number" },
      b: { type: "number", description: "Second number" },
    },
    required: ["a", "b"],
  };

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const a = Number(params["a"]);
    const b = Number(params["b"]);
    return { success: true, content: String(a + b) };
  }
}

describe("BaseTool end-to-end", () => {
  it("should flow through registry and executor to produce a tool_result", async () => {
    // 1. Create a tool and register it
    const registry = new ToolRegistry();
    const addTool = new AddTool();
    registry.register(addTool);

    // 2. Verify the Anthropic API format output
    const anthropicTools = registry.toAnthropicTools();
    expect(anthropicTools).toEqual([
      {
        name: "add",
        description: "Adds two numbers and returns the sum",
        input_schema: {
          type: "object",
          properties: {
            a: { type: "number", description: "First number" },
            b: { type: "number", description: "Second number" },
          },
          required: ["a", "b"],
        },
      },
    ]);

    // 3. Execute via ToolExecutor (simulating an LLM tool_use response)
    const executor = new ToolExecutor(registry);
    const result = await executor.executeTool("add", "toolu_test_001", {
      a: 3,
      b: 5,
    });

    // 4. Verify the tool_result format
    expect(result.type).toBe("tool_result");
    expect(result.tool_use_id).toBe("toolu_test_001");
    expect(result.content).toBe("8");
    expect(result.is_error).toBe(false);
  });

  it("should handle tool execution with direct BaseTool.execute()", async () => {
    const tool = new AddTool();
    const result = await tool.execute({ a: 10, b: 20 });

    expect(result.success).toBe(true);
    expect(result.content).toBe("30");
  });

  it("should verify BaseTool properties are accessible", () => {
    const tool = new AddTool();

    expect(tool.name).toBe("add");
    expect(tool.description).toBe("Adds two numbers and returns the sum");
    expect(tool.inputSchema.type).toBe("object");
    expect(tool.inputSchema.properties).toBeDefined();
    expect(tool.inputSchema.required).toEqual(["a", "b"]);
  });

  it("should work with the full content block pipeline", async () => {
    const registry = new ToolRegistry();
    registry.register(new AddTool());

    const executor = new ToolExecutor(registry);
    const results = await executor.executeTools([
      { type: "text", text: "I will calculate this for you.", citations: null },
      { type: "tool_use", id: "toolu_calc", name: "add", input: { a: 100, b: 200 } },
    ]);

    expect(results).toHaveLength(1);
    expect(results[0].tool_use_id).toBe("toolu_calc");
    expect(results[0].content).toBe("300");
    expect(results[0].is_error).toBe(false);
  });
});
