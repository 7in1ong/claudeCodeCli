/**
 * /theme Command
 *
 * Switches the CLI theme. A theme is a named color/style preset
 * that affects the REPL banner, prompt, and output formatting.
 *
 * Usage:
 *   /theme <name>        Switch to the specified theme
 *   /theme               Show the current theme and available themes
 *
 * Note: The current implementation provides a placeholder theme system.
 * The actual theme rendering hooks into the chalk-based output in runner.ts.
 */

import chalk from "chalk";
import { SlashCommand } from "./base.js";
import type { CommandContext } from "./context.js";
import type { ParsedArgs } from "./parser.js";
import type { ArgDefinition } from "./base.js";

/** Built-in theme names. Extend this as themes are added. */
const AVAILABLE_THEMES = ["default", "dark", "light", "monokai"] as const;

export class ThemeCommand extends SlashCommand {
  readonly name = "theme";
  readonly description = "Switch or display the current CLI theme";
  readonly args: ArgDefinition[] = [
    {
      name: "name",
      description: `Theme name (${AVAILABLE_THEMES.join(", ")})`,
      required: false,
      kind: "positional",
    },
  ];

  async execute(args: ParsedArgs, context: CommandContext): Promise<void> {
    const themeName = args.positionals[0];

    if (!themeName) {
      console.log(chalk.dim(`  Current theme: `) + chalk.cyan(context.config.theme));
      console.log(chalk.dim(`  Available: `) + AVAILABLE_THEMES.join(", "));
      return;
    }

    if (!AVAILABLE_THEMES.includes(themeName as typeof AVAILABLE_THEMES[number])) {
      console.log(chalk.red(`  Unknown theme: "${themeName}"`));
      console.log(chalk.dim(`  Available: `) + AVAILABLE_THEMES.join(", "));
      return;
    }

    context.config.theme = themeName;
    console.log(chalk.green(`  Theme switched to: `) + chalk.cyan(themeName));
  }
}
