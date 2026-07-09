/**
 * Error Classification — Unit Tests
 *
 * Verifies classifyApiError() produces user-friendly messages for
 * common API and network errors.
 */

import { describe, it, expect } from "vitest";
import { classifyApiError } from "../src/utils/errors.js";

describe("classifyApiError", () => {
  it("should return fallback for non-Error values", () => {
    expect(classifyApiError("string error")).toContain("Unknown error");
    expect(classifyApiError(null)).toContain("Unknown error");
    expect(classifyApiError(42)).toContain("Unknown error");
  });

  it("should handle 401 authentication errors", () => {
    const error = Object.assign(new Error("Unauthorized"), { status: 401 });
    const result = classifyApiError(error);
    expect(result).toContain("Authentication failed");
    expect(result).toContain("ANTHROPIC_API_KEY");
  });

  it("should handle 403 forbidden errors", () => {
    const error = Object.assign(new Error("Forbidden"), { status: 403 });
    const result = classifyApiError(error);
    expect(result).toContain("Access denied");
  });

  it("should handle 404 not found errors", () => {
    const error = Object.assign(new Error("model missing"), { status: 404 });
    const result = classifyApiError(error);
    expect(result).toContain("Model not found");
    expect(result).toContain("model missing");
  });

  it("should handle 429 rate limit errors", () => {
    const error = Object.assign(new Error("Too many requests"), { status: 429 });
    const result = classifyApiError(error);
    expect(result).toContain("Rate limit");
  });

  it("should handle 5xx server errors", () => {
    const error = Object.assign(new Error("Internal"), { status: 500 });
    const result = classifyApiError(error);
    expect(result).toContain("server error");
    expect(result).toContain("500");
  });

  it("should handle ECONNREFUSED network errors", () => {
    const error = new Error("connect ECONNREFUSED 127.0.0.1:443");
    const result = classifyApiError(error);
    expect(result).toContain("Cannot connect");
    expect(result).toContain("internet connection");
  });

  it("should handle ETIMEDOUT network errors", () => {
    const error = new Error("connect ETIMEDOUT");
    const result = classifyApiError(error);
    expect(result).toContain("timed out");
  });

  it("should handle ECONNRESET network errors", () => {
    const error = new Error("socket hang up");
    const result = classifyApiError(error);
    expect(result).toContain("reset");
  });

  it("should fall back to the error message for unknown errors", () => {
    const error = new Error("something weird happened");
    const result = classifyApiError(error);
    expect(result).toContain("something weird happened");
  });
});
