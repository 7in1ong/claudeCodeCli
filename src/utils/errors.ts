/**
 * Error Classification Utilities
 *
 * Converts raw API / network errors into user-friendly messages with
 * actionable suggestions. Extracted from runner.ts so it can be reused
 * by both the agentic loop and the REPL error handler.
 */

/**
 * Convert an API error into a user-friendly message with actionable hints.
 *
 * Handles:
 *   - 401 Authentication (invalid/missing API key)
 *   - 403 Forbidden (key lacks permission)
 *   - 404 Not found (invalid model)
 *   - 429 Rate limit
 *   - 5xx Server errors
 *   - Network errors (ECONNREFUSED, ECONNRESET, ETIMEDOUT, ENOTFOUND)
 */
export function classifyApiError(error: unknown): string {
  if (!(error instanceof Error)) {
    return "Error: Unknown error occurred";
  }

  const status = (error as { status?: number }).status;
  const message = error.message ?? "";

  // ── HTTP status-based errors ─────────────────────────────────────────
  if (status === 401) {
    return [
      "Authentication failed: your API key is invalid or expired.",
      "",
      "  Fix: Set the ANTHROPIC_API_KEY environment variable, or pass --api-key.",
      "  Get a key at: https://console.anthropic.com/settings/keys",
    ].join("\n");
  }

  if (status === 403) {
    return [
      "Access denied: your API key does not have permission for this action.",
      "",
      "  Fix: Check your API key's permissions at https://console.anthropic.com",
    ].join("\n");
  }

  if (status === 404) {
    return `Model not found: the requested model may not exist. Check --model and try again.\n  Details: ${message}`;
  }

  if (status === 429) {
    return [
      "Rate limit exceeded — too many requests.",
      "",
      "  Fix: Wait a moment and try again. The CLI will auto-retry on transient limits.",
    ].join("\n");
  }

  if (status !== undefined && status >= 500) {
    return `Anthropic API server error (${status}). The service may be experiencing issues.\n  Fix: Wait a moment and try again.`;
  }

  // ── Network-level errors ─────────────────────────────────────────────
  if (
    message.includes("ECONNREFUSED") ||
    message.includes("ENOTFOUND") ||
    message.includes("getaddrinfo")
  ) {
    return [
      "Cannot connect to the Anthropic API.",
      "",
      "  Fix: Check your internet connection and DNS settings.",
      "  If behind a proxy, set HTTPS_PROXY or pass --base-url.",
    ].join("\n");
  }

  if (message.includes("ETIMEDOUT") || message.includes("timeout")) {
    return [
      "Connection timed out while reaching the Anthropic API.",
      "",
      "  Fix: Check your network connection. If behind a slow proxy,",
      "  try increasing the timeout or using a direct connection.",
    ].join("\n");
  }

  if (message.includes("ECONNRESET") || message.includes("socket hang up")) {
    return "Connection to the Anthropic API was reset. Retrying automatically on the next message.";
  }

  // ── Fallback ─────────────────────────────────────────────────────────
  return `Error: ${message}`;
}
