/**
 * /exit Command
 *
 * Signals the REPL loop to exit. Handles /exit and /quit via aliases.
 * Bare exit/quit/:q/:qa inputs are still caught by repl.ts's isExitCommand().
 */

import { SlashCommand } from "./base.js";
import type { CommandContext } from "./context.js";
import type { ParsedArgs } from "./parser.js";

export class ExitCommand extends SlashCommand {
  readonly name = "exit";
  readonly aliases = ["quit"];
  readonly description = "Exit the REPL (or Ctrl+C, Ctrl+D)";

  async execute(_args: ParsedArgs, context: CommandContext): Promise<void> {
    context.renderer.renderSystemMessage("Goodbye!");
    context.requestExit();
  }
}
