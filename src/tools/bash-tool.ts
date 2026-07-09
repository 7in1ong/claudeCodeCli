/**
 * BashTool
 *
 * Executes shell commands using child_process. Captures stdout and
 * stderr, supports configurable timeouts, and truncates overly long
 * output to prevent context window exhaustion.
 */

import { exec } from "node:child_process";
import { BaseTool, type ToolResult, type JSONSchema } from "./base.js";
import { truncate } from "../utils/index.js";

/** Default command timeout in milliseconds (2 minutes). */
const DEFAULT_TIMEOUT_MS = 120_000;

/** Maximum output length before truncation (characters). */
const MAX_OUTPUT_LENGTH = 30_000;

export class BashTool extends BaseTool {
  readonly name = "bash";
  readonly description =
    "Execute a shell command and return its output. Captures both stdout " +
    "and stderr. Supports a configurable timeout (default 120 seconds). " +
    "Long output is automatically truncated to prevent context overflow.";

  readonly inputSchema: JSONSchema = {
    type: "object",
    properties: {
      command: {
        type: "string",
        description: "The shell command to execute.",
      },
      timeout: {
        type: "number",
        description: `Timeout in milliseconds. Defaults to ${DEFAULT_TIMEOUT_MS}.`,
      },
      cwd: {
        type: "string",
        description: "Working directory for the command. Defaults to the current directory.",
      },
    },
    required: ["command"],
  };

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const command = String(params["command"] ?? "");
    const timeout = Number(params["timeout"] ?? DEFAULT_TIMEOUT_MS);
    const cwd = params["cwd"] ? String(params["cwd"]) : undefined;

    if (!command) {
      return { success: false, content: "Error: command is required." };
    }

    return new Promise<ToolResult>((resolve) => {
      exec(
        command,
        {
          timeout,
          cwd,
          maxBuffer: 10 * 1024 * 1024, // 10 MB
        },
        (error, stdout, stderr) => {
          const exitCode = error ? (error.code ?? 1) : 0;

          // Build a structured output string
          const parts: string[] = [];

          if (stdout) {
            parts.push(`[stdout]\n${stdout}`);
          }

          if (stderr) {
            parts.push(`[stderr]\n${stderr}`);
          }

          if (error) {
            // Distinguish timeout from other execution errors
            if (error.killed) {
              parts.push(
                `[error] Command timed out after ${timeout}ms.`,
              );
            } else {
              parts.push(`[error] ${error.message}`);
            }
          }

          if (parts.length === 0) {
            parts.push("[stdout] (no output)");
          }

          parts.push(`[exit code] ${exitCode}`);

          const fullOutput = parts.join("\n");
          const truncatedOutput = truncate(fullOutput, MAX_OUTPUT_LENGTH);

          resolve({
            success: exitCode === 0,
            content: truncatedOutput,
          });
        },
      );
    });
  }
}
