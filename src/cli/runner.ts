/**
 * CLI Runner
 *
 * Slim orchestrator that wires the split CLI modules together:
 *   1. Parse CLI arguments (args.ts)
 *   2. Initialize tools and LLM client
 *   3. Dispatch to one-shot mode or the interactive REPL (repl.ts)
 *
 * Features:
 *   - --model / --api-key / --message / --theme flags
 *   - Positional args concatenated as a one-shot message
 *   - Interactive REPL with multi-line input (trailing \)
 *   - Ctrl+C graceful exit, Ctrl+D (EOF) exit
 *   - /clear, /help, and /theme slash commands
 *   - Mock mode when no API key is configured
 *   - Full integration: getClient() → ConversationManager → streamMessage → ToolExecutor
 * All rendering goes through the Renderer abstraction (ui/).
 * The agentic conversation loop lives in agentic-loop.ts.
 */

import chalk from "chalk";
import ora from "ora";
import { getClient, ConversationManager } from "../llm/index.js";
import type { ModelId } from "../llm/index.js";
import { ToolRegistry, ToolExecutor, registerBuiltInTools } from "../tools/index.js";
import { ConfirmationHandler } from "./confirm.js";
import { ConfigManager } from "../config/config-manager.js";
import { getActiveTheme, setActiveTheme, listThemeNames } from "../ui/themes/index.js";
import {
  SlashCommandRegistry,
  registerBuiltInCommands,
} from "../commands/index.js";
import type { CommandContext, CommandConfig } from "../commands/context.js";

// ---------------------------------------------------------------------------
// Default system prompt
// ---------------------------------------------------------------------------

const DEFAULT_SYSTEM_PROMPT = [
  "You are Claude Code, an interactive CLI assistant powered by Anthropic Claude.",
  "You help users with programming tasks: writing, reviewing, debugging, and",
  "refactoring code. You can read/write files, execute shell commands, and list",
  "directory contents using the available tools.",
  "",
  "Be concise, accurate, and practical. Prefer working code over explanations.",
  "When using tools, explain what you're doing briefly.",
].join(" ");

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

interface CliOptions {
  model: string;
  apiKey?: string;
  message?: string;
  theme?: string;
  yes: boolean;
  help: boolean;
}

function parseCliArgs(): CliOptions {
  const { values, positionals } = parseArgs({
    options: {
      model: {
        type: "string",
        default: DEFAULT_MODEL,
      },
      "api-key": {
        type: "string",
      },
      message: {
        type: "string",
        short: "m",
      },
      theme: {
        type: "string",
      },
      yes: {
        type: "boolean",
        short: "y",
        default: false,
      },
      help: {
        type: "boolean",
        default: false,
      },
    },
    allowPositionals: true,
    strict: true,
  });

  // Positional args form a one-shot message (e.g. `claude-code "what is 2+2?"`)
  const positionalMessage =
    positionals.length > 0 ? positionals.join(" ") : undefined;

  return {
    model: values.model as string,
    apiKey: values["api-key"] as string | undefined,
    message: (values.message as string | undefined) ?? positionalMessage,
    theme: values.theme as string | undefined,
    yes: values.yes as boolean,
    help: values.help as boolean,
  };
}

