/**
 * CLI Argument Parsing
 *
 * Parses command-line arguments using node:util parseArgs and returns
 * a typed CliOptions object. Also contains the --help printer since
 * help text is tightly coupled to the option definitions.
 */

import { parseArgs } from "node:util";
import chalk from "chalk";
import { DEFAULT_MODEL } from "../config/defaults.js";

/**
 * Parsed CLI options.
 */
export interface CliOptions {
  model: string;
  apiKey?: string;
  message?: string;
  yes: boolean;
  help: boolean;
  tui: boolean;
  plain: boolean;
}

/**
 * Parse process.argv into a CliOptions object.
 */
export function parseCliArgs(): CliOptions {
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
      yes: {
        type: "boolean",
        short: "y",
        default: false,
      },
      help: {
        type: "boolean",
        default: false,
      },
      tui: {
        type: "boolean",
        default: false,
      },
      plain: {
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
    yes: values.yes as boolean,
    help: values.help as boolean,
    tui: values.tui as boolean,
    plain: values.plain as boolean,
  };
}

/**
 * Print full CLI usage help to stdout.
 */
export function printHelp(): void {
  const help = `
${chalk.bold("Claude Code CLI")} - An interactive CLI for Claude AI

${chalk.bold("Usage:")}
  claude-code [options] [message]

${chalk.bold("Options:")}
  --model <model>     Model to use          ${chalk.dim(`(default: ${DEFAULT_MODEL})`)}
  --api-key <key>     Anthropic API key     ${chalk.dim("(or set ANTHROPIC_API_KEY)")}
  -m, --message <msg> Send a single message and exit
  -y, --yes           Auto-approve tool actions (skip confirmation prompts)
  --tui               Force TUI mode (panel layout, Markdown rendering)
  --plain             Force plain text mode (no TUI)
  --help              Show this help message

${chalk.bold("Examples:")}
  claude-code                                   ${chalk.dim("# Start interactive TUI")}
  claude-code --plain                           ${chalk.dim("# Start in plain text mode")}
  claude-code "explain async/await"             ${chalk.dim("# One-shot question")}
  claude-code --model claude-opus-4-20250514    ${chalk.dim("# Use a different model")}
  claude-code --api-key sk-xxx "hello"          ${chalk.dim("# Inline API key")}
  claude-code --yes "fix the bug in auth.ts"    ${chalk.dim("# Skip tool confirmations")}

${chalk.bold("Interactive REPL commands:")}
  /clear            ${chalk.dim("# Reset conversation history")}
  /help             ${chalk.dim("# Show REPL help")}
  exit, quit, :q    ${chalk.dim("# Exit the REPL")}

${chalk.bold("TUI Features (enabled by default in terminal):")}
  Panel layout      ${chalk.dim("# Conversation, tools, and status panels")}
  Markdown render   ${chalk.dim("# AI replies rendered with Markdown formatting")}
  Input history     ${chalk.dim("# Up/Down arrows to browse previous inputs")}
  Code highlighting ${chalk.dim("# Syntax highlighting in code blocks")}
  Auto-degrade      ${chalk.dim("# Falls back to plain mode in CI/pipes")}

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
