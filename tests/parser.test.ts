/**
 * Slash Command Parser Unit Tests
 *
 * Covers: basic positional args, --flag parsing, --flag=value syntax,
 * quoted string support (single and double), edge cases (empty input,
 * bare command, whitespace handling), and ArgDefinition validation.
 */

import { describe, it, expect } from "vitest";
import { parseCommandInput, validateArgs } from "../src/commands/parser.js";
import type { ArgDefinition } from "../src/commands/base.js";

describe("parseCommandInput", () => {
  // ---------------------------------------------------------------------------
  // Basic command extraction
  // ---------------------------------------------------------------------------
  describe("command extraction", () => {
    it("should extract command name from /command", () => {
      const result = parseCommandInput("/clear");
      expect(result.command).toBe("clear");
      expect(result.positionals).toEqual([]);
      expect(result.flags).toEqual({});
    });

    it("should extract command name without leading /", () => {
      const result = parseCommandInput("clear");
      expect(result.command).toBe("clear");
    });

    it("should handle empty input", () => {
      const result = parseCommandInput("");
      expect(result.command).toBe("");
      expect(result.positionals).toEqual([]);
      expect(result.flags).toEqual({});
    });

    it("should handle whitespace-only input", () => {
      const result = parseCommandInput("   ");
      expect(result.command).toBe("");
    });

    it("should handle / alone", () => {
      const result = parseCommandInput("/");
      expect(result.command).toBe("");
    });

    it("should trim leading and trailing whitespace", () => {
      const result = parseCommandInput("  /clear  ");
      expect(result.command).toBe("clear");
    });
  });

  // ---------------------------------------------------------------------------
  // Positional arguments
  // ---------------------------------------------------------------------------
  describe("positional arguments", () => {
    it("should parse a single positional argument", () => {
      const result = parseCommandInput("/model claude-opus");
      expect(result.command).toBe("model");
      expect(result.positionals).toEqual(["claude-opus"]);
    });

    it("should parse multiple positional arguments", () => {
      const result = parseCommandInput("/config key value");
      expect(result.command).toBe("config");
      expect(result.positionals).toEqual(["key", "value"]);
    });

    it("should handle extra whitespace between positional args", () => {
      const result = parseCommandInput("/config   key    value");
      expect(result.positionals).toEqual(["key", "value"]);
    });

    it("should parse three positional args", () => {
      const result = parseCommandInput("/cmd a b c");
      expect(result.positionals).toEqual(["a", "b", "c"]);
    });
  });

  // ---------------------------------------------------------------------------
  // --flag style named arguments
  // ---------------------------------------------------------------------------
  describe("--flag arguments", () => {
    it("should parse --flag value", () => {
      const result = parseCommandInput("/config --key theme");
      expect(result.command).toBe("config");
      expect(result.positionals).toEqual([]);
      expect(result.flags).toEqual({ key: "theme" });
    });

    it("should parse boolean flag (--flag alone)", () => {
      const result = parseCommandInput("/status --verbose");
      expect(result.flags).toEqual({ verbose: true });
    });

    it("should parse boolean flag when followed by another flag", () => {
      const result = parseCommandInput("/status --verbose --json");
      expect(result.flags).toEqual({ verbose: true, json: true });
    });

    it("should parse mixed positional and flag arguments", () => {
      const result = parseCommandInput("/model claude-opus --verbose");
      expect(result.positionals).toEqual(["claude-opus"]);
      expect(result.flags).toEqual({ verbose: true });
    });

    it("should parse multiple flags with values", () => {
      const result = parseCommandInput("/cmd --key val1 --other val2");
      expect(result.flags).toEqual({ key: "val1", other: "val2" });
    });

    it("should treat --flag as boolean when it is the last token", () => {
      const result = parseCommandInput("/cmd --flag");
      expect(result.flags).toEqual({ flag: true });
    });
  });

  // ---------------------------------------------------------------------------
  // --flag=value syntax
  // ---------------------------------------------------------------------------
  describe("--flag=value syntax", () => {
    it("should parse --flag=value", () => {
      const result = parseCommandInput("/config --key=theme");
      expect(result.flags).toEqual({ key: "theme" });
    });

    it("should parse --flag= with empty value", () => {
      const result = parseCommandInput("/config --key=");
      expect(result.flags).toEqual({ key: "" });
    });

    it("should parse --flag=value with = in the value", () => {
      const result = parseCommandInput("/config --key=a=b");
      expect(result.flags).toEqual({ key: "a=b" });
    });

    it("should mix --flag=value with positional args", () => {
      const result = parseCommandInput("/model claude-opus --max-tokens=4096");
      expect(result.positionals).toEqual(["claude-opus"]);
      expect(result.flags).toEqual({ "max-tokens": "4096" });
    });

    it("should mix --flag=value with --flag value", () => {
      const result = parseCommandInput("/cmd --a=1 --b 2");
      expect(result.flags).toEqual({ a: "1", b: "2" });
    });
  });

  // ---------------------------------------------------------------------------
  // Quoted string support
  // ---------------------------------------------------------------------------
  describe("quoted strings", () => {
    it("should parse double-quoted positional argument", () => {
      const result = parseCommandInput('/config description "hello world"');
      expect(result.positionals).toEqual(["description", "hello world"]);
    });

    it("should parse single-quoted positional argument", () => {
      const result = parseCommandInput("/config description 'hello world'");
      expect(result.positionals).toEqual(["description", "hello world"]);
    });

    it("should parse quoted flag value with --flag value", () => {
      const result = parseCommandInput('/cmd --msg "hello world"');
      expect(result.flags).toEqual({ msg: "hello world" });
    });

    it("should parse quoted flag value with --flag=value", () => {
      const result = parseCommandInput('/cmd --msg="hello world"');
      expect(result.flags).toEqual({ msg: "hello world" });
    });

    it("should handle unclosed double quote (consumes rest of string)", () => {
      const result = parseCommandInput('/config description "hello world');
      expect(result.positionals).toEqual(["description", "hello world"]);
    });

    it("should handle unclosed single quote (consumes rest of string)", () => {
      const result = parseCommandInput("/config description 'hello world");
      expect(result.positionals).toEqual(["description", "hello world"]);
    });

    it("should handle multiple quoted strings", () => {
      const result = parseCommandInput('/cmd "first arg" "second arg"');
      expect(result.positionals).toEqual(["first arg", "second arg"]);
    });

    it("should handle quoted strings with special characters", () => {
      const result = parseCommandInput('/config key "value with --flags and = signs"');
      expect(result.positionals).toEqual(["key", "value with --flags and = signs"]);
    });

    it("should handle empty quoted string", () => {
      const result = parseCommandInput('/cmd "" other');
      expect(result.positionals).toEqual(["", "other"]);
    });
  });

  // ---------------------------------------------------------------------------
  // Edge cases
  // ---------------------------------------------------------------------------
  describe("edge cases", () => {
    it("should handle command with only whitespace after it", () => {
      const result = parseCommandInput("/clear   ");
      expect(result.command).toBe("clear");
      expect(result.positionals).toEqual([]);
    });

    it("should handle command with tabs", () => {
      const result = parseCommandInput("/model\tclaude-opus");
      expect(result.command).toBe("model");
      expect(result.positionals).toEqual(["claude-opus"]);
    });

    it("should handle -- as a flag with empty key", () => {
      const result = parseCommandInput("/cmd --");
      expect(result.flags).toEqual({ "": true });
    });

    it("should handle flag value that looks like a command", () => {
      const result = parseCommandInput('/cmd --run "ls -la /tmp"');
      expect(result.flags).toEqual({ run: "ls -la /tmp" });
    });
  });
});

