/**
 * Interactive REPL
 *
 * Manages the interactive loop with two modes:
 *
 * 1. **Readline mode** (PlainRenderer): Uses node:readline for input.
 *    Supports multi-line input (trailing backslash), slash commands,
 *    and graceful exit on Ctrl+C / Ctrl+D.
 *
 * 2. **TUI mode** (InkRenderer): Delegates to `renderer.startInteractive()`
 *    which owns stdin via Ink's React-based input system. The handler
 *    callback routes input through the same slash command / LLM pipeline.
 *
 * Both modes share the same `handleUserInput()` function for input routing.
 */

import { createInterface, type Interface as ReadlineInterface } from "node:readline";
import chalk from "chalk";
import { ConversationManager } from "../llm/index.js";
import { ToolRegistry, ToolExecutor } from "../tools/index.js";
import type { Renderer } from "../ui/renderer.js";
import { processUserMessage } from "./agentic-loop.js";
import { mockResponse } from "./mock.js";
import { classifyApiError } from "../utils/errors.js";
import { DEFAULT_SYSTEM_PROMPT, CLI_VERSION } from "../config/defaults.js";

/**
 * REPL command descriptors passed to Renderer.renderHelp().
 */
const REPL_COMMANDS = [
  { name: "/clear", description: "Reset conversation history" },
  { name: "/help", description: "Show this help" },
  { name: "exit", description: "Exit the REPL (or Ctrl+C, Ctrl+D)" },
];

/**
 * Start the interactive REPL.
 *
 * When the renderer supports `startInteractive()` (TUI mode), delegates
 * input handling to the renderer. Otherwise, uses readline.
 */
export async function startRepl(
  model: string,
  llmAvailable: boolean,
  registry: ToolRegistry,
  executor: ToolExecutor,
  renderer: Renderer,
): Promise<void> {
  const conversation = new ConversationManager({
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
  });

  renderer.renderBanner(CLI_VERSION, model, llmAvailable);

  // Build the input handler shared by both modes
  const inputHandler = async (input: string): Promise<void> => {
    await handleUserInput(
      input,
      conversation,
      llmAvailable,
      registry,
      executor,
      renderer,
    );
  };

  // ── TUI mode: delegate to renderer's interactive system ─────────────
  if (typeof renderer.startInteractive === "function") {
    await renderer.startInteractive(inputHandler);
    return;
  }

  // ── Readline mode (PlainRenderer) ──────────────────────────────────
  await startReadlineRepl(inputHandler, renderer);
}

/**
 * Readline-based REPL for PlainRenderer.
 */
async function startReadlineRepl(
  inputHandler: (input: string) => Promise<void>,
  renderer: Renderer,
): Promise<void> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: chalk.green("> "),
    terminal: true,
  });

  // Ctrl+C → graceful exit
  rl.on("SIGINT", () => {
    renderer.renderSystemMessage("\nGoodbye!");
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
        await inputHandler(fullInput);
      }
    } else if (trimmed.trim()) {
      await inputHandler(trimmed);
    }

    rl.prompt();
  });

  // EOF (Ctrl+D) — close gracefully
  rl.on("close", () => {
    renderer.renderSystemMessage("Goodbye!");
    process.exit(0);
  });
}

/**
 * Read continuation lines for a multi-line input.
 * The user enters multi-line mode by ending a line with '\'.
 * They finish input by entering '.' on its own line.
 */
async function readMultiLine(
  rl: ReadlineInterface,
  firstLine: string,
): Promise<string> {
  const lines: string[] = [firstLine];

  console.log(
    chalk.dim('  (multi-line mode: enter "." on its own line to finish)'),
  );

  return new Promise<string>((resolve) => {
    rl.setPrompt(chalk.yellow("... "));
    rl.prompt();

    const onLine = (line: string) => {
      if (line.trim() === ".") {
        rl.setPrompt(chalk.green("> "));
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
 * Route user input: handle slash commands, then delegate to LLM or mock.
 */
async function handleUserInput(
  input: string,
  conversation: ConversationManager,
  llmAvailable: boolean,
  registry: ToolRegistry,
  executor: ToolExecutor,
  renderer: Renderer,
): Promise<void> {
  // ── Slash commands ───────────────────────────────────────────────────
  if (input === "/clear") {
    conversation.reset();
    renderer.renderSystemMessage("  Conversation cleared.");
    return;
  }
  if (input === "/help") {
    renderer.renderHelp(REPL_COMMANDS);
    return;
  }

  // ── Exit commands ────────────────────────────────────────────────────
  if (isExitCommand(input)) {
    renderer.renderSystemMessage("Goodbye!");
    process.exit(0);
  }

  // ── Display user message ─────────────────────────────────────────────
  renderer.renderUserMessage(input);

  // ── Process through LLM or mock ──────────────────────────────────────
  if (!llmAvailable) {
    renderer.renderAssistantText(mockResponse(input));
    renderer.endStream?.();
    return;
  }

  try {
    await processUserMessage(
      input,
      conversation,
      registry,
      executor,
      renderer,
    );
  } catch (error) {
    const friendly = classifyApiError(error);
    renderer.renderError(friendly);
  }

  renderer.renderNewline(); // blank line between exchanges
}

/**
 * Detect common exit commands.
 */
function isExitCommand(input: string): boolean {
  const cmd = input.trim().toLowerCase();
  return cmd === "exit" || cmd === "quit" || cmd === ":q" || cmd === ":qa";
}
