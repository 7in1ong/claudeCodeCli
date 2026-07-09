/**
 * Slash Command Behavior Unit Tests
 *
 * Covers each built-in command's execute() method: verifies the
 * right renderer/console methods are called, config is mutated as
 * expected, and edge cases (empty args, unknown keys) are handled.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ConversationManager } from "../src/llm/conversation.js";
import { ToolRegistry } from "../src/tools/registry.js";
import { BaseTool, type ToolResult, type JSONSchema } from "../src/tools/base.js";
import type { Renderer } from "../src/ui/renderer.js";
import type { CommandContext, CommandConfig } from "../src/commands/context.js";
import type { ParsedArgs } from "../src/commands/parser.js";

import { ClearCommand } from "../src/commands/clear.js";
import { ExitCommand } from "../src/commands/exit.js";
import { ModelCommand } from "../src/commands/model.js";
import { ThemeCommand } from "../src/commands/theme.js";
import { ConfigCommand } from "../src/commands/config.js";
import { StatusCommand } from "../src/commands/status.js";
import { ToolsCommand } from "../src/commands/tools.js";
import { createHelpCommand } from "../src/commands/help.js";
import { SlashCommandRegistry } from "../src/commands/registry.js";

// ---------------------------------------------------------------------------
// vi.mock: stub resetClient so we don't touch the real LLM client
// ---------------------------------------------------------------------------
vi.mock("../src/llm/client.js", () => ({
  resetClient: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRenderer(): Renderer {
  return {
    renderBanner: vi.fn(),
    renderUserMessage: vi.fn(),
    renderAssistantText: vi.fn(),
    renderToolStart: vi.fn(),
    renderToolInput: vi.fn(),
    renderToolResult: vi.fn(),
    renderError: vi.fn(),
    renderSystemMessage: vi.fn(),
    renderHelp: vi.fn(),
  };
}

function makeConfig(overrides: Partial<CommandConfig> = {}): CommandConfig {
  return {
    model: "claude-sonnet-4-20250514",
    theme: "default",
    llmAvailable: true,
    ...overrides,
  };
}

function makeContext(overrides: Partial<CommandContext> = {}): CommandContext {
  return {
    conversation: new ConversationManager({ systemPrompt: "test" }),
    toolRegistry: new ToolRegistry(),
    renderer: makeRenderer(),
    config: makeConfig(),
    requestExit: vi.fn(),
    ...overrides,
  };
}

function makeArgs(positionals: string[] = [], flags: Record<string, unknown> = {}): ParsedArgs {
  return { command: "", positionals, flags };
}

/** Capture console.log output during a callback. */
async function captureConsole(fn: () => Promise<void>): Promise<string[]> {
  const lines: string[] = [];
  const spy = vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
    lines.push(args.map(String).join(" "));
  });
  try {
    await fn();
  } finally {
    spy.mockRestore();
  }
  return lines;
}

// ---------------------------------------------------------------------------
// Stub tool for /tools tests
// ---------------------------------------------------------------------------

class StubTool extends BaseTool {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: JSONSchema = { type: "object" };
  override readonly requiresConfirmation: boolean;

  constructor(name: string, description: string, requiresConfirmation = false) {
    super();
    this.name = name;
    this.description = description;
    this.requiresConfirmation = requiresConfirmation;
  }

  async execute(_params: Record<string, unknown>): Promise<ToolResult> {
    return { success: true, content: "ok" };
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ClearCommand", () => {
  it("should reset the conversation and notify the user", async () => {
    const conversation = new ConversationManager({ systemPrompt: "test" });
    conversation.addUserMessage("hello");
    conversation.addAssistantMessage("hi");
    expect(conversation.getMessageCount()).toBe(2);

    const renderer = makeRenderer();
    const context = makeContext({ conversation, renderer });

    const cmd = new ClearCommand();
    await cmd.execute(makeArgs(), context);

    expect(conversation.getMessageCount()).toBe(0);
    expect(conversation.getTurnCount()).toBe(0);
    expect(renderer.renderSystemMessage).toHaveBeenCalledWith(
      expect.stringContaining("Conversation cleared"),
    );
  });
});

