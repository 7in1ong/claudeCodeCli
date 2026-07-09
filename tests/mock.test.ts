/**
 * Mock Response — Unit Tests
 *
 * Verifies that mockResponse() returns the expected canned output
 * for various inputs.
 */

import { describe, it, expect } from "vitest";
import { mockResponse } from "../src/cli/mock.js";

describe("mockResponse", () => {
  it("should include the user's message in the output", () => {
    const result = mockResponse("hello world");
    expect(result).toContain("hello world");
  });

  it("should indicate mock mode", () => {
    const result = mockResponse("test");
    expect(result).toContain("[Mock Mode]");
  });

  it("should suggest setting ANTHROPIC_API_KEY", () => {
    const result = mockResponse("test");
    expect(result).toContain("ANTHROPIC_API_KEY");
  });

  it("should mention the --api-key flag", () => {
    const result = mockResponse("test");
    expect(result).toContain("--api-key");
  });

  it("should handle empty message", () => {
    const result = mockResponse("");
    expect(result).toContain("[Mock Mode]");
    expect(result).toContain('""');
  });
});
