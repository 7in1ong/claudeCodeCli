/**
 * Argument Parser
 *
 * Parses a raw slash-command input string into structured arguments.
 * Supports positional arguments, --flag style named arguments,
 * --flag=value syntax, and quoted strings (single and double quotes).
 *
 * Example inputs:
 *   "/model claude-opus"                  → { positionals: ["claude-opus"], flags: {} }
 *   "/config key value"                   → { positionals: ["key", "value"], flags: {} }
 *   "/config --key theme"                 → { positionals: [], flags: { key: "theme" } }
 *   "/config --key=theme"                 → { positionals: [], flags: { key: "theme" } }
 *   "/config description \"hello world\"" → { positionals: ["description", "hello world"], flags: {} }
 *   "/theme"                              → { positionals: [], flags: {} }
 */

import type { ArgDefinition } from "./base.js";

/**
 * Parsed arguments from a slash command invocation.
 */
export interface ParsedArgs {
  /** The command name extracted from the leading /name token. */
  command: string;
  /** Positional arguments in order (tokens that are not --flags). */
  positionals: string[];
  /** Named arguments in --key value or --key=value form. Boolean flags store true. */
  flags: Record<string, string | boolean>;
}

/**
 * Validation error returned when required arguments are missing.
 */
export interface ParseValidationError {
  /** The argument definition that failed validation. */
  arg: ArgDefinition;
  /** Human-readable error message. */
  message: string;
}

/**
 * Tokenize a raw input string, respecting quoted substrings.
 *
 * Supports:
 *   - Double-quoted strings: "hello world"
 *   - Single-quoted strings: 'hello world'
 *   - Unquoted tokens separated by whitespace
 *
 * Unclosed quotes consume the rest of the string as a single token.
 */
function tokenize(raw: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let inQuote: string | null = null;
  let i = 0;

  while (i < raw.length) {
    const ch = raw[i];

    if (inQuote) {
      if (ch === inQuote) {
        // End of quoted section — push accumulated token
        tokens.push(current);
        current = "";
        inQuote = null;
      } else {
        current += ch;
      }
    } else if (ch === '"' || ch === "'") {
      // Start of quoted section
      inQuote = ch;
    } else if (ch === " " || ch === "\t") {
      if (current.length > 0) {
        tokens.push(current);
        current = "";
      }
    } else {
      current += ch;
    }

    i++;
  }

  // Handle unclosed quote or trailing content
  if (current.length > 0) {
    tokens.push(current);
  }

  return tokens;
}

/**
 * Parse a raw input line into a ParsedArgs structure.
 *
 * The first token (without the leading /) is the command name.
 * Remaining tokens are split into positionals and --flags:
 *   - A token starting with "--" is a flag:
 *     - --key=value → flags[key] = value
 *     - --key value → flags[key] = value (consumes next token)
 *     - --key (alone or before another --flag) → flags[key] = true
 *   - All other tokens are positional arguments.
 *
 * Quoted strings (single and double quotes) are supported for both
 * positional and flag values: "hello world" becomes a single token.
 *
 * @param input - The raw user input (e.g. "/model claude-opus --verbose").
 * @returns The parsed command name, positional args, and named flags.
 */
export function parseCommandInput(input: string): ParsedArgs {
  const trimmed = input.trim();

  // Strip leading / if present
  const raw = trimmed.startsWith("/") ? trimmed.slice(1) : trimmed;
  const tokens = tokenize(raw);

  const command = tokens.shift() ?? "";
  const positionals: string[] = [];
  const flags: Record<string, string | boolean> = {};

  let i = 0;
  while (i < tokens.length) {
    const token = tokens[i];

    if (token.startsWith("--")) {
      const flagBody = token.slice(2);

      // Check for --key=value syntax
      const eqIndex = flagBody.indexOf("=");
      if (eqIndex !== -1) {
        const key = flagBody.slice(0, eqIndex);
        const value = flagBody.slice(eqIndex + 1);
        flags[key] = value;
      } else {
        const key = flagBody;
        const next = tokens[i + 1];

        if (next === undefined || next.startsWith("--")) {
          // Boolean flag: --verbose, or --flag followed by another flag
          flags[key] = true;
        } else {
          // Key-value flag: --key value
          flags[key] = next;
          i++; // consume the value token
        }
      }
    } else {
      positionals.push(token);
    }

    i++;
  }

  return { command, positionals, flags };
}

/**
 * Validate parsed arguments against a command's ArgDefinition[].
 *
 * Checks that all required positional and flag arguments are present
 * in the parsed output. Returns an array of validation errors (empty
 * if everything is valid).
 *
 * @param parsed - The parsed arguments from parseCommandInput().
 * @param argDefs - The command's argument definitions.
 * @returns An array of validation errors, or empty if valid.
 */
export function validateArgs(
  parsed: ParsedArgs,
  argDefs: ArgDefinition[] | undefined,
): ParseValidationError[] {
  if (!argDefs) return [];

  const errors: ParseValidationError[] = [];
  let positionalIndex = 0;

  for (const def of argDefs) {
    const kind = def.kind ?? "positional";

    if (!def.required) continue;

    if (kind === "positional") {
      if (positionalIndex >= parsed.positionals.length) {
        errors.push({
          arg: def,
          message: `Missing required argument: <${def.name}>`,
        });
      }
      positionalIndex++;
    } else if (kind === "flag") {
      if (!(def.name in parsed.flags)) {
        errors.push({
          arg: def,
          message: `Missing required flag: --${def.name}`,
        });
      }
    }
  }

  return errors;
}
