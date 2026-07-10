/**
 * CLI Runner
 *
 * Slim orchestrator that wires the split CLI modules together:
 *   1. Parse CLI arguments (args.ts)
 *   2. Load configuration and apply theme (config-manager.ts + themes/)
 *   3. Initialize tools, slash commands, and confirmation handler
 *   4. Dispatch to one-shot mode or the interactive REPL (repl.ts)
 *
 * Features:
 *   - --model / --api-key / --message / --theme / --yes flags
 *   - Positional args concatenated as a one-shot message
 *   - Interactive REPL with multi-line input (trailing \)
 *   - Slash commands routed through SlashCommandRegistry
 *   - Ctrl+C graceful exit, Ctrl+D (EOF) exit
 *   - Mock mode when no API key is configured
 *   - All rendering goes through Renderer abstraction (ui/)
 *   - The agentic conversation loop lives in agentic-loop.ts
 */

import ora from "ora";
import { getClient, ConversationManager } from "../llm/index.js";
import type { ModelId } from "../llm/index.js";
import { ToolRegistry, ToolExecutor, registerBuiltInTools } from "../tools/index.js";
import { ConfirmationHandler } from "./confirm.js";
import { ConfigManager } from "../config/config-manager.js";
import { getActiveTheme, setActiveTheme } from "../ui/themes/index.js";
import {
  SlashCommandRegistry,
  registerBuiltInCommands,
} from "../commands/index.js";
import { setThemeConfigManager } from "../commands/theme.js";
import { setConfigCommandManager } from "../commands/config.js";
import { parseCliArgs, printHelp } from "./args.js";
import { processUserMessage } from "./agentic-loop.js";
import { mockResponse } from "./mock.js";
import { startRepl } from "./repl.js";
import { PlainRenderer } from "../ui/index.js";
import { DEFAULT_SYSTEM_PROMPT } from "../config/defaults.js";

// ---------------------------------------------------------------------------
// Main entry
// ---------------------------------------------------------------------------

export async function run(): Promise<void> {
  const options = parseCliArgs();

  // ── --help: show usage and exit ──────────────────────────────────────
  if (options.help) {
    printHelp();
    return;
  }

  // ── Load config and apply theme ──────────────────────────────────────
  const configManager = new ConfigManager();

  // CLI --theme flag overrides config; fall back to config value
  const themeName = options.theme ?? configManager.get("theme");
  if (!setActiveTheme(themeName)) {
    console.log(getActiveTheme().colors.warning(`  Unknown theme "${themeName}", using default.`));
    setActiveTheme("default");
  }
  // Persist the theme choice only when it is valid and came from --theme flag
  if (options.theme && setActiveTheme(options.theme)) {
    configManager.set("theme", options.theme);
  }

  const theme = getActiveTheme();

  // ── Initialize tool registry ─────────────────────────────────────────
  const toolRegistry = new ToolRegistry();
  registerBuiltInTools(toolRegistry);

  // ── Initialize slash command registry ─────────────────────────────────
  const commandRegistry = new SlashCommandRegistry();
  registerBuiltInCommands(commandRegistry);

  // Inject ConfigManager into commands that need persistence
  setThemeConfigManager(configManager);
  setConfigCommandManager(configManager);

  // ── Initialize confirmation handler and tool executor ────────────────
  const confirmHandler = new ConfirmationHandler({
    autoApprove: options.yes,
  });
  const executor = new ToolExecutor(toolRegistry, {
    confirmationHandler: confirmHandler,
  });

  // ── Initialize renderer ──────────────────────────────────────────────
  const renderer = new PlainRenderer();

  // ── Initialize LLM client ────────────────────────────────────────────
  let llmAvailable = false;
  try {
    getClient({ apiKey: options.apiKey, model: options.model as ModelId });
    llmAvailable = true;
  } catch {
    // Mock mode — LLM calls will be stubbed out
  }

  const spinner = ora("Initializing Claude Code CLI...").start();
  spinner.succeed(
    theme.colors.success(
      `Claude Code CLI ready. ${toolRegistry.size} tool(s) registered: ` +
        toolRegistry.list().map((t) => t.name).join(", ") +
        (options.yes ? theme.colors.dim("  (--yes: auto-approve enabled)") : ""),
    ),
  );

  // ── Dispatch ─────────────────────────────────────────────────────────
  try {
    if (options.message) {
      await runOnce(
        options.message,
        llmAvailable,
        toolRegistry,
        executor,
        renderer,
      );
      return;
    }

    await startRepl(
      options.model,
      llmAvailable,
      toolRegistry,
      executor,
      renderer,
      commandRegistry,
      configManager,
    );
  } finally {
    confirmHandler.close();
  }
}

// ---------------------------------------------------------------------------
// One-shot mode
// ---------------------------------------------------------------------------

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
  const theme = getActiveTheme();
  renderer.renderUserMessage(message);

  if (!llmAvailable) {
    console.log(theme.colors.assistant(mockResponse(message)));
    return;
  }

  const conversation = new ConversationManager({
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
  });
  await processUserMessage(message, conversation, registry, executor, renderer);
}
