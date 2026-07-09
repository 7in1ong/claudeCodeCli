/**
 * LLM Client
 *
 * Wrapper around the Anthropic SDK for communicating with Claude.
 */

import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;

/**
 * Get or create the Anthropic client instance.
 * Requires ANTHROPIC_API_KEY environment variable to be set.
 */
export function getClient(): Anthropic {
  if (!client) {
    const apiKey = process.env["ANTHROPIC_API_KEY"];
    if (!apiKey) {
      throw new Error(
        "ANTHROPIC_API_KEY environment variable is not set. " +
          "Please set it before running the CLI."
      );
    }
    client = new Anthropic({ apiKey });
  }
  return client;
}
