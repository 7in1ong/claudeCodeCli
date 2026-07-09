/**
 * Mock Response
 *
 * Generates a canned response when no Anthropic API key is configured.
 * Allows the REPL to remain functional for UI verification even
 * without a live API connection.
 */

/**
 * Return a mock response for the given user message.
 */
export function mockResponse(message: string): string {
  return [
    "[Mock Mode] Received your message:",
    "",
    `  "${message}"`,
    "",
    "Set ANTHROPIC_API_KEY or pass --api-key to get real responses from Claude.",
  ].join("\n");
}
