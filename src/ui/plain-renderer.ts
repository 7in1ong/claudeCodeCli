/**
 * Plain Renderer
 *
 * Default Renderer implementation that uses the active Theme for
 * color output. All styling goes through theme.colors.* so switching
 * themes takes effect immediately across all output.
 */

import chalk from "chalk";
import type { Renderer } from "./renderer.js";
import { getActiveTheme } from "./themes/index.js";
import { truncate } from "../utils/index.js";

export class PlainRenderer implements Renderer {
  renderBanner(version: string, model: string, connected: boolean): void {
    const theme = getActiveTheme();
    const modeLabel = connected
      ? theme.colors.success("API connected")
      : theme.colors.warning("Mock mode");

    console.log(
      theme.colors.bannerTitle("\n  Claude Code CLI") +
        theme.colors.bannerMeta(` v${version}`),
    );
    console.log(
      theme.colors.bannerMeta(`  Model: ${model}  •  ${modeLabel}`),
    );
    console.log(
      theme.colors.bannerMeta(
        '  Type a message to chat. "\\" at end of line for multi-line input.',
      ),
    );
    console.log(
      theme.colors.bannerMeta('  Type "/help" for commands, or "exit" to quit.\n'),
    );
  }

  renderUserMessage(text: string): void {
    const theme = getActiveTheme();
    console.log(theme.colors.user("You: ") + text);
  }

  renderAssistantText(text: string): void {
    const theme = getActiveTheme();
    process.stdout.write(theme.colors.assistant(text));
  }

  renderToolStart(toolName: string): void {
    const theme = getActiveTheme();
    console.log(
      theme.colors.tool(`\n  [Tool] ${toolName}`) +
        theme.colors.dim(" — executing..."),
    );
  }

  renderToolInput(toolName: string, input: unknown): void {
    const theme = getActiveTheme();
    console.log(
      theme.colors.dim(`  [Tool] ${toolName} — input: `) +
        theme.colors.dim(truncate(JSON.stringify(input), 120)),
    );
  }

  renderToolResult(_toolName: string, content: string, isError: boolean): void {
    const theme = getActiveTheme();
    console.log(
      theme.colors.toolResult("  [Tool Result] ") +
        (isError
          ? theme.colors.error(truncate(content, 200))
          : theme.colors.dim(truncate(content, 200))),
    );
  }

  renderError(error: string, suggestion?: string): void {
    const theme = getActiveTheme();
    if (suggestion) {
      console.error(theme.colors.error(`\n${error}\n  ${suggestion}`));
    } else {
      console.error(theme.colors.error(`\n  ${error}`));
    }
  }

  renderSystemMessage(text: string): void {
    const theme = getActiveTheme();
    console.log(theme.colors.dim(text));
  }

  renderHelp(commands: Array<{ name: string; description: string }>): void {
    const theme = getActiveTheme();
    console.log(theme.colors.dim("  Commands:"));
    for (const cmd of commands) {
      console.log(theme.colors.dim(`    ${cmd.name}  — ${cmd.description}`));
    }
    console.log(theme.colors.dim('  Use "\\" at end of line for multi-line input,'));
    console.log(theme.colors.dim('  then "." on its own line to finish.'));
  }
}
