/**
 * Commands Module
 *
 * Exports the slash command framework: base class, registry, parser,
 * context types, and all built-in command implementations.
 *
 * Also provides `registerBuiltInCommands()` as the single entry point
 * for wiring up all commands into a registry, mirroring the pattern
 * used by the tools module.
 */

// Framework core
export { SlashCommand, type ArgDefinition } from "./base.js";
export { SlashCommandRegistry } from "./registry.js";
export { parseCommandInput, type ParsedArgs } from "./parser.js";
export type { CommandContext, CommandConfig } from "./context.js";

// Built-in commands
export { ClearCommand } from "./clear.js";
export { ExitCommand } from "./exit.js";
export { ModelCommand } from "./model.js";
export { ThemeCommand, setThemeConfigManager } from "./theme.js";
export { ConfigCommand, setConfigCommandManager } from "./config.js";
export { StatusCommand } from "./status.js";
export { ToolsCommand } from "./tools.js";
export { createHelpCommand } from "./help.js";

/**
 * Register all built-in slash commands into a SlashCommandRegistry.
 *
 * The /help command needs a back-reference to the registry itself so
 * it can enumerate commands — that's handled via createHelpCommand().
 *
 * @param registry - The SlashCommandRegistry to register commands into.
 */
import { ClearCommand } from "./clear.js";
import { ExitCommand } from "./exit.js";
import { ModelCommand } from "./model.js";
import { ThemeCommand } from "./theme.js";
import { ConfigCommand } from "./config.js";
import { StatusCommand } from "./status.js";
import { ToolsCommand } from "./tools.js";
import { createHelpCommand } from "./help.js";
import type { SlashCommandRegistry } from "./registry.js";

export function registerBuiltInCommands(registry: SlashCommandRegistry): void {
  registry.register(new ClearCommand());
  registry.register(new ExitCommand());
  registry.register(new ModelCommand());
  registry.register(new ThemeCommand());
  registry.register(new ConfigCommand());
  registry.register(new StatusCommand());
  registry.register(new ToolsCommand());

  // /help needs a reference to the registry to list commands
  registry.register(createHelpCommand(registry));
}
