/**
 * LLM Client
 *
 * Wrapper around the Anthropic SDK for communicating with Claude.
 * Supports API key configuration via environment variable or parameter,
 * model selection, and base URL override for proxies/testing.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { ClientConfig, ModelId } from "./types.js";
import { DEFAULT_MODEL } from "./types.js";

let client: Anthropic | null = null;
let currentModel: ModelId = DEFAULT_MODEL;

/**
 * Get or create the Anthropic client instance.
 *
 * On first call, initializes the client using the provided config or
 * falls back to the ANTHROPIC_API_KEY environment variable.
 * Subsequent calls return the cached instance unless `resetClient` is called.
 *
 * @param config - Optional configuration overrides for this initialization.
 */
export function getClient(config?: ClientConfig): Anthropic {
  if (!client) {
    const apiKey = config?.apiKey ?? process.env["ANTHROPIC_API_KEY"];
    if (!apiKey) {
      throw new Error(
        "ANTHROPIC_API_KEY environment variable is not set. " +
          "Please set it before running the CLI, or pass it via the --api-key flag."
      );
    }

    const constructorOptions: ConstructorParameters<typeof Anthropic>[0] = {
      apiKey,
    };
    if (config?.baseUrl) {
      constructorOptions.baseURL = config.baseUrl;
    }

    client = new Anthropic(constructorOptions);
    currentModel = config?.model ?? DEFAULT_MODEL;
  }
  return client;
}

/**
 * Get the currently configured model identifier.
 */
export function getModel(): ModelId {
  return currentModel;
}

/**
 * Reset the client instance, forcing re-initialization on the next `getClient` call.
 * Useful when switching API keys or configurations at runtime.
 */
export function resetClient(): void {
  client = null;
  currentModel = DEFAULT_MODEL;
}
