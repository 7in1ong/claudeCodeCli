/**
 * /theme Command
 *
 * Switches the CLI theme. A theme is a named color/style preset
 * that affects the REPL banner, prompt, and output formatting.
 *
 * Usage:
 *   /theme <name>        Switch to the specified theme (persisted to config)
 *   /theme               Show the current theme and available themes
 */

import { SlashCommand } from "./base.js";
import type { CommandContext } from "./context.js";
import type { ParsedArgs } from "./parser.js";
import type { ArgDefinition } from "./base.js";
import {
  getActiveTheme,
  setActiveTheme,
  listThemeNames,
} from "../ui/themes/index.js";
import type { ConfigManager } from "../config/config-manager.js";

/**
 * Optional ConfigManager reference set by the REPL at startup.
 * When present, theme changes are persisted to disk.
 */
let configManagerRef: ConfigManager | null = null;

/** Inject the ConfigManager so /theme can persist changes. */
export function setThemeConfigManager(cm: ConfigManager): void {
  configManagerRef = cm;
}

export class ThemeCommand extends SlashCommand {
  readonly name = "theme";
  readonly description = "Switch or display the current CLI theme";
  readonly args: ArgDefinition[] = [
    {
      name: "name",
      description: "Theme name (default, dark, light)",
      required: false,
      kind: "positional",
    },
  ];

  async execute(args: ParsedArgs, _context: CommandContext): Promise<void> {
    const themeName = args.positionals[0];
    const theme = getActiveTheme();

    if (!themeName) {
      // List available themes, mark the active one
      const names = listThemeNames();
      console.log(theme.colors.dim("  Available themes:"));
      for (const name of names) {
        const isActive = name === theme.name;
        const marker = isActive
          ? theme.colors.success(" ● ")
          : theme.colors.dim("   ");
        const label = isActive
          ? theme.colors.success(name)
          : name;
        console.log(marker + label);
      }
      console.log(theme.colors.dim(`  Use "/theme <name>" to switch.`));
      return;
    }

    if (setActiveTheme(themeName)) {
      const newTheme = getActiveTheme();
      // Persist to config if available
      if (configManagerRef) {
        configManagerRef.set("theme", themeName);
      }
      console.log(
        newTheme.colors.success(`  Theme switched to "${newTheme.displayName}".`),
      );
    } else {
      const available = listThemeNames().join(", ");
      console.log(
        theme.colors.warning(
          `  Unknown theme "${themeName}". Available: ${available}`,
        ),
      );
    }
  }
}
