/**
 * Slash Command Base Class
 *
 * Abstract base for all slash commands. Subclasses provide a name,
 * optional aliases, a description, optional argument definitions,
 * and an execute() implementation.
 *
 * The framework uses these fields for:
 *   - Routing input to the correct command (name + aliases)
 *   - Generating help text (description + args)
 *   - Parsing and validating arguments (args definitions)
 */

import type { CommandContext } from "./context.js";
import type { ParsedArgs } from "./parser.js";

/**
 * Definition of a single command argument.
 *
 * Used for help text generation and for guiding the parser on
 * which positional vs. named arguments are expected.
 */
export interface ArgDefinition {
  /** Argument name (used as the key in ParsedArgs). */
  name: string;
  /** Short help text for this argument. */
  description: string;
  /** Whether this argument is required. */
  required?: boolean;
  /**
   * Argument kind:
   *   - "positional" — a bare value after the command name (e.g. /model claude-opus)
   *   - "flag" — a --key value pair (e.g. /config --set key value)
   */
  kind?: "positional" | "flag";
}

/**
 * Abstract base class for slash commands.
 *
 * @example
 * ```ts
 * class ClearCommand extends SlashCommand {
 *   readonly name = "clear";
 *   readonly description = "Reset conversation history";
 *
 *   async execute(_args: ParsedArgs, context: CommandContext): Promise<void> {
 *     context.conversation.reset();
 *   }
 * }
 * ```
 */
export abstract class SlashCommand {
  /** Primary command name, invoked as `/name`. */
  abstract readonly name: string;

  /** Alternative names for the command (e.g. ["m"] for /model). */
  readonly aliases?: string[];

  /** Human-readable one-liner shown in /help. */
  abstract readonly description: string;

  /** Optional argument definitions for parsing and help generation. */
  readonly args?: ArgDefinition[];

  /**
   * Execute the command.
   *
   * @param args    - Parsed arguments (positional + named flags).
   * @param context - Runtime context (conversation, tools, renderer, config).
   */
  abstract execute(args: ParsedArgs, context: CommandContext): Promise<void>;
}
