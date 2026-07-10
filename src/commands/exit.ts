/**
 * /exit Command
 *
 * Signals the REPL loop to exit. Handles the exit/quit family
 * of exit commands through a single command with aliases.
 *
 * Note: :q and :qa are handled separately since they don't start with /,
 * but the slash variant /exit is registered here.
 */

import { SlashCommand } from "./base.js";
import type { CommandContext } from "./context.js";
import type { ParsedArgs } from "./parser.js";
import { getActiveTheme } from "../ui/themes/index.js";

export class ExitCommand extends SlashCommand {
  readonly name = "exit";
  readonly aliases = ["quit"];
  readonly description = "Exit the REPL (or Ctrl+C, Ctrl+D)";

  async execute(_args: ParsedArgs, context: CommandContext): Promise<void> {
    const theme = getActiveTheme();
    console.log(theme.colors.dim("Goodbye!"));
    context.requestExit();
  }
}
