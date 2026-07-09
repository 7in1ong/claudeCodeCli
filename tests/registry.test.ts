/**
 * SlashCommandRegistry Unit Tests
 *
 * Covers: registration, name/alias lookup, conflict detection,
 * list/size, resolve() with valid and invalid inputs.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { SlashCommandRegistry } from "../src/commands/registry.js";
import { SlashCommand } from "../src/commands/base.js";
import type { ParsedArgs } from "../src/commands/parser.js";
import type { CommandContext } from "../src/commands/context.js";

// ---------------------------------------------------------------------------
// Test command stubs
// ---------------------------------------------------------------------------

class StubCommand extends SlashCommand {
  readonly name: string;
  readonly aliases?: string[];
  readonly description: string;
  executed = false;

  constructor(name: string, description: string, aliases?: string[]) {
    super();
    this.name = name;
    this.description = description;
    this.aliases = aliases;
  }

  async execute(_args: ParsedArgs, _context: CommandContext): Promise<void> {
    this.executed = true;
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("SlashCommandRegistry", () => {
  let registry: SlashCommandRegistry;

  beforeEach(() => {
    registry = new SlashCommandRegistry();
  });

  // ---------------------------------------------------------------------------
  // Registration
  // ---------------------------------------------------------------------------
  describe("registration", () => {
    it("should register a command successfully", () => {
      registry.register(new StubCommand("clear", "Clear history"));
      expect(registry.has("clear")).toBe(true);
      expect(registry.size).toBe(1);
    });

    it("should register multiple commands", () => {
      registry.register(new StubCommand("clear", "Clear"));
      registry.register(new StubCommand("help", "Help"));
      expect(registry.size).toBe(2);
    });

    it("should throw on duplicate command name", () => {
      registry.register(new StubCommand("clear", "Clear"));
      expect(() => registry.register(new StubCommand("clear", "Clear 2")))
        .toThrow('Command "clear" is already registered');
    });

    it("should throw when alias conflicts with existing command", () => {
      registry.register(new StubCommand("clear", "Clear"));
      expect(() => registry.register(new StubCommand("other", "Other", ["clear"])))
        .toThrow(/conflicts/);
    });

    it("should throw when command name conflicts with existing alias", () => {
      registry.register(new StubCommand("model", "Model", ["m"]));
      expect(() => registry.register(new StubCommand("m", "M command")))
        .toThrow(/already registered/);
    });

    it("should throw on duplicate alias", () => {
      registry.register(new StubCommand("model", "Model", ["m"]));
      expect(() => registry.register(new StubCommand("mode", "Mode", ["m"])))
        .toThrow(/conflicts/);
    });
  });

  // ---------------------------------------------------------------------------
  // Lookup
  // ---------------------------------------------------------------------------
  describe("lookup", () => {
    it("should look up by primary name", () => {
      const cmd = new StubCommand("clear", "Clear");
      registry.register(cmd);
      expect(registry.get("clear")).toBe(cmd);
    });

    it("should look up by alias", () => {
      const cmd = new StubCommand("model", "Model", ["m"]);
      registry.register(cmd);
      expect(registry.get("m")).toBe(cmd);
    });

    it("should return undefined for unknown command", () => {
      expect(registry.get("nonexistent")).toBeUndefined();
    });

    it("should resolve all aliases to the same command", () => {
      const cmd = new StubCommand("exit", "Exit", ["quit", "q"]);
      registry.register(cmd);
      expect(registry.get("exit")).toBe(cmd);
      expect(registry.get("quit")).toBe(cmd);
      expect(registry.get("q")).toBe(cmd);
    });

    it("should report has() correctly", () => {
      const cmd = new StubCommand("help", "Help", ["h"]);
      registry.register(cmd);
      expect(registry.has("help")).toBe(true);
      expect(registry.has("h")).toBe(true);
      expect(registry.has("nope")).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // List and size
  // ---------------------------------------------------------------------------
  describe("list and size", () => {
    it("should return empty list when no commands registered", () => {
      expect(registry.list()).toEqual([]);
      expect(registry.size).toBe(0);
    });

    it("should list all registered commands (primary names only)", () => {
      registry.register(new StubCommand("clear", "Clear"));
      registry.register(new StubCommand("help", "Help", ["h"]));

      const list = registry.list();
      expect(list).toHaveLength(2);
      const names = list.map((c) => c.name).sort();
      expect(names).toEqual(["clear", "help"]);
    });

    it("should not count aliases in size", () => {
      registry.register(new StubCommand("exit", "Exit", ["quit", "q"]));
      expect(registry.size).toBe(1); // only primary name counts
    });
  });

  // ---------------------------------------------------------------------------
  // resolve()
  // ---------------------------------------------------------------------------
  describe("resolve()", () => {
    it("should resolve a valid slash command", () => {
      const cmd = new StubCommand("model", "Model", ["m"]);
      registry.register(cmd);

      const result = registry.resolve("/model claude-opus");
      expect(result).not.toBeNull();
      expect(result!.command).toBe(cmd);
      expect(result!.args.command).toBe("model");
      expect(result!.args.positionals).toEqual(["claude-opus"]);
    });

    it("should resolve via alias", () => {
      const cmd = new StubCommand("model", "Model", ["m"]);
      registry.register(cmd);

      const result = registry.resolve("/m claude-opus");
      expect(result).not.toBeNull();
      expect(result!.command).toBe(cmd);
      expect(result!.args.command).toBe("m");
    });

    it("should return null for unknown slash command", () => {
      expect(registry.resolve("/nonexistent")).toBeNull();
    });

    it("should return null for non-slash input", () => {
      registry.register(new StubCommand("clear", "Clear"));
      expect(registry.resolve("clear")).toBeNull();
      expect(registry.resolve("hello world")).toBeNull();
    });

    it("should parse flags in resolved command", () => {
      registry.register(new StubCommand("config", "Config"));

      const result = registry.resolve("/config --key=theme");
      expect(result).not.toBeNull();
      expect(result!.args.flags).toEqual({ key: "theme" });
    });

    it("should parse quoted args in resolved command", () => {
      registry.register(new StubCommand("config", "Config"));

      const result = registry.resolve('/config description "hello world"');
      expect(result).not.toBeNull();
      expect(result!.args.positionals).toEqual(["description", "hello world"]);
    });

    it("should return null for / alone (empty command)", () => {
      registry.register(new StubCommand("clear", "Clear"));
      expect(registry.resolve("/")).toBeNull();
    });
  });
});