describe("ExitCommand", () => {
  it("should print goodbye and call requestExit", async () => {
    const renderer = makeRenderer();
    const requestExit = vi.fn();
    const context = makeContext({ renderer, requestExit });

    const cmd = new ExitCommand();
    await cmd.execute(makeArgs(), context);

    expect(renderer.renderSystemMessage).toHaveBeenCalledWith(
      expect.stringContaining("Goodbye"),
    );
    expect(requestExit).toHaveBeenCalledOnce();
  });

  it("should have 'quit' as an alias", () => {
    const cmd = new ExitCommand();
    expect(cmd.aliases).toContain("quit");
  });
});

describe("ModelCommand", () => {
  it("should show the current model when no arg is provided", async () => {
    const context = makeContext({ config: makeConfig({ model: "claude-opus-4-20250514" }) });

    const lines = await captureConsole(() =>
      new ModelCommand().execute(makeArgs(), context),
    );

    expect(lines.join("\n")).toContain("claude-opus-4-20250514");
  });

  it("should switch the model when a name is provided", async () => {
    const context = makeContext();
    const { resetClient } = await import("../src/llm/client.js");

    const lines = await captureConsole(() =>
      new ModelCommand().execute(makeArgs(["claude-opus-4-20250514"]), context),
    );

    expect(context.config.model).toBe("claude-opus-4-20250514");
    expect(lines.join("\n")).toContain("claude-opus-4-20250514");
    expect(resetClient).toHaveBeenCalled();
  });

  it("should declare 'model' as name and 'm' as alias", () => {
    const cmd = new ModelCommand();
    expect(cmd.name).toBe("model");
    expect(cmd.aliases).toContain("m");
  });
});

describe("ThemeCommand", () => {
  it("should show the current theme and available themes when no arg is provided", async () => {
    const context = makeContext({ config: makeConfig({ theme: "dark" }) });

    const lines = await captureConsole(() =>
      new ThemeCommand().execute(makeArgs(), context),
    );
    const output = lines.join("\n");

    expect(output).toContain("dark");
    expect(output).toContain("default");
    expect(output).toContain("light");
  });

  it("should accept a valid theme name", async () => {
    const context = makeContext();

    const lines = await captureConsole(() =>
      new ThemeCommand().execute(makeArgs(["dark"]), context),
    );
    const output = lines.join("\n");

    expect(context.config.theme).toBe("dark");
    expect(output).toContain("dark");
  });

  it("should reject an unknown theme name", async () => {
    const context = makeContext();

    const lines = await captureConsole(() =>
      new ThemeCommand().execute(makeArgs(["noir"]), context),
    );
    const output = lines.join("\n");

    // Theme should NOT have been updated
    expect(context.config.theme).toBe("default");
    expect(output.toLowerCase()).toMatch(/unknown|noir/);
    // Should list the available themes as a hint
    expect(output).toContain("default");
  });

  it("should note that visual switching is pending integration", async () => {
    const context = makeContext();

    const lines = await captureConsole(() =>
      new ThemeCommand().execute(makeArgs(["dark"]), context),
    );
    const output = lines.join("\n").toLowerCase();

    // Should contain some hint that the visual switch is not yet active
    expect(output).toMatch(/visual|activat|integrat/);
  });
});

describe("ConfigCommand", () => {
  it("should list all displayable keys when no arg is provided", async () => {
    const context = makeContext();

    const lines = await captureConsole(() =>
      new ConfigCommand().execute(makeArgs(), context),
    );
    const output = lines.join("\n");

    expect(output).toContain("model");
    expect(output).toContain("theme");
  });

  it("should read a single known key", async () => {
    const context = makeContext({ config: makeConfig({ model: "claude-opus-4-20250514" }) });

    const lines = await captureConsole(() =>
      new ConfigCommand().execute(makeArgs(["model"]), context),
    );
    const output = lines.join("\n");

    expect(output).toContain("claude-opus-4-20250514");
  });

  it("should report unknown key when reading", async () => {
    const context = makeContext();

    const lines = await captureConsole(() =>
      new ConfigCommand().execute(makeArgs(["nonexistent"]), context),
    );
    const output = lines.join("\n").toLowerCase();

    expect(output).toMatch(/unknown|not found|no such/);
  });

  it("should set a writable key (model) and reset the client", async () => {
    const context = makeContext();
    const { resetClient } = await import("../src/llm/client.js");
    vi.mocked(resetClient).mockClear();

    const lines = await captureConsole(() =>
      new ConfigCommand().execute(makeArgs(["model", "claude-opus-4-20250514"]), context),
    );
    const output = lines.join("\n");

    expect(context.config.model).toBe("claude-opus-4-20250514");
    expect(output).toContain("claude-opus-4-20250514");
    expect(resetClient).toHaveBeenCalled();
  });

  it("should set a writable key (theme)", async () => {
    const context = makeContext();

    await captureConsole(() =>
      new ConfigCommand().execute(makeArgs(["theme", "dark"]), context),
    );

    expect(context.config.theme).toBe("dark");
  });

  it("should reject writes to non-writable keys", async () => {
    const context = makeContext();

    const lines = await captureConsole(() =>
      new ConfigCommand().execute(makeArgs(["llmAvailable", "false"]), context),
    );
    const output = lines.join("\n").toLowerCase();

    // Should refuse the write
    expect(output).toMatch(/cannot write|not a configurable|writable/);
    // llmAvailable should not have been overwritten
    expect(context.config.llmAvailable).toBe(true);
  });
});

