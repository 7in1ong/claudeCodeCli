/**
 * ListFiles Tool
 *
 * Lists directory contents with optional glob pattern matching.
 * Displays file type, size, and modification time for each entry.
 */

import { readdir, stat, lstat } from "node:fs/promises";
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
 * A collected file entry with both the formatted display string and the
 * relative path (kept separate so glob filtering operates on the real path,
 * not on a reformatted string with padded fields).
 */
interface FileEntry {
  formatted: string;
  relPath: string;
}

/**
 * Recursively collect file entries under a directory.
 *
 * Uses `lstat` instead of `stat` to avoid following symbolic links, which
 * prevents infinite recursion when a symlink points to an ancestor directory.
 *
 * When a `globRegex` is provided, filtering happens inline during collection
 * so that `maxEntries` limits the number of *matching* entries rather than
 * the number of scanned entries.
 */
async function collectEntries(
  dir: string,
  baseDir: string,
  maxEntries: number,
  globRegex?: RegExp,
): Promise<FileEntry[]> {
  const results: FileEntry[] = [];

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
      // Use lstat to avoid following symbolic links (prevents infinite
      // recursion when a symlink points to an ancestor directory).
      const entryStat = await lstat(fullPath);
      const formatted = formatEntry(entry.name, entryStat, relPath);

      // Apply glob filter inline during collection so that maxEntries
      // limits matching results, not scanned entries.
      const matchesGlob =
        !globRegex ||
        globRegex.test(relPath) ||
        globRegex.test(basename(relPath));

      if (matchesGlob) {
        results.push({ formatted, relPath });
      }

      // Recurse into real directories only (skip symlinked directories)
      if (entryStat.isDirectory() && results.length < maxEntries) {
        const subEntries = await collectEntries(
          fullPath,
          baseDir,
          maxEntries,
          globRegex,
        );
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

      const globRegex = pattern ? globToRegExp(pattern) : undefined;
      const allEntries = await collectEntries(
        targetPath,
        targetPath,
        maxEntries,
        globRegex,
      );

      if (allEntries.length === 0) {
        const msg = pattern
          ? `No entries matching "${pattern}" found in "${targetPath}".`
          : `No entries found in "${targetPath}".`;
        return { success: true, content: msg };
      }

      const lines = allEntries.map((e) => e.formatted);

      const header = pattern
        ? `[${lines.length} matching entries for pattern "${pattern}" in "${targetPath}"]`
        : `[${lines.length} entries in "${targetPath}"]`;

      const truncated =
        lines.length >= maxEntries
          ? `\n[Truncated: showing first ${maxEntries} entries. Use a pattern to narrow results.]`
          : "";

      return {
        success: true,
        content: `${header}\n${lines.join("\n")}${truncated}`,
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
