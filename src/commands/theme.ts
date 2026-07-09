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
 * PLACEHOLDER: This command records the theme preference in config but
 * does not yet change the actual rendering output. Full theme integration
 * (applying colors to all chalk output via the Theme system defined in
 * BUT-5) is pending — once BUT-5's Theme system lands, this command will
 * call `themeRegistry.setTheme(name)` and the runner will read from it.
 *
 * Available themes match BUT-5's spec: default, dark, light.
 */

import chalk from "chalk";
import { SlashCommand } from "./base.js";
import type { CommandContext } from "./context.js";
import type { ParsedArgs } from "./parser.js";
import type { ArgDefinition } from "./base.js";

/**
 * Built-in theme names matching the BUT-5 Theme system spec.
 * Extend this list when additional themes are registered.
 */
const AVAILABLE_THEMES = ["default", "dark", "light"] as const;

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

    // Record the preference. Actual rendering integration is deferred to BUT-5.
    context.config.theme = themeName;
    console.log(chalk.green(`  Theme preference set to: `) + chalk.cyan(themeName));
    console.log(chalk.dim(`  (visual theme switching will activate once the Theme system is integrated)`));
  }
}