// ---------------------------------------------------------------------------
// Main entry
// ---------------------------------------------------------------------------
import { parseCliArgs, printHelp } from "./args.js";
import { processUserMessage } from "./agentic-loop.js";
import { mockResponse } from "./mock.js";
import { startRepl } from "./repl.js";
import { PlainRenderer } from "../ui/index.js";
import { DEFAULT_SYSTEM_PROMPT } from "../config/defaults.js";

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
    console.log(chalk.yellow(`  Unknown theme "${themeName}", using default.`));
    setActiveTheme("default");
  }
  // Persist the theme choice only when it is valid and came from --theme flag
  if (options.theme && setActiveTheme(options.theme)) {
    configManager.set("theme", options.theme);
  }

  const theme = getActiveTheme();

  // ── Initialize tool registry and confirmation handler ────────────────
  const registry = new ToolRegistry();
  registerBuiltInTools(registry);

  // ── Initialize slash command registry ─────────────────────────────────
  const commandRegistry = new SlashCommandRegistry();
  registerBuiltInCommands(commandRegistry);

  const confirmHandler = new ConfirmationHandler({
    autoApprove: options.yes,
  });
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
    theme.colors.success(
      `Claude Code CLI ready. ${registry.size} tool(s) registered: ` +
        registry.list().map((t) => t.name).join(", ") +
        (options.yes ? theme.colors.dim("  (--yes: auto-approve enabled)") : ""),
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

    await startRepl(options.model, llmAvailable, registry, executor, configManager);
    await startRepl(options.model, llmAvailable, registry, executor, commandRegistry, commandConfig);
    await startRepl(options.model, llmAvailable, registry, executor, renderer);
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
  const theme = getActiveTheme();
  console.log(theme.colors.user("You: ") + message);
  renderer.renderUserMessage(message);

  if (!llmAvailable) {
    console.log(theme.colors.assistant(mockResponse(message)));
    return;
  }

  const conversation = new ConversationManager({
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
  });
  await processUserMessage(message, conversation, registry, executor);
}

// ---------------------------------------------------------------------------
// Conversation loop — the core integration glue
//
// User message → ConversationManager → streamMessage → display text
//   → if tool_use: ToolExecutor → tool_results → ConversationManager
//   → stream again → repeat until no more tool_use
// ---------------------------------------------------------------------------

async function processUserMessage(
  input: string,
  conversation: ConversationManager,
  registry: ToolRegistry,
  executor: ToolExecutor,
): Promise<void> {
  const theme = getActiveTheme();

  conversation.addUserMessage(input);

  // Truncate old messages when context window is exceeded
  if (conversation.needsTruncation()) {
    const removed = conversation.truncate();
    console.log(
      theme.colors.warning(
        `\n  (context truncated: dropped ${removed} old messages to stay within limits)`,
      ),
    );
  }

  // Loop until the model stops calling tools (agentic loop)
  let hasToolUse = true;
  while (hasToolUse) {
    const callbacks: StreamCallbacks = {
      onTextDelta: (text) => {
        process.stdout.write(theme.colors.assistant(text));
      },
      onToolUseStart: ({ name }) => {
        console.log(
          theme.colors.tool(`\n  [Tool] ${name}`) + theme.colors.dim(" — executing..."),
        );
      },
      onToolUseComplete: ({ name, input }) => {
        console.log(
          theme.colors.dim(`  [Tool] ${name} — input: `) +
            theme.colors.dim(truncate(JSON.stringify(input), 120)),
        );
      },
      onError: (error) => {
        console.error(theme.colors.error(`\n  ${classifyApiError(error)}`));
      },
    };

    const result = await streamMessage(
      {
        messages: [...conversation.getMessages()],
        systemPrompt: conversation.getSystemPrompt(),
        tools: registry.toAnthropicTools(),
        maxTokens: 4096,
      },
      callbacks,
    );

    // End of text block — visual separator
    console.log();

    // Record assistant response in conversation history
    conversation.addAssistantMessage(result.message.content);

    if (result.hasToolUse && executor) {
      // Execute tools and feed results back to the model
      const toolResults = await executor.executeTools(result.message.content);

      for (const tr of toolResults) {
        const content =
          typeof tr.content === "string"
            ? tr.content
            : JSON.stringify(tr.content);
        const isError = tr.is_error ?? false;
        console.log(
          theme.colors.toolResult("  [Tool Result] ") +
            (isError
              ? theme.colors.error(truncate(content, 200))
              : theme.colors.dim(truncate(content, 200))),
        );

        // Record tool result in conversation (as a user-role message with
        // tool_result blocks, per Anthropic API requirements)
        const trParam = tr as ToolResultBlockParam;
        conversation.addToolResult(
          trParam.tool_use_id,
          typeof trParam.content === "string"
            ? trParam.content
            : JSON.stringify(trParam.content),
          isError,
        );
      }

      console.log(); // blank line before next streamed response
    }

    hasToolUse = result.hasToolUse;
  }
}

// ---------------------------------------------------------------------------
// Mock response (no API key configured)
// ---------------------------------------------------------------------------

