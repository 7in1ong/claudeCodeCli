/**
 * /clear Command
 *
 * Resets the conversation history, clearing all messages and counters.
 * Migrated from the hardcoded handler in runner.ts.
 */

import chalk from "chalk";
import { SlashCommand } from "./base.js";
import type { CommandContext } from "./context.js";
import type { ParsedArgs } from "./parser.js";

export class ClearCommand extends SlashCommand {
  readonly name = "clear";
  readonly description = "Reset conversation history";

  async execute(_args: ParsedArgs, context: CommandContext): Promise<void> {
    context.conversation.reset();
    console.log(chalk.yellow("  Conversation cleared."));
  }
}
