/**
 * ReadFile Tool
 *
 * Reads file content from a specified path with optional offset/limit
 * for reading file fragments. Handles common errors gracefully.
 */

import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { BaseTool, type ToolResult, type JSONSchema } from "./base.js";

/** Default maximum number of lines to return when no limit is specified. */
const DEFAULT_MAX_LINES = 2000;

/**
 * Splits text into lines, returning the requested slice (1-indexed, inclusive).
 *
 * @param text - The full file content.
 * @param offset - Starting line number (1-indexed). Defaults to 1.
 * @param limit - Maximum number of lines to return. Defaults to DEFAULT_MAX_LINES.
 * @returns An object containing the sliced content and line range metadata.
 */
function sliceLines(
  text: string,
  offset: number,
  limit: number,
): { content: string; startLine: number; endLine: number; totalLines: number } {
  const lines = text.split("\n");
  const totalLines = lines.length;
  const startLine = Math.max(1, offset);
  const startIndex = startLine - 1;
  const endIndex = Math.min(startIndex + limit, totalLines);
  const sliced = lines.slice(startIndex, endIndex);

  return {
    content: sliced.join("\n"),
    startLine,
    endLine: startIndex + sliced.length,
    totalLines,
  };
}

export class ReadFileTool extends BaseTool {
  readonly name = "read_file";
  readonly description =
    "Read the contents of a file at the given path. Supports reading a " +
    "specific line range via offset and limit parameters. Returns the file " +
    "content along with line number annotations.";

  readonly inputSchema: JSONSchema = {
    type: "object",
    properties: {
      file_path: {
        type: "string",
        description: "Absolute or relative path to the file to read.",
      },
      offset: {
        type: "number",
        description:
          "Starting line number (1-indexed). Defaults to 1 (beginning of file).",
      },
      limit: {
        type: "number",
        description: `Maximum number of lines to return. Defaults to ${DEFAULT_MAX_LINES}.`,
      },
    },
    required: ["file_path"],
  };

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const filePath = String(params["file_path"]);
    const offset = Number(params["offset"] ?? 1);
    const limit = Number(params["limit"] ?? DEFAULT_MAX_LINES);

    if (!filePath) {
      return { success: false, content: "Error: file_path is required." };
    }

    const resolvedPath = resolve(filePath);

    try {
      const fileStat = await stat(resolvedPath);

      if (!fileStat.isFile()) {
        return {
          success: false,
          content: `Error: "${resolvedPath}" is not a file (found ${fileStat.isDirectory() ? "directory" : "other"}).`,
        };
      }

      const rawContent = await readFile(resolvedPath, "utf-8");
      const { content, startLine, endLine, totalLines } = sliceLines(
        rawContent,
        offset,
        limit,
      );

      // Format output with line numbers for easy reference
      const numberedLines = content
        .split("\n")
        .map((line, i) => `${startLine + i}\t${line}`)
        .join("\n");

      const header =
        endLine < totalLines
          ? `[Showing lines ${startLine}–${endLine} of ${totalLines}. Pass a larger limit to read more.]`
          : `[${totalLines} lines total]`;

      return {
        success: true,
        content: `${header}\n${numberedLines}`,
      };
    } catch (error: unknown) {
      if (error instanceof Error && "code" in error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code === "ENOENT") {
          return {
            success: false,
            content: `Error: File not found: "${resolvedPath}".`,
          };
        }
        if (code === "EACCES" || code === "EPERM") {
          return {
            success: false,
            content: `Error: Permission denied reading "${resolvedPath}".`,
          };
        }
      }
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, content: `Error reading file: ${message}` };
    }
  }
}