// ---------------------------------------------------------------------------
// validateArgs
// ---------------------------------------------------------------------------
describe("validateArgs", () => {
  it("should return no errors when no arg definitions are provided", () => {
    const parsed = parseCommandInput("/clear");
    expect(validateArgs(parsed, undefined)).toEqual([]);
  });

  it("should return no errors when arg definitions are empty", () => {
    const parsed = parseCommandInput("/clear");
    expect(validateArgs(parsed, [])).toEqual([]);
  });

  it("should return no errors when all required positional args are present", () => {
    const parsed = parseCommandInput("/model claude-opus");
    const defs: ArgDefinition[] = [
      { name: "name", description: "Model name", required: true, kind: "positional" },
    ];
    expect(validateArgs(parsed, defs)).toEqual([]);
  });

  it("should return error when required positional arg is missing", () => {
    const parsed = parseCommandInput("/model");
    const defs: ArgDefinition[] = [
      { name: "name", description: "Model name", required: true, kind: "positional" },
    ];
    const errors = validateArgs(parsed, defs);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain("name");
  });

  it("should return no errors when all required flags are present", () => {
    const parsed = parseCommandInput("/cmd --key value");
    const defs: ArgDefinition[] = [
      { name: "key", description: "Config key", required: true, kind: "flag" },
    ];
    expect(validateArgs(parsed, defs)).toEqual([]);
  });

  it("should return error when required flag is missing", () => {
    const parsed = parseCommandInput("/cmd");
    const defs: ArgDefinition[] = [
      { name: "key", description: "Config key", required: true, kind: "flag" },
    ];
    const errors = validateArgs(parsed, defs);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain("--key");
  });

  it("should ignore optional arguments that are missing", () => {
    const parsed = parseCommandInput("/model");
    const defs: ArgDefinition[] = [
      { name: "name", description: "Model name", required: false, kind: "positional" },
    ];
    expect(validateArgs(parsed, defs)).toEqual([]);
  });

  it("should report multiple errors for multiple missing required args", () => {
    const parsed = parseCommandInput("/cmd");
    const defs: ArgDefinition[] = [
      { name: "a", description: "first", required: true, kind: "positional" },
      { name: "b", description: "second", required: true, kind: "positional" },
    ];
    const errors = validateArgs(parsed, defs);
    expect(errors).toHaveLength(2);
  });

  it("should validate mixed positional and flag required args", () => {
    const parsed = parseCommandInput("/cmd hello");
    const defs: ArgDefinition[] = [
      { name: "key", description: "key", required: true, kind: "positional" },
      { name: "mode", description: "mode", required: true, kind: "flag" },
    ];
    const errors = validateArgs(parsed, defs);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain("--mode");
  });

  it("should default to positional kind when kind is not specified", () => {
    const parsed = parseCommandInput("/cmd");
    const defs: ArgDefinition[] = [
      { name: "value", description: "a value", required: true },
    ];
    const errors = validateArgs(parsed, defs);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain("value");
  });
});
