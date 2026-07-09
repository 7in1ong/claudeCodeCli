/**
 * CLI Runner
 *
 * Slim orchestrator that wires the split CLI modules together:
 *   1. Parse CLI arguments (args.ts)
 *   2. Initialize tools and LLM client
 *   3. Dispatch to one-shot mode or the interactive REPL (repl.ts)
 *
 * All rendering goes through the Renderer abstraction (ui/).
 * The agentic conversation loop lives in agentic-loop.ts.
 *
 * Renderer selection:
 *   - One-shot mode (-m) always uses PlainRenderer
 *   - Interactive mode auto-detects TTY → InkRenderer, CI/pipe → PlainRenderer
 *   - --tui / --plain flags force the choice
 */

import ora from "ora";
import { getClient, ConversationManager } from "../llm/index.js";
import type { ModelId } from "../llm/index.js";
import {
  ToolRegistry,
  ToolExecutor,
  registerBuiltInTools,
} from "../tools/index.js";
import type { Renderer } from "../ui/renderer.js";
import { ConfirmationHandler } from "./confirm.js";
import { parseCliArgs, printHelp } from "./args.js";
import { processUserMessage } from "./agentic-loop.js";
import { mockResponse } from "./mock.js";
import { startRepl } from "./repl.js";
import {
  createRenderer,
  detectRendererMode,
} from "../ui/factory.js";
import { DEFAULT_SYSTEM_PROMPT } from "../config/defaults.js";

export async function run(): Promise<void> {
  const options = parseCliArgs();

  // ── --help: show usage and exit ──────────────────────────────────────
  if (options.help) {
    printHelp();
    return;
  }

  // ── Initialize tool registry ─────────────────────────────────────────
  const registry = new ToolRegistry();
  registerBuiltInTools(registry);

  // ── Detect renderer mode ─────────────────────────────────────────────
  // One-shot mode always uses plain renderer (no interactive UI needed)
  const isOneShot = !!options.message;
  const rendererMode = isOneShot
    ? "plain" as const
    : detectRendererMode({ tui: options.tui, plain: options.plain });

  const renderer = createRenderer(rendererMode, {
    autoApprove: options.yes,
  });

  // ── Confirmation handler ─────────────────────────────────────────────
  // In TUI mode, delegate confirmation to the renderer's confirm() method.
  // In plain mode, use the readline-based ConfirmationHandler.
  const hasTuiConfirm =
    rendererMode === "tui" && typeof renderer.confirm === "function";

  const confirmHandler = hasTuiConfirm
    ? {
        confirm: (action: string, details: string) =>
          renderer.confirm!(action, details),
      }
    : new ConfirmationHandler({ autoApprove: options.yes });

  const executor = new ToolExecutor(registry, {
    confirmationHandler: confirmHandler,
  });

  const spinner = ora("Initializing Claude Code CLI...").start();

  // ── Initialize LLM client ────────────────────────────────────────────
  let llmAvailable = false;
  try {
    getClient({ apiKey: options.apiKey, model: options.model as ModelId });
    llmAvailable = true;
  } catch {
    // Mock mode — LLM calls will be stubbed out
  }

  // Stop spinner before renderer takes over the terminal
  spinner.stop();

  // ── Dispatch ─────────────────────────────────────────────────────────
  try {
    if (options.message) {
      await runOnce(
        options.message,
        llmAvailable,
        registry,
        executor,
        renderer,
      );
      return;
    }

    await startRepl(
      options.model,
      llmAvailable,
      registry,
      executor,
      renderer,
    );
  } finally {
    // Clean up readline-based confirmation handler
    if (confirmHandler instanceof ConfirmationHandler) {
      confirmHandler.close();
    }
    // Clean up renderer resources
    renderer.cleanup?.();
  }
}

/**
 * One-shot mode: process a single message and exit.
 */
async function runOnce(
  message: string,
  llmAvailable: boolean,
  registry: ToolRegistry,
  executor: ToolExecutor,
  renderer: Renderer,
): Promise<void> {
  renderer.renderUserMessage(message);

  if (!llmAvailable) {
    renderer.renderAssistantText(mockResponse(message));
    renderer.endStream?.();
    return;
  }

  const conversation = new ConversationManager({
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
  });
  await processUserMessage(
    message,
    conversation,
    registry,
    executor,
    renderer,
  );
}
