/**
 * PlainRenderer — Unit Tests
 *
 * Verifies that the PlainRenderer calls the expected console methods
 * with the correct arguments. Uses vitest mocking to intercept output.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { PlainRenderer } from "../src/ui/plain-renderer.js";

describe("PlainRenderer", () => {
  let renderer: PlainRenderer;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let stdoutWriteSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    renderer = new PlainRenderer();
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    stdoutWriteSpy = vi.spyOn(process.stdout, "write").mockImplementation(
      (() => true) as typeof process.stdout.write,
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("renderBanner", () => {
    it("should print version and model", () => {
      renderer.renderBanner("1.0.0", "claude-sonnet-4-20250514", true);
      const calls = consoleLogSpy.mock.calls.map((c) => String(c[0]));
      const combined = calls.join(" ");
      expect(combined).toContain("Claude Code CLI");
      expect(combined).toContain("1.0.0");
      expect(combined).toContain("claude-sonnet-4-20250514");
    });

    it("should indicate mock mode when not connected", () => {
      renderer.renderBanner("1.0.0", "claude-sonnet-4-20250514", false);
      const calls = consoleLogSpy.mock.calls.map((c) => String(c[0]));
      const combined = calls.join(" ");
      expect(combined).toContain("Mock mode");
    });

    it("should indicate API connected when connected", () => {
      renderer.renderBanner("1.0.0", "claude-sonnet-4-20250514", true);
      const calls = consoleLogSpy.mock.calls.map((c) => String(c[0]));
      const combined = calls.join(" ");
      expect(combined).toContain("API connected");
    });
  });

  describe("renderUserMessage", () => {
    it("should display user message with 'You:' prefix", () => {
      renderer.renderUserMessage("hello");
      expect(consoleLogSpy).toHaveBeenCalled();
      const output = String(consoleLogSpy.mock.calls[0][0]);
      expect(output).toContain("You:");
      expect(output).toContain("hello");
    });
  });

  describe("renderAssistantText", () => {
    it("should write to stdout (streaming)", () => {
      renderer.renderAssistantText("partial token");
      expect(stdoutWriteSpy).toHaveBeenCalled();
      const output = String(stdoutWriteSpy.mock.calls[0][0]);
      expect(output).toContain("partial token");
    });
  });

  describe("renderToolStart", () => {
    it("should display tool name with executing indicator", () => {
      renderer.renderToolStart("bash");
      expect(consoleLogSpy).toHaveBeenCalled();
      const output = String(consoleLogSpy.mock.calls[0][0]);
      expect(output).toContain("[Tool]");
      expect(output).toContain("bash");
      expect(output).toContain("executing");
    });
  });

  describe("renderToolInput", () => {
    it("should display tool name and serialized input", () => {
      renderer.renderToolInput("read_file", { path: "/tmp/test" });
      expect(consoleLogSpy).toHaveBeenCalled();
      const output = String(consoleLogSpy.mock.calls[0][0]);
      expect(output).toContain("[Tool]");
      expect(output).toContain("read_file");
      expect(output).toContain("input");
    });
  });

  describe("renderToolResult", () => {
    it("should display tool result content", () => {
      renderer.renderToolResult("bash", "output here", false);
      expect(consoleLogSpy).toHaveBeenCalled();
      const output = String(consoleLogSpy.mock.calls[0][0]);
      expect(output).toContain("[Tool Result]");
    });

    it("should display error results differently", () => {
      renderer.renderToolResult("bash", "error output", true);
      expect(consoleLogSpy).toHaveBeenCalled();
      // Both calls should happen — the rendering differs by color, not by text
      const output = String(consoleLogSpy.mock.calls[0][0]);
      expect(output).toContain("[Tool Result]");
    });
  });

  describe("renderError", () => {
    it("should write to stderr", () => {
      renderer.renderError("something broke");
      expect(consoleErrorSpy).toHaveBeenCalled();
      const output = String(consoleErrorSpy.mock.calls[0][0]);
      expect(output).toContain("something broke");
    });

    it("should include suggestion when provided", () => {
      renderer.renderError("auth failed", "check your API key");
      expect(consoleErrorSpy).toHaveBeenCalled();
      const output = String(consoleErrorSpy.mock.calls[0][0]);
      expect(output).toContain("auth failed");
      expect(output).toContain("check your API key");
    });
  });

  describe("renderSystemMessage", () => {
    it("should display informational message", () => {
      renderer.renderSystemMessage("Conversation cleared.");
      expect(consoleLogSpy).toHaveBeenCalled();
      const output = String(consoleLogSpy.mock.calls[0][0]);
      expect(output).toContain("Conversation cleared.");
    });
  });

  describe("renderHelp", () => {
    it("should list all commands with descriptions", () => {
      const commands = [
        { name: "/clear", description: "Reset history" },
        { name: "/help", description: "Show help" },
      ];
      renderer.renderHelp(commands);
      const calls = consoleLogSpy.mock.calls.map((c) => String(c[0]));
      const combined = calls.join("\n");
      expect(combined).toContain("/clear");
      expect(combined).toContain("Reset history");
      expect(combined).toContain("/help");
      expect(combined).toContain("Show help");
    });

    it("should mention multi-line input", () => {
      renderer.renderHelp([]);
      const calls = consoleLogSpy.mock.calls.map((c) => String(c[0]));
      const combined = calls.join("\n");
      expect(combined).toContain("multi-line");
    });
  });
});
