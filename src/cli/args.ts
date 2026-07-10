/**
 * CLI Argument Parsing
 *
 * Parses command-line arguments using node:util parseArgs and returns
 * a typed CliOptions object. Also contains the --help printer since
 * help text is tightly coupled to the option definitions.
 */

import { parseArgs } from "node:util";
import { DEFAULT_MODEL } from "../config/defaults.js";
import { getActiveTheme } from "../ui/themes/index.js";

/**
 * Parsed CLI options.
 */
export interface CliOptions {
  model: string;
  apiKey?: string;
  message?: string;
  theme?: string;
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

/**
 * Print full CLI usage help to stdout.
 *
 * Uses the active theme for styling. Since the theme module registers
 * all built-in themes at import time, getActiveTheme() always returns
 * a valid theme even before config is loaded.
 */
export function printHelp(): void {
  const theme = getActiveTheme();
  const b = theme.colors.bannerTitle;
  const d = theme.colors.dim;
  const a = theme.colors.assistant;

  const help = `
${b("Claude Code CLI")} - An interactive CLI for Claude AI

${b("Usage:")}
  claude-code [options] [message]

${b("Options:")}
  --model <model>     Model to use          ${d(`(default: ${DEFAULT_MODEL})`)}
  --api-key <key>     Anthropic API key     ${d("(or set ANTHROPIC_API_KEY)")}
  -m, --message <msg> Send a single message and exit
  --theme <name>      Theme to use          ${d("(default, dark, light)")}
  -y, --yes           Auto-approve tool actions (skip confirmation prompts)
  --help              Show this help message

${b("Examples:")}
  claude-code                                   ${d("# Start interactive REPL")}
  claude-code ${a('"explain async/await"')}             ${d("# One-shot question")}
  claude-code --model ${a("claude-opus-4-20250514")}    ${d("# Use a different model")}
  claude-code --theme ${a("dark")}                      ${d("# Use dark theme")}
  claude-code --api-key ${a("sk-xxx")} ${a('"hello"')}          ${d("# Inline API key")}
  claude-code --yes ${a('"fix the bug in auth.ts"')}    ${d("# Skip tool confirmations")}

${b("Interactive REPL commands:")}
  /clear            ${d("# Reset conversation history")}
  /help             ${d("# Show REPL help")}
  /model <name>     ${d("# Switch LLM model at runtime")}
  /theme <name>     ${d("# Switch CLI theme")}
  /config [k] [v]   ${d("# View or modify configuration")}
  /status           ${d("# Show current CLI status")}
  /tools            ${d("# List available tools")}
  exit, quit, :q    ${d("# Exit the REPL")}

${b("Available tools:")}
  read_file         ${d("# Read file contents (with line numbers)")}
  write_file        ${d("# Create or overwrite files")}
  bash              ${d("# Execute shell commands")}
  list_files        ${d("# List directory contents (supports glob)")}

  ${d("Tools that modify files or execute commands will ask for confirmation")}
  ${d("unless --yes is passed.")}
`.trimStart();

  console.log(help);
}
