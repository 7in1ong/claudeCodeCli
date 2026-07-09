/**
 * CLI Runner
 *
 * Slim orchestrator that wires the split CLI modules together:
 *   1. Parse CLI arguments (args.ts)
 *   2. Initialize tools and LLM client
 *   3. Initialize slash command registry
 *   4. Dispatch to one-shot mode or the interactive REPL (repl.ts)
 *
 * All rendering goes through the Renderer abstraction (ui/).
 * The agentic conversation loop lives in agentic-loop.ts.
 */

import chalk from "chalk";
import ora from "ora";
import { getClient, ConversationManager } from "../llm/index.js";
import type { ModelId } from "../llm/index.js";
import { ToolRegistry, ToolExecutor, registerBuiltInTools } from "../tools/index.js";
import { ConfirmationHandler } from "./confirm.js";
import { parseCliArgs, printHelp } from "./args.js";
import { processUserMessage } from "./agentic-loop.js";
import { mockResponse } from "./mock.js";
import { startRepl } from "./repl.js";
import { PlainRenderer } from "../ui/index.js";
import { DEFAULT_SYSTEM_PROMPT } from "../config/defaults.js";
import {
  SlashCommandRegistry,
  registerBuiltInCommands,
} from "../commands/index.js";
import type { CommandConfig } from "../commands/context.js";

export async function run(): Promise<void> {
  const options = parseCliArgs();

  // ── --help: show usage and exit ──────────────────────────────────────
  if (options.help) {
    printHelp();
    return;
  }

  // ── Initialize tool registry and confirmation handler ────────────────
  const registry = new ToolRegistry();
  registerBuiltInTools(registry);

  // ── Initialize slash command registry ─────────────────────────────────
  const commandRegistry = new SlashCommandRegistry();
  registerBuiltInCommands(commandRegistry);

  const confirmHandler = new ConfirmationHandler({ autoApprove: options.yes });
  const executor = new ToolExecutor(registry, {
    confirmationHandler: confirmHandler,
  });

  const renderer = new PlainRenderer();
  const spinner = ora("Initializing Claude Code CLI...").start();

  // ── Initialize LLM client ────────────────────────────────────────────
  let llmAvailable = false;
  try {
    getClient({ apiKey: options.apiKey, model: options.model as ModelId });
    llmAvailable = true;
  } catch {
    // Mock mode — LLM calls will be stubbed out
  }

  spinner.succeed(
    chalk.green(
      `Claude Code CLI ready. ${registry.size} tool(s) registered: ` +
        registry.list().map((t) => t.name).join(", ") +
        (options.yes ? chalk.dim("  (--yes: auto-approve enabled)") : ""),
    ),
  );

  // ── Build shared command config ───────────────────────────────────────
  const commandConfig: CommandConfig = {
    model: options.model,
    theme: "default",
    llmAvailable,
  };

  // ── Dispatch ─────────────────────────────────────────────────────────
  try {
    if (options.message) {
      await runOnce(options.message, llmAvailable, registry, executor, renderer);
      return;
    }

    await startRepl(options.model, llmAvailable, registry, executor, renderer, commandRegistry, commandConfig);
  } finally {
    confirmHandler.close();
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
  renderer: PlainRenderer,
): Promise<void> {
  renderer.renderUserMessage(message);

  if (!llmAvailable) {
    console.log(chalk.cyan(mockResponse(message)));
    return;
  }

  const conversation = new ConversationManager({
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
  });
  await processUserMessage(message, conversation, registry, executor, renderer);
}
