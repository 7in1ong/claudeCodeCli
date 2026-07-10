/**
 * Argument Parser
 *
 * Parses a raw slash-command input string into structured arguments.
 * Supports positional arguments and --flag style named arguments.
 *
 * Example inputs:
 *   "/model claude-opus"           → { positionals: ["claude-opus"], flags: {} }
 *   "/config key value"            → { positionals: ["key", "value"], flags: {} }
 *   "/config --key theme"          → { positionals: [], flags: { key: "theme" } }
 *   "/theme"                       → { positionals: [], flags: {} }
 */

/**
 * Parsed arguments from a slash command invocation.
 */
export interface ParsedArgs {
  /** The command name extracted from the leading /name token. */
  command: string;
  /** Positional arguments in order (tokens that are not --flags). */
  positionals: string[];
  /** Named arguments in --key value form. Boolean flags store true. */
  flags: Record<string, string | boolean>;
}

/**
 * Parse a raw input line into a ParsedArgs structure.
 *
 * The first token (without the leading /) is the command name.
 * Remaining tokens are split into positionals and --flags:
 *   - A token starting with "--" consumes the next token as its value,
 *     or stores `true` if no next token exists or the next token is also a flag.
 *   - All other tokens are positional arguments.
 *
 * @param input - The raw user input (e.g. "/model claude-opus --verbose").
 * @returns The parsed command name, positional args, and named flags.
 */
export function parseCommandInput(input: string): ParsedArgs {
  const trimmed = input.trim();

  // Strip leading / if present
  const raw = trimmed.startsWith("/") ? trimmed.slice(1) : trimmed;
  const tokens = raw.split(/\s+/).filter(Boolean);

  const command = tokens.shift() ?? "";
  const positionals: string[] = [];
  const flags: Record<string, string | boolean> = {};

  let i = 0;
  while (i < tokens.length) {
    const token = tokens[i];

    if (token.startsWith("--")) {
      // Flag argument: --key or --key value
      const key = token.slice(2);
      const next = tokens[i + 1];

      if (next === undefined || next.startsWith("--")) {
        // Boolean flag: --verbose, or --flag followed by another flag
        flags[key] = true;
      } else {
        // Key-value flag: --key value
        flags[key] = next;
        i++; // consume the value token
      }
    } else {
      positionals.push(token);
    }

    i++;
  }

  return { command, positionals, flags };
}
