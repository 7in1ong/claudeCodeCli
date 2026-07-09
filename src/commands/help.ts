/**
 * /help Command
 *
 * Displays available slash commands, auto-generated from the registry.
 * Shows command name, aliases, argument usage (from ArgDefinition),
 * and description.
 *
 * Uses console.log directly (rather than renderer.renderHelp) because
 * the Renderer interface's help method only supports {name, description}
 * pairs, while the command framework provides richer argument info.
 */

import chalk from "chalk";
import { SlashCommand } from "./base.js";
import type { CommandContext } from "./context.js";
import type { ParsedArgs } from "./parser.js";
import type { SlashCommandRegistry } from "./registry.js";

/**
 * Creates a /help command bound to the given registry.
 *
 * The command needs access to the registry to enumerate all registered
 * commands and generate the help listing dynamically.
 */
export function createHelpCommand(registry: SlashCommandRegistry): SlashCommand {
  return new HelpCommand(registry);
}

class HelpCommand extends SlashCommand {
  readonly name = "help";
  readonly description = "Show this help";

  private registry: SlashCommandRegistry;

  constructor(registry: SlashCommandRegistry) {
    super();
    this.registry = registry;
  }

  async execute(_args: ParsedArgs, _context: CommandContext): Promise<void> {
    const commands = this.registry.list().sort((a, b) => a.name.localeCompare(b.name));

    console.log(chalk.dim("  Commands:"));

    for (const cmd of commands) {
      const aliases = cmd.aliases?.length ? chalk.dim(` (${cmd.aliases.join(", ")})`) : "";
      const usage = formatUsage(cmd);
      const name = `/${cmd.name}${usage}`;
      // Pad the name column to align descriptions
      const paddedName = name.length < 20 ? name.padEnd(20) : name + " ";
      console.log(chalk.dim(`    ${paddedName}`) + aliases + chalk.dim(`— ${cmd.description}`));

      // Show argument details if defined
      if (cmd.args && cmd.args.length > 0) {
        for (const arg of cmd.args) {
          const required = arg.required ? chalk.dim(" (required)") : "";
          const kind = arg.kind === "flag" ? `--${arg.name}` : `<${arg.name}>`;
          console.log(chalk.dim(`      ${kind.padEnd(16)} ${arg.description}${required}`));
        }
      }
    }

    console.log(chalk.dim(""));
    console.log(chalk.dim('  Use "\\" at end of line for multi-line input,'));
    console.log(chalk.dim('  then "." on its own line to finish.'));
  }
}

/**
 * Format the usage string for a command based on its ArgDefinition[].
 * E.g. "/model <name>" or "/config <key> [value]"
 */
function formatUsage(cmd: SlashCommand): string {
  if (!cmd.args || cmd.args.length === 0) return "";

  const parts = cmd.args.map((arg) => {
    if (arg.kind === "flag") {
      return arg.required ? `--${arg.name} <val>` : `[--${arg.name}]`;
    }
    return arg.required ? `<${arg.name}>` : `[${arg.name}]`;
  });

  return " " + parts.join(" ");
}