describe("StatusCommand", () => {
  it("should display model, theme, connection state, and counters", async () => {
    const conversation = new ConversationManager({ systemPrompt: "test" });
    conversation.addUserMessage("hello");
    conversation.addAssistantMessage("hi there");

    const registry = new ToolRegistry();
    registry.register(new StubTool("read_file", "Reads files"));

    const context = makeContext({
      conversation,
      toolRegistry: registry,
      config: makeConfig({ model: "claude-opus", theme: "dark", llmAvailable: false }),
    });

    const lines = await captureConsole(() =>
      new StatusCommand().execute(makeArgs(), context),
    );
    const output = lines.join("\n");

    expect(output).toContain("claude-opus");
    expect(output).toContain("dark");
    expect(output.toLowerCase()).toMatch(/mock|api connected/);
    // Token and message counts should appear as numbers
    expect(output).toMatch(/\d+/);
  });
});

describe("ToolsCommand", () => {
  it("should list registered tools", async () => {
    const registry = new ToolRegistry();
    registry.register(new StubTool("read_file", "Reads files", false));
    registry.register(new StubTool("bash", "Runs shell commands", true));

    const context = makeContext({ toolRegistry: registry });

    const lines = await captureConsole(() =>
      new ToolsCommand().execute(makeArgs(), context),
    );
    const output = lines.join("\n");

    expect(output).toContain("read_file");
    expect(output).toContain("bash");
    expect(output.toLowerCase()).toMatch(/auto|confirm/);
  });

  it("should render a system message when no tools are registered", async () => {
    const renderer = makeRenderer();
    const context = makeContext({ toolRegistry: new ToolRegistry(), renderer });

    await captureConsole(() =>
      new ToolsCommand().execute(makeArgs(), context),
    );

    expect(renderer.renderSystemMessage).toHaveBeenCalledWith(
      expect.stringContaining("No tools"),
    );
  });
});

describe("HelpCommand (createHelpCommand)", () => {
  it("should list all registered commands", async () => {
    const registry = new SlashCommandRegistry();
    registry.register(new ClearCommand());
    registry.register(new ExitCommand());
    registry.register(createHelpCommand(registry));

    const context = makeContext();

    const lines = await captureConsole(() =>
      createHelpCommand(registry).execute(makeArgs(), context),
    );
    const output = lines.join("\n");

    expect(output).toContain("/clear");
    expect(output).toContain("/exit");
    expect(output).toContain("/help");
  });

  it("should include aliases in the listing", async () => {
    const registry = new SlashCommandRegistry();
    registry.register(new ExitCommand()); // aliases: ["quit"]
    registry.register(new ModelCommand()); // aliases: ["m"]

    const context = makeContext();

    const lines = await captureConsole(() =>
      createHelpCommand(registry).execute(makeArgs(), context),
    );
    const output = lines.join("\n");

    expect(output).toContain("quit");
    expect(output).toContain("(m)");
  });

  it("should show arg definitions when present", async () => {
    const registry = new SlashCommandRegistry();
    registry.register(new ModelCommand()); // has args: [{ name: "name", ... }]

    const context = makeContext();

    const lines = await captureConsole(() =>
      createHelpCommand(registry).execute(makeArgs(), context),
    );
    const output = lines.join("\n");

    expect(output).toContain("<name>");
    expect(output).toContain("Model identifier");
  });
});
