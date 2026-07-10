/**
 * /status Command
 *
 * Displays a snapshot of the current CLI state: model, API connectivity,
 * theme, token usage, and conversation statistics.
 *
 * Usage:
 *   /status
 */

import { SlashCommand } from "./base.js";
import type { CommandContext } from "./context.js";
import type { ParsedArgs } from "./parser.js";
import { getActiveTheme } from "../ui/themes/index.js";

export class StatusCommand extends SlashCommand {
  readonly name = "status";
  readonly description = "Show current CLI status (model, tokens, theme)";

  async execute(_args: ParsedArgs, context: CommandContext): Promise<void> {
    const theme = getActiveTheme();
    const state = context.conversation.getState();
    const modeLabel = context.config.llmAvailable
      ? theme.colors.success("API connected")
      : theme.colors.warning("Mock mode");

    console.log(theme.colors.bannerTitle("  CLI Status"));
    console.log(theme.colors.dim("  ─────────────────────────────"));
    console.log(theme.colors.dim("  Model:           ") + theme.colors.assistant(context.config.model));
    console.log(theme.colors.dim("  Connection:      ") + modeLabel);
    console.log(theme.colors.dim("  Theme:           ") + theme.colors.assistant(context.config.theme));
    console.log(theme.colors.dim("  Messages:        ") + theme.colors.assistant(String(state.messageCount)));
    console.log(theme.colors.dim("  Turns:           ") + theme.colors.assistant(String(state.turnCount)));
    console.log(theme.colors.dim("  Est. tokens:     ") + theme.colors.assistant(state.estimatedTokens.toLocaleString()));
    console.log(theme.colors.dim("  Token limit:     ") + theme.colors.assistant(state.maxContextTokens.toLocaleString()));
    console.log(theme.colors.dim("  Tools:           ") + theme.colors.assistant(String(context.toolRegistry.size)));
  }
}
