/**
 * Slash Command Unit Tests
 *
 * Covers: theme command, config command, clear, model, status, tools,
 * exit, and help commands with theme integration.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ConfigManager } from "../src/config/config-manager.js";
import { SlashCommandRegistry } from "../src/commands/registry.js";
import { registerBuiltInCommands } from "../src/commands/index.js";
import { setThemeConfigManager } from "../src/commands/theme.js";
import { setConfigCommandManager } from "../src/commands/config.js";
import { setActiveTheme, getActiveTheme } from "../src/ui/themes/index.js";
import type { CommandContext, CommandConfig } from "../src/commands/context.js";
import type { ConversationManager } from "../src/llm/conversation.js";
import type { ToolRegistry } from "../src/tools/registry.js";

/**
 * Build a minimal mock CommandContext for testing.
 */
function mockContext(overrides?: Partial<CommandConfig>): CommandContext {
  const config: CommandConfig = {
    model: "claude-sonnet-4-20250514",
    theme: "default",
    llmAvailable: false,
    ...overrides,
  };

  return {
    conversation: {
      reset: vi.fn(),
      getState: vi.fn(() => ({
        messageCount: 5,
        turnCount: 3,
        estimatedTokens: 1200,
        maxContextTokens: 100000,
      })),
    } as unknown as ConversationManager,
    toolRegistry: {
      size: 4,
      list: vi.fn(() => [
        { name: "bash", description: "Execute shell commands", requiresConfirmation: true },
        { name: "list_files", description: "List directory contents", requiresConfirmation: false },
        { name: "read_file", description: "Read file contents", requiresConfirmation: false },
        { name: "write_file", description: "Create or overwrite files", requiresConfirmation: true },
      ]),
    } as unknown as ToolRegistry,
    config,
    requestExit: vi.fn(),
  };
}

