/**
 * /config Command
 *
 * View or modify CLI configuration items at runtime.
 * Persists changes to disk via ConfigManager when available.
 *
 * Usage:
 *   /config                    List all configuration items
 *   /config <key>              Show the value of a specific key
 *   /config <key> <value>      Set a configuration item
 */

import { SlashCommand } from "./base.js";
import type { CommandContext } from "./context.js";
import type { ParsedArgs } from "./parser.js";
import type { ArgDefinition } from "./base.js";
import { getActiveTheme } from "../ui/themes/index.js";
import { setActiveTheme } from "../ui/themes/index.js";
import type { ConfigManager } from "../config/config-manager.js";
import type { ConfigKey } from "../config/config-manager.js";

/**
 * Optional ConfigManager reference set by the REPL at startup.
 * When present, config changes are persisted to disk.
 */
let configManagerRef: ConfigManager | null = null;

/** Inject the ConfigManager so /config can persist changes. */
export function setConfigCommandManager(cm: ConfigManager): void {
  configManagerRef = cm;
}

/**
 * Keys that are displayed when listing all config items.
 * Internal/context keys (like llmAvailable, requestExit) are excluded.
 */
const DISPLAY_KEYS: ConfigKey[] = ["model", "theme", "autoConfirm", "maxTokens"];

export class ConfigCommand extends SlashCommand {
  readonly name = "config";
  readonly description = "View or modify CLI configuration items";
  readonly args: ArgDefinition[] = [
    {
      name: "key",
      description: "Configuration key to read",
      required: false,
      kind: "positional",
    },
    {
      name: "value",
      description: "New value to set (omit to read)",
      required: false,
      kind: "positional",
    },
  ];

  async execute(args: ParsedArgs, _context: CommandContext): Promise<void> {
    const key = args.positionals[0];
    const value = args.positionals[1];
    const theme = getActiveTheme();

    // /config — list all displayable keys
    if (!key) {
      console.log(theme.colors.dim("  Configuration:"));
      if (configManagerRef) {
        const all = configManagerRef.getAll();
        for (const k of DISPLAY_KEYS) {
          console.log(
            theme.colors.dim(`    ${k.padEnd(16)}`) +
              theme.colors.assistant(String(all[k])),
          );
        }
      } else {
        console.log(theme.colors.dim("    (config manager not available)"));
      }
      return;
    }

    // /config <key> — read a single key
    if (value === undefined) {
      if (configManagerRef) {
        const all = configManagerRef.getAll();
        if (key in all) {
          console.log(
            theme.colors.dim(`  ${key}: `) +
              theme.colors.assistant(String((all as Record<string, unknown>)[key])),
          );
        } else {
          console.log(theme.colors.error(`  Unknown config key: "${key}"`));
        }
      } else {
        console.log(theme.colors.error(`  Config manager not available.`));
      }
      return;
    }

    // /config <key> <value> — set a key
    if (!configManagerRef) {
      console.log(theme.colors.error("  Config manager not available."));
      return;
    }

    // Type-safe setters for known config keys
    if (key === "theme") {
      if (setActiveTheme(value)) {
        configManagerRef.set("theme", value);
        console.log(theme.colors.success(`  Theme switched to "${value}".`));
      } else {
        console.log(theme.colors.warning(`  Unknown theme: "${value}"`));
      }
      return;
    }

    if (key === "autoConfirm") {
      const boolVal = value === "true" || value === "1" || value === "yes";
      configManagerRef.set("autoConfirm", boolVal);
      console.log(
        theme.colors.success(`  Set `) +
          theme.colors.assistant(key) +
          theme.colors.success(` = `) +
          theme.colors.assistant(String(boolVal)),
      );
      return;
    }

    if (key === "maxTokens") {
      const numVal = parseInt(value, 10);
      if (isNaN(numVal) || numVal <= 0) {
        console.log(theme.colors.error(`  Invalid number: "${value}"`));
        return;
      }
      configManagerRef.set("maxTokens", numVal);
      console.log(
        theme.colors.success(`  Set `) +
          theme.colors.assistant(key) +
          theme.colors.success(` = `) +
          theme.colors.assistant(String(numVal)),
      );
      return;
    }

    if (key === "model" || key === "apiKey") {
      configManagerRef.set(key, value);
      if (key === "model") {
        // Reset LLM client so the next call uses the new model
        const { resetClient } = await import("../llm/client.js");
        resetClient();
      }
      console.log(
        theme.colors.success(`  Set `) +
          theme.colors.assistant(key) +
          theme.colors.success(` = `) +
          theme.colors.assistant(value),
      );
      return;
    }

    console.log(theme.colors.error(`  Unknown config key: "${key}"`));
  }
}
