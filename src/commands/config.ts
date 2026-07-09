/**
 * /config Command
 *
 * View or modify CLI configuration items at runtime.
 *
 * Usage:
 *   /config                    List all configuration items
 *   /config <key>              Show the value of a specific key
 *   /config <key> <value>      Set a configuration item
 *
 * Configuration items are stored in CommandContext.config and persist
 * for the lifetime of the current CLI session.
 */

import chalk from "chalk";
import { SlashCommand } from "./base.js";
import type { CommandContext } from "./context.js";
import type { ParsedArgs } from "./parser.js";
import type { ArgDefinition } from "./base.js";

/**
 * Keys that are displayed when listing all config items.
 * Internal/context keys (like llmAvailable, requestExit) are excluded.
 */
const DISPLAY_KEYS = ["model", "theme"];

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

  async execute(args: ParsedArgs, context: CommandContext): Promise<void> {
    const key = args.positionals[0];
    const value = args.positionals[1];

    // /config — list all displayable keys
    if (!key) {
      console.log(chalk.dim("  Configuration:"));
      for (const k of DISPLAY_KEYS) {
        const v = context.config[k];
        console.log(chalk.dim(`    ${k.padEnd(16)}`) + chalk.cyan(String(v)));
      }
      return;
    }

    // /config <key> — read a single key
    if (value === undefined) {
      if (key in context.config) {
        console.log(chalk.dim(`  ${key}: `) + chalk.cyan(String(context.config[key])));
      } else {
        console.log(chalk.red(`  Unknown config key: "${key}"`));
      }
      return;
    }

    // /config <key> <value> — set a key
    if (key === "model") {
      // Delegate to the model-switching logic: update config and reset client
      context.config.model = value;
      // Lazy import to avoid circular dependency at module load time
      const { resetClient } = await import("../llm/client.js");
      resetClient();
    } else if (key === "theme") {
      context.config.theme = value;
    } else {
      // Generic key: store as-is
      context.config[key] = value;
    }

    console.log(chalk.green(`  Set `) + chalk.cyan(key) + chalk.green(` = `) + chalk.cyan(value));
  }
}
