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
 * for the lifetime of the current CLI session. Only whitelisted keys
 * can be written — arbitrary keys are rejected with a warning.
 */

import chalk from "chalk";
import { SlashCommand } from "./base.js";
import type { CommandContext } from "./context.js";
import type { ParsedArgs } from "./parser.js";
import type { ArgDefinition } from "./base.js";
import { resetClient } from "../llm/client.js";

/**
 * Keys that are displayed when listing all config items.
 * Internal/context keys (like llmAvailable) are excluded.
 */
const DISPLAY_KEYS = ["model", "theme"] as const;

/**
 * Keys that users are allowed to write via /config.
 * Attempting to set a key not in this list is rejected.
 */
const WRITABLE_KEYS = new Set<string>(["model", "theme"]);

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

    // /config <key> <value> — set a key (whitelist check)
    if (!WRITABLE_KEYS.has(key)) {
      console.log(chalk.red(`  Cannot write to key "${key}" — not a configurable setting.`));
      console.log(chalk.dim(`  Writable keys: ${Array.from(WRITABLE_KEYS).join(", ")}`));
      return;
    }

    if (key === "model") {
      // Update config and reset the LLM client so the next call uses the new model
      context.config.model = value;
      resetClient();
    } else if (key === "theme") {
      context.config.theme = value;
    }

    console.log(chalk.green(`  Set `) + chalk.cyan(key) + chalk.green(` = `) + chalk.cyan(value));
  }
}
