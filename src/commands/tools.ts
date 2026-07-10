/**
 * /tools Command
 *
 * Lists all tools currently registered in the ToolRegistry,
 * showing each tool's name, confirmation requirement, and description.
 *
 * Usage:
 *   /tools
 */

import { SlashCommand } from "./base.js";
import type { CommandContext } from "./context.js";
import type { ParsedArgs } from "./parser.js";
import { getActiveTheme } from "../ui/themes/index.js";

export class ToolsCommand extends SlashCommand {
  readonly name = "tools";
  readonly description = "List available tools and their status";

  async execute(_args: ParsedArgs, context: CommandContext): Promise<void> {
    const tools = context.toolRegistry.list();
    const theme = getActiveTheme();

    if (tools.length === 0) {
      console.log(theme.colors.dim("  No tools registered."));
      return;
    }

    console.log(theme.colors.dim(`  ${tools.length} tool(s) available:`));
    console.log(theme.colors.dim("  ─────────────────────────────────────────"));

    for (const tool of tools.sort((a, b) => a.name.localeCompare(b.name))) {
      const confirmTag = tool.requiresConfirmation
        ? theme.colors.warning(" [needs confirmation]")
        : theme.colors.success(" [auto]");

      console.log(
        theme.colors.dim("  ") +
          theme.colors.tool(tool.name.padEnd(20)) +
          confirmTag +
          theme.colors.dim(`  — ${tool.description}`),
      );
    }
  }
}