function mockResponse(message: string): string {
  return [
    "[Mock Mode] Received your message:",
    "",
    `  "${message}"`,
    "",
    "Set ANTHROPIC_API_KEY or pass --api-key to get real responses from Claude.",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Interactive REPL
// ---------------------------------------------------------------------------

async function startRepl(
  model: string,
  llmAvailable: boolean,
  registry: ToolRegistry,
  executor: ToolExecutor,
  configManager: ConfigManager,
  commandRegistry: SlashCommandRegistry,
  commandConfig: CommandConfig,
): Promise<void> {
  const theme = getActiveTheme();

  const conversation = new ConversationManager({
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
  });

  printBanner(model, llmAvailable);

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: theme.colors.prompt("> "),
    terminal: true,
  });

  // Build the command context once — shared across all command invocations
  const commandContext: CommandContext = {
    conversation: conversation,
    toolRegistry: registry,
    config: commandConfig,
    requestExit: () => rl.close(),
  };

  // Ctrl+C → graceful exit
  rl.on("SIGINT", () => {
    console.log(theme.colors.dim("\nGoodbye!"));
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
        await handleUserInput(fullInput, conversation, llmAvailable, registry, executor, configManager);
      }
    } else if (trimmed.trim()) {
      await handleUserInput(trimmed, conversation, llmAvailable, registry, executor, configManager);
        await handleUserInput(fullInput, conversation, llmAvailable, registry, executor, commandRegistry, commandContext);
      }
    } else if (trimmed.trim()) {
      await handleUserInput(trimmed, conversation, llmAvailable, registry, executor, commandRegistry, commandContext);
    }

    rl.prompt();
  });

  // EOF (Ctrl+D) — close gracefully
  rl.on("close", () => {
    console.log(theme.colors.dim("Goodbye!"));
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

  console.log(theme.colors.dim('  (multi-line mode: enter "." on its own line to finish)'));

  return new Promise<string>((resolve) => {
    rl.setPrompt(theme.colors.warning("... "));
    rl.prompt();

    const onLine = (line: string) => {
      if (line.trim() === ".") {
        rl.setPrompt(theme.colors.prompt("> "));
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
  configManager: ConfigManager,
): Promise<void> {
  const theme = getActiveTheme();

  // ── Slash commands ───────────────────────────────────────────────────
  if (input === "/clear") {
    conversation.reset();
    console.log(theme.colors.warning("  Conversation cleared."));
    return;
  }
  if (input === "/help") {
    printReplHelp();
  commandRegistry: SlashCommandRegistry,
  commandContext: CommandContext,
): Promise<void> {
  // ── Slash commands (via registry) ────────────────────────────────────
  if (input.startsWith("/")) {
    const resolved = commandRegistry.resolve(input);
    if (resolved) {
      await resolved.command.execute(resolved.args, commandContext);
      return;
    }
    // Unknown slash command — show a helpful message
    console.log(chalk.red(`  Unknown command: ${input.split(/\s+/)[0]}`));
    console.log(chalk.dim('  Type "/help" for available commands.'));
    return;
  }
  if (input.startsWith("/theme")) {
    handleThemeCommand(input, configManager);
    return;
  }

  // ── Exit commands (non-slash: exit, quit, :q, :qa) ──────────────────
  if (isExitCommand(input)) {
    console.log(theme.colors.dim("Goodbye!"));
    process.exit(0);
  }

  // ── Display user message ─────────────────────────────────────────────
  console.log(theme.colors.user("You: ") + input);

  // ── Process through LLM or mock ──────────────────────────────────────
  if (!llmAvailable) {
    console.log(theme.colors.assistant(mockResponse(input)));
    return;
  }

  try {
    await processUserMessage(input, conversation, registry, executor);
  } catch (error) {
    const friendly = classifyApiError(error);
    console.error(theme.colors.error(`\n${friendly}`));
  }

  console.log(); // blank line between exchanges
}

// ---------------------------------------------------------------------------
// /theme command
// ---------------------------------------------------------------------------

/**
 * Handle the /theme slash command.
 *
 *   /theme           — list available themes and show the active one
 *   /theme <name>    — switch to the named theme (immediate + persisted)
 */
function handleThemeCommand(input: string, configManager: ConfigManager): void {
  const theme = getActiveTheme();
  const parts = input.trim().split(/\s+/);
  const requestedName = parts[1];

  if (!requestedName) {
    // List available themes
    const names = listThemeNames();
    console.log(theme.colors.dim("  Available themes:"));
    for (const name of names) {
      const marker = name === theme.name ? theme.colors.success(" ● ") : theme.colors.dim("   ");
      console.log(marker + (name === theme.name ? theme.colors.success(name) : name));
    }
    console.log(theme.colors.dim(`  Use "/theme <name>" to switch.`));
    return;
  }

  if (setActiveTheme(requestedName)) {
    configManager.set("theme", requestedName);
    const newTheme = getActiveTheme();
    console.log(newTheme.colors.success(`  Theme switched to "${newTheme.displayName}".`));
  } else {
    const available = listThemeNames().join(", ");
    console.log(theme.colors.warning(`  Unknown theme "${requestedName}". Available: ${available}`));
  }
}

// ---------------------------------------------------------------------------
// Help / banner
// ---------------------------------------------------------------------------

function printHelp(): void {
  // Help is printed before theme is loaded, so use chalk directly
  const help = `
${chalk.bold("Claude Code CLI")} - An interactive CLI for Claude AI

${chalk.bold("Usage:")}
  claude-code [options] [message]

${chalk.bold("Options:")}
  --model <model>     Model to use          ${chalk.dim(`(default: ${DEFAULT_MODEL})`)}
  --api-key <key>     Anthropic API key     ${chalk.dim("(or set ANTHROPIC_API_KEY)")}
  -m, --message <msg> Send a single message and exit
  --theme <name>      Theme to use          ${chalk.dim("(default, dark, light)")}
  -y, --yes           Auto-approve tool actions (skip confirmation prompts)
  --help              Show this help message

${chalk.bold("Examples:")}
  claude-code                                   ${chalk.dim("# Start interactive REPL")}
  claude-code "explain async/await"             ${chalk.dim("# One-shot question")}
  claude-code --model claude-opus-4-20250514    ${chalk.dim("# Use a different model")}
  claude-code --theme dark                      ${chalk.dim("# Use dark theme")}
  claude-code --api-key sk-xxx "hello"          ${chalk.dim("# Inline API key")}
  claude-code --yes "fix the bug in auth.ts"    ${chalk.dim("# Skip tool confirmations")}

${chalk.bold("Interactive REPL commands:")}
  /clear            ${chalk.dim("# Reset conversation history")}
  /theme            ${chalk.dim("# List available themes")}
  /theme <name>     ${chalk.dim("# Switch theme (persisted)")}
  /help             ${chalk.dim("# Show REPL help")}
  /help             ${chalk.dim("# Show all available commands")}
  /model <name>     ${chalk.dim("# Switch LLM model at runtime")}
  /theme <name>     ${chalk.dim("# Switch CLI theme")}
  /config [k] [v]   ${chalk.dim("# View or modify configuration")}
  /status           ${chalk.dim("# Show current CLI status")}
  /tools            ${chalk.dim("# List available tools")}
  exit, quit, :q    ${chalk.dim("# Exit the REPL")}

${chalk.bold("Available tools:")}
  read_file         ${chalk.dim("# Read file contents (with line numbers)")}
  write_file        ${chalk.dim("# Create or overwrite files")}
  bash              ${chalk.dim("# Execute shell commands")}
  list_files        ${chalk.dim("# List directory contents (supports glob)")}

  ${chalk.dim("Tools that modify files or execute commands will ask for confirmation")}
  ${chalk.dim("unless --yes is passed.")}
`.trimStart();

  console.log(help);
}

function printReplHelp(): void {
  const theme = getActiveTheme();
  console.log(theme.colors.dim("  Commands:"));
  console.log(theme.colors.dim("    /clear   — Reset conversation history"));
  console.log(theme.colors.dim("    /theme   — List available themes"));
  console.log(theme.colors.dim("    /theme <name> — Switch theme (persisted)"));
  console.log(theme.colors.dim("    /help    — Show this help"));
  console.log(theme.colors.dim("    exit     — Exit the REPL (or Ctrl+C, Ctrl+D)"));
  console.log(theme.colors.dim('  Use "\\" at end of line for multi-line input,'));
  console.log(theme.colors.dim('  then "." on its own line to finish.'));
}

function printBanner(model: string, llmAvailable: boolean): void {
  const theme = getActiveTheme();
  const modeLabel = llmAvailable
    ? theme.colors.success("API connected")
    : theme.colors.warning("Mock mode");

  console.log(
    theme.colors.bannerTitle("\n  Claude Code CLI") + theme.colors.bannerMeta(" v0.1.0"),
  );
  console.log(theme.colors.bannerMeta(`  Model: ${model}  •  Theme: ${theme.displayName}  •  ${modeLabel}`));
  console.log(
    theme.colors.bannerMeta(
      '  Type a message to chat. "\\" at end of line for multi-line input.',
    ),
  );
  console.log(
    theme.colors.bannerMeta('  Type "/help" for commands, or "exit" to quit.\n'),
  );
}

// ---------------------------------------------------------------------------
// Error classification — friendly messages for common API errors
// ---------------------------------------------------------------------------

/**
 * Convert an API error into a user-friendly message with actionable hints.
 *
 * Handles:
 *   - 401 Authentication (invalid/missing API key)
 *   - 403 Forbidden (key lacks permission)
 *   - 404 Not found (invalid model)
 *   - 429 Rate limit
 *   - 5xx Server errors
 *   - Network errors (ECONNREFUSED, ECONNRESET, ETIMEDOUT, ENOTFOUND)
 */
function classifyApiError(error: unknown): string {
  if (!(error instanceof Error)) {
    return "Error: Unknown error occurred";
  }

  const status = (error as { status?: number }).status;
  const message = error.message ?? "";

  // ── HTTP status-based errors ─────────────────────────────────────────
  if (status === 401) {
    return [
      "Authentication failed: your API key is invalid or expired.",
      "",
      "  Fix: Set the ANTHROPIC_API_KEY environment variable, or pass --api-key.",
      "  Get a key at: https://console.anthropic.com/settings/keys",
    ].join("\n");
  }

  if (status === 403) {
    return [
      "Access denied: your API key does not have permission for this action.",
      "",
      "  Fix: Check your API key's permissions at https://console.anthropic.com",
    ].join("\n");
  }

  if (status === 404) {
    return `Model not found: the requested model may not exist. Check --model and try again.\n  Details: ${message}`;
  }

  if (status === 429) {
    return [
      "Rate limit exceeded — too many requests.",
      "",
      "  Fix: Wait a moment and try again. The CLI will auto-retry on transient limits.",
    ].join("\n");
  }

  if (status !== undefined && status >= 500) {
    return `Anthropic API server error (${status}). The service may be experiencing issues.\n  Fix: Wait a moment and try again.`;
  }

  // ── Network-level errors ─────────────────────────────────────────────
  if (
    message.includes("ECONNREFUSED") ||
    message.includes("ENOTFOUND") ||
    message.includes("getaddrinfo")
  ) {
    return [
      "Cannot connect to the Anthropic API.",
      "",
      "  Fix: Check your internet connection and DNS settings.",
      "  If behind a proxy, set HTTPS_PROXY or pass --base-url.",
    ].join("\n");
  }

  if (message.includes("ETIMEDOUT") || message.includes("timeout")) {
    return [
      "Connection timed out while reaching the Anthropic API.",
      "",
      "  Fix: Check your network connection. If behind a slow proxy,",
      "  try increasing the timeout or using a direct connection.",
    ].join("\n");
  }

  if (message.includes("ECONNRESET") || message.includes("socket hang up")) {
    return "Connection to the Anthropic API was reset. Retrying automatically on the next message.";
  }

  // ── Fallback ─────────────────────────────────────────────────────────
  return `Error: ${message}`;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isExitCommand(input: string): boolean {
  const cmd = input.trim().toLowerCase();
  return cmd === "exit" || cmd === "quit" || cmd === ":q" || cmd === ":qa";
}

function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + "...";
  await processUserMessage(message, conversation, registry, executor, renderer);
}
