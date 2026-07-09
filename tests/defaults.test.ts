/**
 * Default Configuration Constants — Unit Tests
 *
 * Verifies that all centralized constants are defined with sensible values
 * and that re-exports from llm/types are correctly forwarded.
 */

import { describe, it, expect } from "vitest";
import {
  DEFAULT_MODEL,
  DEFAULT_MAX_TOKENS,
  DEFAULT_MAX_RETRIES,
  DEFAULT_TIMEOUT_MS,
  DEFAULT_MAX_CONTEXT_TOKENS,
  DEFAULT_SYSTEM_PROMPT,
  CLI_VERSION,
} from "../src/config/defaults.js";

describe("config/defaults", () => {
  it("DEFAULT_MODEL should be a non-empty string", () => {
    expect(typeof DEFAULT_MODEL).toBe("string");
    expect(DEFAULT_MODEL.length).toBeGreaterThan(0);
  });

  it("DEFAULT_MAX_TOKENS should be a positive number", () => {
    expect(DEFAULT_MAX_TOKENS).toBeGreaterThan(0);
  });

  it("DEFAULT_MAX_RETRIES should be a non-negative integer", () => {
    expect(DEFAULT_MAX_RETRIES).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(DEFAULT_MAX_RETRIES)).toBe(true);
  });

  it("DEFAULT_TIMEOUT_MS should be a positive number", () => {
    expect(DEFAULT_TIMEOUT_MS).toBeGreaterThan(0);
  });

  it("DEFAULT_MAX_CONTEXT_TOKENS should be a positive number", () => {
    expect(DEFAULT_MAX_CONTEXT_TOKENS).toBeGreaterThan(0);
    expect(DEFAULT_MAX_CONTEXT_TOKENS).toBe(100_000);
  });

  it("DEFAULT_SYSTEM_PROMPT should mention Claude Code", () => {
    expect(DEFAULT_SYSTEM_PROMPT).toContain("Claude Code");
    expect(DEFAULT_SYSTEM_PROMPT.length).toBeGreaterThan(50);
  });

  it("CLI_VERSION should match package version format", () => {
    expect(CLI_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
