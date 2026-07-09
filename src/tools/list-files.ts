/**
 * ListFiles Tool
 *
 * Lists directory contents with optional glob pattern matching.
 * Displays file type, size, and modification time for each entry.
 */

import { readdir, stat } from "node:fs/promises";
import type { Dirent } from "node:fs";
import { join, resolve, relative, basename } from "node:path";
import { BaseTool, type ToolResult, type JSONSchema } from "./base.js";

/** Default maximum number of entries to return. */
const DEFAULT_MAX_ENTRIES = 500;

/**
 * Convert a simple glob pattern to a RegExp.
 *
 * Supports: `*` (any chars except `/`), `**` (any chars including `/`),
 * `?` (single char except `/`), and `{a,b}` alternation.
 */
function globToRegExp(pattern: string): RegExp {
  let regexStr = "^";
  let i = 0;

  while (i < pattern.length) {
    const c = pattern[i];

    if (c === "*") {
      if (pattern[i + 1] === "*") {
        // ** matches everything including path separators
        regexStr += ".*";
        i += 2;
        // Skip trailing slash after **
        if (pattern[i] === "/") {
          i++;
        }
      } else {
        // * matches everything except path separators
        regexStr += "[^/]*";
        i++;
      }
    } else if (c === "?") {
      regexStr += "[^/]";
      i++;
    } else if (c === "{") {
      // Find matching }
      const closeIndex = pattern.indexOf("}", i);
      if (closeIndex === -1) {
        regexStr += "\\{";
        i++;
      } else {
        const alternatives = pattern.slice(i + 1, closeIndex).split(",");
        regexStr += `(${alternatives.map(escapeRegex).join("|")})`;
        i = closeIndex + 1;
      }
    } else if (c === "." || c === "(" || c === ")" || c === "+" || c === "^" || c === "$" || c === "|" || c === "[" || c === "]" || c === "\\") {
      regexStr += `\\${c}`;
      i++;
    } else {
      regexStr += c;
      i++;
    }
  }

  regexStr += "$";
  return new RegExp(regexStr);
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Format file metadata into a human-readable line.
 */
function formatEntry(
  name: string,
  entryStat: Awaited<ReturnType<typeof stat>>,
  relativePath: string,
): string {
  const type = entryStat.isDirectory()
    ? "d"
    : entryStat.isSymbolicLink()
      ? "l"
      : "-";
  const size = entryStat.isDirectory()
    ? "-"
    : formatSize(Number(entryStat.size));
  const mtime = entryStat.mtime.toISOString().slice(0, 19).replace("T", " ");

  return `${type} ${size.padStart(10)} ${mtime} ${relativePath}`;
}

/**
 * Format a byte size into a human-readable string.
 */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

/**
 * Recursively collect file entries under a directory.
 */
async function collectEntries(
  dir: string,
  baseDir: string,
  maxEntries: number,
): Promise<string[]> {
  const results: string[] = [];

  let entries: Dirent[];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return results;
  }

  for (const entry of entries) {
    if (results.length >= maxEntries) break;

    const fullPath = join(dir, entry.name);
    const relPath = relative(baseDir, fullPath);

    try {
      const entryStat = await stat(fullPath);
      results.push(formatEntry(entry.name, entryStat, relPath));

      // Recurse into directories
      if (entryStat.isDirectory() && results.length < maxEntries) {
        const subEntries = await collectEntries(fullPath, baseDir, maxEntries);
        results.push(...subEntries);
      }
    } catch {
      // Skip entries we cannot stat
    }
  }

  return results;
}

export class ListFilesTool extends BaseTool {
  readonly name = "list_files";
  readonly description =
    "List files and directories at the given path. Supports recursive listing " +
    "and glob pattern matching (e.g. '**/*.ts', 'src/*'). Each entry shows " +
    "type, size, modification time, and relative path.";

  readonly inputSchema: JSONSchema = {
    type: "object",
    properties: {
      path: {
        type: "string",
        description:
          "Directory path to list. Defaults to the current working directory.",
      },
      pattern: {
        type: "string",
        description:
          "Optional glob pattern to filter results (e.g. '**/*.ts', '*.json'). " +
          "When provided, only matching entries are returned.",
      },
      max_entries: {
        type: "number",
        description: `Maximum number of entries to return. Defaults to ${DEFAULT_MAX_ENTRIES}.`,
      },
    },
    required: [],
  };

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const targetPath = resolve(String(params["path"] ?? "."));
    const pattern = params["pattern"] ? String(params["pattern"]) : undefined;
    const maxEntries = Number(params["max_entries"] ?? DEFAULT_MAX_ENTRIES);

    try {
      const targetStat = await stat(targetPath);

      if (!targetStat.isDirectory()) {
        return {
          success: false,
          content: `Error: "${targetPath}" is not a directory.`,
        };
      }

      const entries = await collectEntries(targetPath, targetPath, maxEntries);

      if (entries.length === 0) {
        return {
          success: true,
          content: `No entries found in "${targetPath}".`,
        };
      }

      // Apply glob filter if a pattern was provided
      let filtered = entries;
      if (pattern) {
        const regex = globToRegExp(pattern);
        filtered = entries.filter((entry) => {
          // Extract the relative path from the formatted entry line
          // Format: "type size mtime relativePath"
          const parts = entry.split(" ");
          const relPath = parts.slice(3).join(" ");
          return regex.test(relPath) || regex.test(basename(relPath));
        });
      }

      const header = pattern
        ? `[${filtered.length} matching entries for pattern "${pattern}" in "${targetPath}"]`
        : `[${filtered.length} entries in "${targetPath}"]`;

      const truncated =
        filtered.length >= maxEntries
          ? `\n[Truncated: showing first ${maxEntries} entries. Use a pattern to narrow results.]`
          : "";

      return {
        success: true,
        content: `${header}\n${filtered.join("\n")}${truncated}`,
      };
    } catch (error: unknown) {
      if (error instanceof Error && "code" in error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code === "ENOENT") {
          return {
            success: false,
            content: `Error: Directory not found: "${targetPath}".`,
          };
        }
        if (code === "EACCES" || code === "EPERM") {
          return {
            success: false,
            content: `Error: Permission denied accessing "${targetPath}".`,
          };
        }
      }
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, content: `Error listing files: ${message}` };
    }
  }
}
