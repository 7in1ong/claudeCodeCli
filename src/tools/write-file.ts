/**
 * WriteFile Tool
 *
 * Creates or overwrites a file at the specified path. Automatically
 * creates any missing parent directories. Returns a summary of the
 * write operation.
 */

import { writeFile, mkdir, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { BaseTool, type ToolResult, type JSONSchema } from "./base.js";

export class WriteFileTool extends BaseTool {
  readonly name = "write_file";
  readonly description =
    "Create or overwrite a file at the given path. Parent directories are " +
    "created automatically if they do not exist. Returns the number of bytes " +
    "written and whether the file was newly created or updated.";

  readonly inputSchema: JSONSchema = {
    type: "object",
    properties: {
      file_path: {
        type: "string",
        description: "Absolute or relative path to the file to write.",
      },
      content: {
        type: "string",
        description: "The full text content to write to the file.",
      },
    },
    required: ["file_path", "content"],
  };

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const filePath = String(params["file_path"] ?? "");
    if (!filePath) {
      return { success: false, content: "Error: file_path is required." };
    }

    if (!("content" in params)) {
      return { success: false, content: "Error: content is required." };
    }
    const content = String(params["content"]);

    const resolvedPath = resolve(filePath);
    const parentDir = dirname(resolvedPath);

    try {
      // Ensure parent directories exist
      await mkdir(parentDir, { recursive: true });

      // Determine whether the file already exists
      let existed = false;
      try {
        const existing = await stat(resolvedPath);
        existed = existing.isFile();
      } catch {
        // File does not exist — that is the normal create path
      }

      const buffer = Buffer.from(content, "utf-8");
      await writeFile(resolvedPath, buffer, { encoding: "utf-8" });

      const action = existed ? "Updated" : "Created";
      return {
        success: true,
        content: `${action} "${resolvedPath}" (${buffer.length} bytes written).`,
      };
    } catch (error: unknown) {
      if (error instanceof Error && "code" in error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code === "EACCES" || code === "EPERM") {
          return {
            success: false,
            content: `Error: Permission denied writing to "${resolvedPath}".`,
          };
        }
        if (code === "EISDIR") {
          return {
            success: false,
            content: `Error: "${resolvedPath}" is a directory, not a file.`,
          };
        }
        if (code === "ENOSPC") {
          return {
            success: false,
            content: `Error: No space left on device when writing "${resolvedPath}".`,
          };
        }
      }
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, content: `Error writing file: ${message}` };
    }
  }
}
