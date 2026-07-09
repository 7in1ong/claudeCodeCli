/**
 * /help Command
 *
 * Displays available slash commands, auto-generated from the registry.
 * Migrated from the hardcoded printReplHelp() in runner.ts.
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
      const name = `/${cmd.name}`;
      console.log(chalk.dim(`    ${name.padEnd(16)}`) + aliases + chalk.dim(` — ${cmd.description}`));
    }

    console.log(chalk.dim(""));
    console.log(chalk.dim('  Use "\\" at end of line for multi-line input,'));
    console.log(chalk.dim('  then "." on its own line to finish.'));
  }
}
