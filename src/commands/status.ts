/**
 * /status Command
 *
 * Displays a snapshot of the current CLI state: model, API connectivity,
 * theme, token usage, and conversation statistics.
 */

import chalk from "chalk";
import { SlashCommand } from "./base.js";
import type { CommandContext } from "./context.js";
import type { ParsedArgs } from "./parser.js";

export class StatusCommand extends SlashCommand {
  readonly name = "status";
  readonly description = "Show current CLI status (model, tokens, theme)";

  async execute(_args: ParsedArgs, context: CommandContext): Promise<void> {
    const state = context.conversation.getState();
    const modeLabel = context.config.llmAvailable
      ? chalk.green("API connected")
      : chalk.yellow("Mock mode");

    console.log(chalk.bold("  CLI Status"));
    console.log(chalk.dim("  ─────────────────────────────"));
    console.log(chalk.dim("  Model:           ") + chalk.cyan(context.config.model));
    console.log(chalk.dim("  Connection:      ") + modeLabel);
    console.log(chalk.dim("  Theme:           ") + chalk.cyan(context.config.theme));
    console.log(chalk.dim("  Messages:        ") + state.messageCount);
    console.log(chalk.dim("  Turns:           ") + state.turnCount);
    console.log(chalk.dim("  Est. tokens:     ") + state.estimatedTokens.toLocaleString());
    console.log(chalk.dim("  Token limit:     ") + state.maxContextTokens.toLocaleString());
    console.log(chalk.dim("  Tools:           ") + context.toolRegistry.size);
  }
}
