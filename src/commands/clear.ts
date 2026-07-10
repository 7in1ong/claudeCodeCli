/**
 * /clear Command
 *
 * Resets the conversation history, clearing all messages and counters.
 */

import { SlashCommand } from "./base.js";
import type { CommandContext } from "./context.js";
import type { ParsedArgs } from "./parser.js";
import { getActiveTheme } from "../ui/themes/index.js";

export class ClearCommand extends SlashCommand {
  readonly name = "clear";
  readonly description = "Reset conversation history";

  async execute(_args: ParsedArgs, context: CommandContext): Promise<void> {
    context.conversation.reset();
    const theme = getActiveTheme();
    console.log(theme.colors.warning("  Conversation cleared."));
  }
}
