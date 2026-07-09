/**
 * /exit Command
 *
 * Signals the REPL loop to exit. Handles the exit/quit/:q/:qa family
 * of exit commands through a single command with aliases.
 *
 * Note: :q and :qa are handled separately since they don't start with /,
 * but the slash variant /exit is registered here. The runner's isExitCommand()
 * still catches bare exit/quit/:q/:qa inputs.
 */

import chalk from "chalk";
import { SlashCommand } from "./base.js";
import type { CommandContext } from "./context.js";
import type { ParsedArgs } from "./parser.js";

export class ExitCommand extends SlashCommand {
  readonly name = "exit";
  readonly aliases = ["quit"];
  readonly description = "Exit the REPL (or Ctrl+C, Ctrl+D)";

  async execute(_args: ParsedArgs, context: CommandContext): Promise<void> {
    console.log(chalk.dim("Goodbye!"));
    context.requestExit();
  }
}
