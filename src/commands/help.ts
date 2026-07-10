/**
 * /help Command
 *
 * Displays available slash commands, auto-generated from the registry.
 */

import { SlashCommand } from "./base.js";
import type { CommandContext } from "./context.js";
import type { ParsedArgs } from "./parser.js";
import type { SlashCommandRegistry } from "./registry.js";
import { getActiveTheme } from "../ui/themes/index.js";

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
    const theme = getActiveTheme();
    const commands = this.registry.list().sort((a, b) => a.name.localeCompare(b.name));

    console.log(theme.colors.dim("  Commands:"));

    for (const cmd of commands) {
      const aliases = cmd.aliases?.length
        ? theme.colors.dim(` (${cmd.aliases.join(", ")})`)
        : "";
      const name = `/${cmd.name}`;
      console.log(
        theme.colors.dim(`    ${name.padEnd(16)}`) +
          aliases +
          theme.colors.dim(` — ${cmd.description}`),
      );
    }

    console.log(theme.colors.dim(""));
    console.log(theme.colors.dim('  Use "\\" at end of line for multi-line input,'));
    console.log(theme.colors.dim('  then "." on its own line to finish.'));
  }
}
