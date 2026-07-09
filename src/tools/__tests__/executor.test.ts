import { describe, it, expect, beforeEach } from "vitest";
import { ToolExecutor } from "../executor.js";
import { ToolRegistry } from "../registry.js";
import { EchoTool, ThrowingTool, FailingTool } from "./helpers.js";
import type Anthropic from "@anthropic-ai/sdk";

type ContentBlock = Anthropic.Messages.ContentBlock;

function makeToolUseBlock(
  name: string,
  input: Record<string, unknown>,
): ContentBlock {
  return {
    type: "tool_use",
    id: `toolu_${Math.random().toString(36).slice(2, 10)}`,
    name,
    input,
  };
}

describe("ToolExecutor", () => {
  let registry: ToolRegistry;
  let executor: ToolExecutor;

  beforeEach(() => {
    registry = new ToolRegistry();
    executor = new ToolExecutor(registry);
  });

  describe("executeTool", () => {
    it("should execute a registered tool successfully", async () => {
      registry.register(new EchoTool());

      const result = await executor.executeTool("echo", "toolu_123", {
        message: "hello",
      });

      expect(result.type).toBe("tool_result");
      expect(result.tool_use_id).toBe("toolu_123");
      expect(result.content).toBe("hello");
      expect(result.is_error).toBe(false);
    });

    it("should return error when tool is not found", async () => {
      const result = await executor.executeTool("nonexistent", "toolu_456", {});

      expect(result.type).toBe("tool_result");
      expect(result.tool_use_id).toBe("toolu_456");
      expect(result.is_error).toBe(true);
      expect(result.content).toContain("not found");
    });

    it("should catch and return error when tool throws", async () => {
      registry.register(new ThrowingTool());

      const result = await executor.executeTool("throwing", "toolu_789", {});

      expect(result.type).toBe("tool_result");
      expect(result.tool_use_id).toBe("toolu_789");
      expect(result.is_error).toBe(true);
      expect(result.content).toContain("Intentional test error");
    });

    it("should return error result when tool returns failure", async () => {
      registry.register(new FailingTool());

      const result = await executor.executeTool("failing", "toolu_abc", {});

      expect(result.type).toBe("tool_result");
      expect(result.tool_use_id).toBe("toolu_abc");
      expect(result.is_error).toBe(true);
      expect(result.content).toBe("Operation failed");
    });
  });

  describe("executeTools", () => {
    it("should process tool_use blocks and return results", async () => {
      registry.register(new EchoTool());

      const blocks: ContentBlock[] = [
        makeToolUseBlock("echo", { message: "first" }),
        makeToolUseBlock("echo", { message: "second" }),
      ];

      const results = await executor.executeTools(blocks);

      expect(results).toHaveLength(2);
      expect(results[0].content).toBe("first");
      expect(results[1].content).toBe("second");
    });

    it("should skip non-tool_use content blocks", async () => {
      registry.register(new EchoTool());

      const blocks: ContentBlock[] = [
        { type: "text", text: "Some text from the model", citations: null },
        makeToolUseBlock("echo", { message: "after text" }),
      ];

      const results = await executor.executeTools(blocks);

      expect(results).toHaveLength(1);
      expect(results[0].content).toBe("after text");
    });

    it("should return empty array when no tool_use blocks present", async () => {
      const blocks: ContentBlock[] = [
        { type: "text", text: "Just a text response", citations: null },
      ];

      const results = await executor.executeTools(blocks);

      expect(results).toEqual([]);
    });

    it("should handle mixed success and failure in parallel execution", async () => {
      registry.register(new EchoTool());
      registry.register(new ThrowingTool());

      const blocks: ContentBlock[] = [
        makeToolUseBlock("echo", { message: "ok" }),
        makeToolUseBlock("throwing", {}),
      ];

      const results = await executor.executeTools(blocks);

      expect(results).toHaveLength(2);
      expect(results[0].is_error).toBe(false);
      expect(results[1].is_error).toBe(true);
    });
  });
});
