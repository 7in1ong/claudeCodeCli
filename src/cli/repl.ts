/**
 * Interactive REPL
 *
 * Manages the readline-based interactive loop: prompt display,
 * multi-line input continuation, slash command routing via the
 * SlashCommandRegistry, exit detection, and dispatching user input
 * to either mock mode or the agentic loop.
 *
 * All colors go through the active Theme so theme switches take
 * effect immediately.
 */

import { createInterface, type Interface as ReadlineInterface } from "node:readline";
import { ConversationManager } from "../llm/index.js";
import { ToolRegistry, ToolExecutor } from "../tools/index.js";
import type { Renderer } from "../ui/renderer.js";
import { getActiveTheme } from "../ui/themes/index.js";
import type { ConfigManager } from "../config/config-manager.js";
import {
  SlashCommandRegistry,
} from "../commands/index.js";
import type { CommandContext, CommandConfig } from "../commands/context.js";
import { processUserMessage } from "./agentic-loop.js";
import { mockResponse } from "./mock.js";
import { classifyApiError } from "../utils/errors.js";
import { DEFAULT_SYSTEM_PROMPT, CLI_VERSION } from "../config/defaults.js";

/**
 * Start the interactive REPL.
 *
 * Sets up readline, prints the banner, and enters the input loop.
 * Handles multi-line input (trailing backslash), slash commands via
 * the registry, and graceful exit on Ctrl+C / Ctrl+D.
 */
export async function startRepl(
  model: string,
  llmAvailable: boolean,
  registry: ToolRegistry,
  executor: ToolExecutor,
  renderer: Renderer,
  commandRegistry: SlashCommandRegistry,
  configManager: ConfigManager,
): Promise<void> {
  const theme = getActiveTheme();

  const conversation = new ConversationManager({
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
  });

  renderer.renderBanner(CLI_VERSION, model, llmAvailable);

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: theme.colors.prompt("> "),
    terminal: true,
  });

  // Build the command context shared across all command invocations
  const commandConfig: CommandConfig = {
    model,
    theme: theme.name,
    llmAvailable,
  };

  const commandContext: CommandContext = {
    conversation,
    toolRegistry: registry,
    config: commandConfig,
    requestExit: () => rl.close(),
  };

  // Ctrl+C → graceful exit
  rl.on("SIGINT", () => {
    const t = getActiveTheme();
    console.log(t.colors.dim("\nGoodbye!"));
    rl.close();
  });

  rl.prompt();

  rl.on("line", async (line: string) => {
    const trimmed = line.trimEnd();

    // Multi-line input: trailing backslash continues on the next line
    if (trimmed.endsWith("\\")) {
      const firstPart = trimmed.slice(0, -1);
      const fullInput = await readMultiLine(rl, firstPart);
      if (fullInput.trim()) {
        await handleUserInput(
          fullInput,
          conversation,
          llmAvailable,
          registry,
          executor,
          renderer,
          commandRegistry,
          commandContext,
          configManager,
        );
      }
    } else if (trimmed.trim()) {
      await handleUserInput(
        trimmed,
        conversation,
        llmAvailable,
        registry,
        executor,
        renderer,
        commandRegistry,
        commandContext,
        configManager,
      );
    }

    // Update prompt in case theme changed
    rl.setPrompt(getActiveTheme().colors.prompt("> "));
    rl.prompt();
  });

  // EOF (Ctrl+D) — close gracefully
  rl.on("close", () => {
    const t = getActiveTheme();
    console.log(t.colors.dim("Goodbye!"));
    process.exit(0);
  });
}

/**
 * Read continuation lines for a multi-line input.
 * The user enters multi-line mode by ending a line with '\'.
 * They finish input by entering '.' on a line by itself.
 */
async function readMultiLine(
  rl: ReadlineInterface,
  firstLine: string,
): Promise<string> {
  const lines: string[] = [firstLine];
  const theme = getActiveTheme();

  console.log(
    theme.colors.dim('  (multi-line mode: enter "." on its own line to finish)'),
  );

  return new Promise<string>((resolve) => {
    rl.setPrompt(theme.colors.warning("... "));
    rl.prompt();

    const onLine = (line: string) => {
      if (line.trim() === ".") {
        rl.setPrompt(getActiveTheme().colors.prompt("> "));
        rl.removeListener("line", onLine);
        resolve(lines.join("\n"));
      } else {
        lines.push(line);
        rl.prompt();
      }
    };

    rl.on("line", onLine);
  });
}

/**
 * Route user input: handle slash commands via the registry, then delegate to LLM or mock.
 */
async function handleUserInput(
  input: string,
  conversation: ConversationManager,
  llmAvailable: boolean,
  registry: ToolRegistry,
  executor: ToolExecutor,
  renderer: Renderer,
  commandRegistry: SlashCommandRegistry,
  commandContext: CommandContext,
  configManager: ConfigManager,
): Promise<void> {
  const theme = getActiveTheme();

  // ── Slash commands (via registry) ────────────────────────────────────
  if (input.startsWith("/")) {
    const resolved = commandRegistry.resolve(input);
    if (resolved) {
      await resolved.command.execute(resolved.args, commandContext);

      // After /theme command, update the commandContext config
      commandContext.config.theme = getActiveTheme().name;
      return;
    }
    // Unknown slash command — show a helpful message
    console.log(theme.colors.error(`  Unknown command: ${input.split(/\s+/)[0]}`));
    console.log(theme.colors.dim('  Type "/help" for available commands.'));
    return;
  }

  // ── Exit commands (non-slash: exit, quit, :q, :qa) ──────────────────
  if (isExitCommand(input)) {
    console.log(theme.colors.dim("Goodbye!"));
    process.exit(0);
  }

  // ── Display user message ─────────────────────────────────────────────
  renderer.renderUserMessage(input);

  // ── Process through LLM or mock ──────────────────────────────────────
  if (!llmAvailable) {
    console.log(theme.colors.assistant(mockResponse(input)));
    return;
  }

  try {
    await processUserMessage(input, conversation, registry, executor, renderer);
  } catch (error) {
    const friendly = classifyApiError(error);
    renderer.renderError(friendly);
  }

  console.log(); // blank line between exchanges
}

/**
 * Detect common exit commands.
 */
function isExitCommand(input: string): boolean {
  const cmd = input.trim().toLowerCase();
  return cmd === "exit" || cmd === "quit" || cmd === ":q" || cmd === ":qa";
}
