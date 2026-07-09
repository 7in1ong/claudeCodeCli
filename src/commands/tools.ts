/**
 * /tools Command
 *
 * Lists all tools currently registered in the ToolRegistry,
 * showing each tool's name, confirmation requirement, and description.
 */

import chalk from "chalk";
import { SlashCommand } from "./base.js";
import type { CommandContext } from "./context.js";
import type { ParsedArgs } from "./parser.js";

export class ToolsCommand extends SlashCommand {
  readonly name = "tools";
  readonly description = "List available tools and their status";

  async execute(_args: ParsedArgs, context: CommandContext): Promise<void> {
    const tools = context.toolRegistry.list();

    if (tools.length === 0) {
      context.renderer.renderSystemMessage("  No tools registered.");
      return;
    }

    console.log(chalk.dim(`  ${tools.length} tool(s) available:`));
    console.log(chalk.dim("  ─────────────────────────────────────────"));

    for (const tool of tools.sort((a, b) => a.name.localeCompare(b.name))) {
      const confirmTag = tool.requiresConfirmation
        ? chalk.yellow(" [needs confirmation]")
        : chalk.green(" [auto]");

      console.log(
        chalk.dim("  ") +
          chalk.cyan(tool.name.padEnd(20)) +
          confirmTag +
          chalk.dim(`  — ${tool.description}`),
      );
    }
  }
}
