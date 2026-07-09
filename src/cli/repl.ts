/**
 * Interactive REPL
 *
 * Manages the readline-based interactive loop: prompt display,
 * multi-line input continuation, slash command routing (/clear, /help),
 * exit detection, and dispatching user input to either mock mode
 * or the agentic loop.
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
 * Sets up readline, prints the banner, and enters the input loop.
 * Handles multi-line input (trailing backslash), slash commands,
 * and graceful exit on Ctrl+C / Ctrl+D.
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
        await handleUserInput(fullInput, conversation, llmAvailable, registry, executor, renderer);
      }
    } else if (trimmed.trim()) {
      await handleUserInput(trimmed, conversation, llmAvailable, registry, executor, renderer);
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
 * They finish input by entering '.' on a line by itself.
 */
async function readMultiLine(
  rl: ReadlineInterface,
  firstLine: string,
): Promise<string> {
  const lines: string[] = [firstLine];

  console.log(chalk.dim('  (multi-line mode: enter "." on its own line to finish)'));

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
    console.log(chalk.cyan(mockResponse(input)));
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
