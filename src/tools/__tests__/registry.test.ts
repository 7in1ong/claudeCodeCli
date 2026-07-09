import { describe, it, expect, beforeEach } from "vitest";
import { ToolRegistry } from "../registry.js";
import { EchoTool, FailingTool } from "./helpers.js";

describe("ToolRegistry", () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = new ToolRegistry();
  });

  describe("register", () => {
    it("should register a tool successfully", () => {
      const tool = new EchoTool();
      registry.register(tool);

      expect(registry.has("echo")).toBe(true);
      expect(registry.size).toBe(1);
    });

    it("should throw when registering a duplicate tool name", () => {
      const tool = new EchoTool();
      registry.register(tool);

      expect(() => registry.register(new EchoTool())).toThrowError(
        'Tool "echo" is already registered',
      );
    });

    it("should register multiple tools with different names", () => {
      registry.register(new EchoTool());
      registry.register(new FailingTool());

      expect(registry.size).toBe(2);
      expect(registry.has("echo")).toBe(true);
      expect(registry.has("failing")).toBe(true);
    });
  });

  describe("unregister", () => {
    it("should remove a registered tool", () => {
      registry.register(new EchoTool());
      const removed = registry.unregister("echo");

      expect(removed).toBe(true);
      expect(registry.has("echo")).toBe(false);
      expect(registry.size).toBe(0);
    });

    it("should return false when unregistering a non-existent tool", () => {
      const removed = registry.unregister("nonexistent");
      expect(removed).toBe(false);
    });

    it("should allow re-registering after unregister", () => {
      registry.register(new EchoTool());
      registry.unregister("echo");
      registry.register(new EchoTool());

      expect(registry.has("echo")).toBe(true);
      expect(registry.size).toBe(1);
    });
  });

  describe("get", () => {
    it("should return the tool by name", () => {
      const tool = new EchoTool();
      registry.register(tool);

      const found = registry.get("echo");
      expect(found).toBe(tool);
    });

    it("should return undefined for non-existent tool", () => {
      expect(registry.get("nonexistent")).toBeUndefined();
    });
  });

  describe("list", () => {
    it("should return all registered tools", () => {
      const echo = new EchoTool();
      const failing = new FailingTool();
      registry.register(echo);
      registry.register(failing);

      const tools = registry.list();
      expect(tools).toHaveLength(2);
      expect(tools).toContain(echo);
      expect(tools).toContain(failing);
    });

    it("should return empty array when no tools registered", () => {
      expect(registry.list()).toEqual([]);
    });
  });

  describe("clear", () => {
    it("should remove all tools", () => {
      registry.register(new EchoTool());
      registry.register(new FailingTool());
      registry.clear();

      expect(registry.size).toBe(0);
      expect(registry.list()).toEqual([]);
    });
  });

  describe("toAnthropicTools", () => {
    it("should convert registered tools to Anthropic API format", () => {
      registry.register(new EchoTool());

      const tools = registry.toAnthropicTools();

      expect(tools).toHaveLength(1);
      expect(tools[0]).toEqual({
        name: "echo",
        description: "Echoes the input message back",
        input_schema: {
          type: "object",
          properties: {
            message: { type: "string", description: "The message to echo" },
          },
          required: ["message"],
        },
      });
    });

    it("should include all registered tools", () => {
      registry.register(new EchoTool());
      registry.register(new FailingTool());

      const tools = registry.toAnthropicTools();

      expect(tools).toHaveLength(2);
      const names = tools.map((t) => t.name);
      expect(names).toContain("echo");
      expect(names).toContain("failing");
    });

    it("should return empty array when no tools registered", () => {
      expect(registry.toAnthropicTools()).toEqual([]);
    });

    it("should use input_schema (snake_case) not inputSchema", () => {
      registry.register(new EchoTool());
      const tools = registry.toAnthropicTools();

      expect(tools[0]).toHaveProperty("input_schema");
      expect(tools[0]).not.toHaveProperty("inputSchema");
    });
  });
});
