/**
 * Plain Renderer
 *
 * Default Renderer implementation that uses chalk + console.log for
 * output. Preserves the exact visual behavior of the original runner.ts
 * so the refactoring is behavior-transparent.
 */

import chalk from "chalk";
import type { Renderer } from "./renderer.js";
import { truncate } from "../utils/index.js";

export class PlainRenderer implements Renderer {
  renderBanner(version: string, model: string, connected: boolean): void {
    const modeLabel = connected
      ? chalk.green("API connected")
      : chalk.yellow("Mock mode");

    console.log(
      chalk.bold.cyan("\n  Claude Code CLI") + chalk.dim(` v${version}`),
    );
    console.log(chalk.dim(`  Model: ${model}  •  ${modeLabel}`));
    console.log(
      chalk.dim(
        '  Type a message to chat. "\\" at end of line for multi-line input.',
      ),
    );
    console.log(
      chalk.dim('  Type "/help" for commands, or "exit" to quit.\n'),
    );
  }

  renderUserMessage(text: string): void {
    console.log(chalk.blue("You: ") + text);
  }

  renderAssistantText(text: string): void {
    process.stdout.write(chalk.cyan(text));
  }

  renderToolStart(toolName: string): void {
    console.log(
      chalk.yellow(`\n  [Tool] ${toolName}`) + chalk.dim(" — executing..."),
    );
  }

  renderToolInput(toolName: string, input: unknown): void {
    console.log(
      chalk.dim(`  [Tool] ${toolName} — input: `) +
        chalk.dim(truncate(JSON.stringify(input), 120)),
    );
  }

  renderToolResult(_toolName: string, content: string, isError: boolean): void {
    console.log(
      chalk.magenta("  [Tool Result] ") +
        (isError
          ? chalk.red(truncate(content, 200))
          : chalk.dim(truncate(content, 200))),
    );
  }

  renderError(error: string, suggestion?: string): void {
    if (suggestion) {
      console.error(chalk.red(`\n${error}\n  ${suggestion}`));
    } else {
      console.error(chalk.red(`\n  ${error}`));
    }
  }

  renderSystemMessage(text: string): void {
    console.log(chalk.dim(text));
  }

  renderHelp(commands: Array<{ name: string; description: string }>): void {
    console.log(chalk.dim("  Commands:"));
    for (const cmd of commands) {
      console.log(chalk.dim(`    ${cmd.name}  — ${cmd.description}`));
    }
    console.log(chalk.dim('  Use "\\" at end of line for multi-line input,'));
    console.log(chalk.dim('  then "." on its own line to finish.'));
  }
}
