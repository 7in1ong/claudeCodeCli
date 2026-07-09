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
  };
}

/**
 * Print full CLI usage help to stdout.
 *
 * NOTE: The REPL command list below is manually maintained and must be
 * kept in sync with the commands registered in registerBuiltInCommands()
 * (see src/commands/index.ts). The in-REPL /help command auto-generates
 * its listing from the registry, but this CLI --help output is static text.
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
  --help              Show this help message

${chalk.bold("Examples:")}
  claude-code                                   ${chalk.dim("# Start interactive REPL")}
  claude-code "explain async/await"             ${chalk.dim("# One-shot question")}
  claude-code --model claude-opus-4-20250514    ${chalk.dim("# Use a different model")}
  claude-code --api-key sk-xxx "hello"          ${chalk.dim("# Inline API key")}
  claude-code --yes "fix the bug in auth.ts"    ${chalk.dim("# Skip tool confirmations")}

${chalk.bold("Interactive REPL commands:")}
  /clear            ${chalk.dim("# Reset conversation history")}
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