describe("Slash Commands", () => {
  let tempDir: string;
  let configPath: string;
  let configManager: ConfigManager;
  let registry: SlashCommandRegistry;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "cmd-test-"));
    configPath = join(tempDir, "config.json");
    configManager = new ConfigManager(configPath);

    setActiveTheme("default");

    registry = new SlashCommandRegistry();
    registerBuiltInCommands(registry);

    // Inject config manager into commands
    setThemeConfigManager(configManager);
    setConfigCommandManager(configManager);
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  // ---------------------------------------------------------------------------
  // /theme command
  // ---------------------------------------------------------------------------
  describe("/theme", () => {
    it("should list themes when no argument is provided", async () => {
      const spy = vi.spyOn(console, "log").mockImplementation(() => {});
      const ctx = mockContext();
      const resolved = registry.resolve("/theme");
      expect(resolved).not.toBeNull();
      await resolved!.command.execute(resolved!.args, ctx);

      const output = spy.mock.calls.map((c) => c.join(" ")).join("\n");
      expect(output).toContain("default");
      expect(output).toContain("dark");
      expect(output).toContain("light");
      spy.mockRestore();
    });

    it("should switch to dark theme", async () => {
      const spy = vi.spyOn(console, "log").mockImplementation(() => {});
      const ctx = mockContext();
      const resolved = registry.resolve("/theme dark");
      await resolved!.command.execute(resolved!.args, ctx);

      expect(getActiveTheme().name).toBe("dark");
      spy.mockRestore();
    });

    it("should persist theme change to config", async () => {
      const spy = vi.spyOn(console, "log").mockImplementation(() => {});
      const ctx = mockContext();
      const resolved = registry.resolve("/theme dark");
      await resolved!.command.execute(resolved!.args, ctx);

      expect(configManager.get("theme")).toBe("dark");
      spy.mockRestore();
    });

    it("should reject invalid theme name", async () => {
      const spy = vi.spyOn(console, "log").mockImplementation(() => {});
      const ctx = mockContext();
      const resolved = registry.resolve("/theme nonexistent");
      await resolved!.command.execute(resolved!.args, ctx);

      expect(getActiveTheme().name).toBe("default"); // unchanged
      const output = spy.mock.calls.map((c) => c.join(" ")).join("\n");
      expect(output).toContain("Unknown theme");
      spy.mockRestore();
    });

    it("should not persist invalid theme name", async () => {
      const spy = vi.spyOn(console, "log").mockImplementation(() => {});
      const ctx = mockContext();
      configManager.set("theme", "default");
      const resolved = registry.resolve("/theme nonexistent");
      await resolved!.command.execute(resolved!.args, ctx);

      expect(configManager.get("theme")).toBe("default");
      spy.mockRestore();
    });

    it("should switch to light theme", async () => {
      const spy = vi.spyOn(console, "log").mockImplementation(() => {});
      const ctx = mockContext();
      const resolved = registry.resolve("/theme light");
      await resolved!.command.execute(resolved!.args, ctx);

      expect(getActiveTheme().name).toBe("light");
      expect(configManager.get("theme")).toBe("light");
      spy.mockRestore();
    });
  });

  // ---------------------------------------------------------------------------
  // /clear command
  // ---------------------------------------------------------------------------
  describe("/clear", () => {
    it("should call conversation.reset()", async () => {
      const spy = vi.spyOn(console, "log").mockImplementation(() => {});
      const ctx = mockContext();
      const resolved = registry.resolve("/clear");
      await resolved!.command.execute(resolved!.args, ctx);

      expect(ctx.conversation.reset).toHaveBeenCalled();
      spy.mockRestore();
    });
  });

  // ---------------------------------------------------------------------------
  // /model command
  // ---------------------------------------------------------------------------
  describe("/model", () => {
    it("should show current model when no argument is provided", async () => {
      const spy = vi.spyOn(console, "log").mockImplementation(() => {});
      const ctx = mockContext({ model: "test-model" });
      const resolved = registry.resolve("/model");
      await resolved!.command.execute(resolved!.args, ctx);

      const output = spy.mock.calls.map((c) => c.join(" ")).join("\n");
      expect(output).toContain("test-model");
      spy.mockRestore();
    });

    it("should update model when argument is provided", async () => {
      const spy = vi.spyOn(console, "log").mockImplementation(() => {});
      const ctx = mockContext();
      const resolved = registry.resolve("/model claude-opus-4-20250514");
      await resolved!.command.execute(resolved!.args, ctx);

      expect(ctx.config.model).toBe("claude-opus-4-20250514");
      spy.mockRestore();
    });
  });

  // ---------------------------------------------------------------------------
  // /config command
  // ---------------------------------------------------------------------------
  describe("/config", () => {
    it("should list config items when no argument is provided", async () => {
      const spy = vi.spyOn(console, "log").mockImplementation(() => {});
      const ctx = mockContext();
      const resolved = registry.resolve("/config");
      await resolved!.command.execute(resolved!.args, ctx);

      const output = spy.mock.calls.map((c) => c.join(" ")).join("\n");
      expect(output).toContain("model");
      expect(output).toContain("theme");
      spy.mockRestore();
    });

    it("should read a specific config key", async () => {
      const spy = vi.spyOn(console, "log").mockImplementation(() => {});
      const ctx = mockContext();
      const resolved = registry.resolve("/config theme");
      await resolved!.command.execute(resolved!.args, ctx);

      const output = spy.mock.calls.map((c) => c.join(" ")).join("\n");
      expect(output).toContain("default");
      spy.mockRestore();
    });

    it("should set theme via /config theme dark", async () => {
      const spy = vi.spyOn(console, "log").mockImplementation(() => {});
      const ctx = mockContext();
      const resolved = registry.resolve("/config theme dark");
      await resolved!.command.execute(resolved!.args, ctx);

      expect(getActiveTheme().name).toBe("dark");
      expect(configManager.get("theme")).toBe("dark");
      spy.mockRestore();
    });

    it("should set autoConfirm via /config autoConfirm true", async () => {
      const spy = vi.spyOn(console, "log").mockImplementation(() => {});
      const ctx = mockContext();
      const resolved = registry.resolve("/config autoConfirm true");
      await resolved!.command.execute(resolved!.args, ctx);

      expect(configManager.get("autoConfirm")).toBe(true);
      spy.mockRestore();
    });

    it("should set maxTokens via /config maxTokens 8192", async () => {
      const spy = vi.spyOn(console, "log").mockImplementation(() => {});
      const ctx = mockContext();
      const resolved = registry.resolve("/config maxTokens 8192");
      await resolved!.command.execute(resolved!.args, ctx);

      expect(configManager.get("maxTokens")).toBe(8192);
      spy.mockRestore();
    });

    it("should reject invalid maxTokens", async () => {
      const spy = vi.spyOn(console, "log").mockImplementation(() => {});
      const ctx = mockContext();
      const resolved = registry.resolve("/config maxTokens abc");
      await resolved!.command.execute(resolved!.args, ctx);

      expect(configManager.get("maxTokens")).toBe(4096); // unchanged
      spy.mockRestore();
    });

    it("should report unknown config key", async () => {
      const spy = vi.spyOn(console, "log").mockImplementation(() => {});
      const ctx = mockContext();
      const resolved = registry.resolve("/config nonexistent");
      await resolved!.command.execute(resolved!.args, ctx);

      const output = spy.mock.calls.map((c) => c.join(" ")).join("\n");
      expect(output).toContain("Unknown config key");
      spy.mockRestore();
    });
  });

  // ---------------------------------------------------------------------------
  // /status command
  // ---------------------------------------------------------------------------
  describe("/status", () => {
    it("should display CLI status", async () => {
      const spy = vi.spyOn(console, "log").mockImplementation(() => {});
      const ctx = mockContext({ llmAvailable: true });
      const resolved = registry.resolve("/status");
      await resolved!.command.execute(resolved!.args, ctx);

      const output = spy.mock.calls.map((c) => c.join(" ")).join("\n");
      expect(output).toContain("CLI Status");
      expect(output).toContain("Model");
      spy.mockRestore();
    });
  });

  // ---------------------------------------------------------------------------
  // /tools command
  // ---------------------------------------------------------------------------
  describe("/tools", () => {
    it("should list registered tools", async () => {
      const spy = vi.spyOn(console, "log").mockImplementation(() => {});
      const ctx = mockContext();
      const resolved = registry.resolve("/tools");
      await resolved!.command.execute(resolved!.args, ctx);

      const output = spy.mock.calls.map((c) => c.join(" ")).join("\n");
      expect(output).toContain("bash");
      expect(output).toContain("read_file");
      expect(output).toContain("write_file");
      expect(output).toContain("list_files");
      spy.mockRestore();
    });
  });

  // ---------------------------------------------------------------------------
  // /exit command
  // ---------------------------------------------------------------------------
  describe("/exit", () => {
    it("should call requestExit()", async () => {
      const spy = vi.spyOn(console, "log").mockImplementation(() => {});
      const ctx = mockContext();
      const resolved = registry.resolve("/exit");
      await resolved!.command.execute(resolved!.args, ctx);

      expect(ctx.requestExit).toHaveBeenCalled();
      spy.mockRestore();
    });
  });

  // ---------------------------------------------------------------------------
  // /help command
  // ---------------------------------------------------------------------------
  describe("/help", () => {
    it("should list all registered commands", async () => {
      const spy = vi.spyOn(console, "log").mockImplementation(() => {});
      const ctx = mockContext();
      const resolved = registry.resolve("/help");
      await resolved!.command.execute(resolved!.args, ctx);

      const output = spy.mock.calls.map((c) => c.join(" ")).join("\n");
      expect(output).toContain("clear");
      expect(output).toContain("exit");
      expect(output).toContain("model");
      expect(output).toContain("theme");
      expect(output).toContain("config");
      expect(output).toContain("status");
      expect(output).toContain("tools");
      expect(output).toContain("help");
      spy.mockRestore();
    });
  });

  // ---------------------------------------------------------------------------
  // Registry resolve
  // ---------------------------------------------------------------------------
  describe("registry resolve", () => {
    it("should return null for non-slash input", () => {
      expect(registry.resolve("hello")).toBeNull();
    });

    it("should return null for unknown slash command", () => {
      expect(registry.resolve("/unknown")).toBeNull();
    });

    it("should resolve /theme to ThemeCommand", () => {
      const result = registry.resolve("/theme");
      expect(result).not.toBeNull();
      expect(result!.command.name).toBe("theme");
    });

    it("should resolve /quit as alias for /exit", () => {
      const result = registry.resolve("/quit");
      expect(result).not.toBeNull();
      expect(result!.command.name).toBe("exit");
    });

    it("should resolve /m as alias for /model", () => {
      const result = registry.resolve("/m");
      expect(result).not.toBeNull();
      expect(result!.command.name).toBe("model");
    });
  });
});
