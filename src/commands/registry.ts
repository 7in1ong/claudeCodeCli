/**
 * Slash Command Registry
 *
 * Manages the collection of available slash commands. Handles registration,
 * lookup by name or alias, and listing commands for /help output.
 *
 * Mirrors the design of ToolRegistry: a Map-backed store with name
 * uniqueness enforcement and a convenient lookup API.
 */

import { SlashCommand } from "./base.js";
import { parseCommandInput, type ParsedArgs } from "./parser.js";

/**
 * Registry for slash commands.
 *
 * Commands are indexed by their primary name and all aliases, so
 * lookup is O(1) regardless of how many aliases exist.
 */
export class SlashCommandRegistry {
  /** All registered command instances, keyed by primary name. */
  private commands: Map<string, SlashCommand> = new Map();

  /** Alias → primary name mapping for O(1) lookup. */
  private aliasIndex: Map<string, string> = new Map();

  /**
   * Register a command. Indexes both the primary name and all aliases.
   *
   * @throws If a command or alias with the same name is already registered.
   */
  register(command: SlashCommand): void {
    if (this.commands.has(command.name) || this.aliasIndex.has(command.name)) {
      throw new Error(`Command "${command.name}" is already registered`);
    }

    this.commands.set(command.name, command);

    if (command.aliases) {
      for (const alias of command.aliases) {
        if (this.commands.has(alias) || this.aliasIndex.has(alias)) {
          throw new Error(
            `Command alias "${alias}" conflicts with an existing command or alias`,
          );
        }
        this.aliasIndex.set(alias, command.name);
      }
    }
  }

  /**
   * Look up a command by name or alias.
   *
   * @param nameOrAlias - The command name or alias to look up.
   * @returns The command instance, or undefined if not found.
   */
  get(nameOrAlias: string): SlashCommand | undefined {
    const primaryName = this.aliasIndex.get(nameOrAlias) ?? nameOrAlias;
    return this.commands.get(primaryName);
  }

  /**
   * Check whether a command or alias is registered.
   */
  has(nameOrAlias: string): boolean {
    return this.get(nameOrAlias) !== undefined;
  }

  /**
   * List all registered commands (primary names only, no aliases).
   */
  list(): SlashCommand[] {
    return Array.from(this.commands.values());
  }

  /**
   * Get the number of registered commands.
   */
  get size(): number {
    return this.commands.size;
  }

  /**
   * Parse a raw input string and resolve it to a command + parsed args.
   *
   * @param input - The raw user input (e.g. "/model claude-opus").
   * @returns The matched command and its parsed arguments, or null if
   *          the input is not a slash command or no matching command exists.
   */
  resolve(input: string): { command: SlashCommand; args: ParsedArgs } | null {
    if (!input.startsWith("/")) {
      return null;
    }

    const parsed = parseCommandInput(input);
    const command = this.get(parsed.command);

    if (!command) {
      return null;
    }

    return { command, args: parsed };
  }
}
