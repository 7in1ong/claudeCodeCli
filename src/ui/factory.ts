/**
 * Renderer Factory
 *
 * Creates the appropriate Renderer based on CLI flags and environment.
 *
 * Priority:
 *   1. Explicit --tui flag → InkRenderer
 *   2. Explicit --plain flag → PlainRenderer
 *   3. CI environment variable → PlainRenderer
 *   4. Non-TTY stdout (pipes, redirects) → PlainRenderer
 *   5. Default → InkRenderer (TTY interactive terminal)
 */

import type { Renderer } from "./renderer.js";
import { PlainRenderer } from "./plain-renderer.js";
import { InkRenderer } from "./ink-renderer.js";

export type RendererMode = "tui" | "plain";

/**
 * Detect whether TUI mode should be used.
 */
export function detectRendererMode(flags: {
  tui?: boolean;
  plain?: boolean;
}): RendererMode {
  if (flags.tui) return "tui";
  if (flags.plain) return "plain";

  // CI environments should never use TUI
  if (process.env.CI || process.env.GITHUB_ACTIONS || process.env.GITLAB_CI) {
    return "plain";
  }

  // Non-TTY stdout means we're being piped or redirected
  if (!process.stdout.isTTY) {
    return "plain";
  }

  return "tui";
}

/**
 * Create a Renderer instance based on the detected or forced mode.
 */
export function createRenderer(
  mode: RendererMode,
  options?: { autoApprove?: boolean },
): Renderer {
  switch (mode) {
    case "tui":
      return new InkRenderer(options);
    case "plain":
    default:
      return new PlainRenderer();
  }
}
