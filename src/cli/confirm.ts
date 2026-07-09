/**
 * Confirmation Handler
 *
 * Prompts the user for approval before executing potentially dangerous
 * operations (shell commands, file writes). Can be bypassed entirely
 * via the --yes CLI flag for non-interactive / CI usage.
 *
 * Uses a dedicated readline interface on stdin/stdout so it works
 * both inside the REPL and in one-shot (-m) mode.
 */

import { createInterface, type Interface as ReadlineInterface } from "node:readline";
import chalk from "chalk";

/**
 * ConfirmationHandler
 *
 * Asks the user to approve or deny an action before it runs.
 * When `autoApprove` is true (the --yes flag), every action is
 * approved silently — no prompt is shown.
 */
export class ConfirmationHandler {
  private autoApprove: boolean;
  private rl: ReadlineInterface | null = null;

  constructor(options: { autoApprove?: boolean } = {}) {
    this.autoApprove = options.autoApprove ?? false;
  }

  /**
   * Prompt the user to approve an action.
   *
   * @param action  - Short label describing the action (e.g. "Execute command").
   * @param details - The concrete details to display (e.g. the shell command).
   * @returns true if approved (or auto-approved), false if denied.
   */
  async confirm(action: string, details: string): Promise<boolean> {
    if (this.autoApprove) return true;

    // Lazy-init the readline interface so one-shot mode never opens one
    // unless a prompt is actually needed.
    if (!this.rl) {
      this.rl = createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: true,
      });
    }

    console.log(chalk.yellow(`\n  ┌─ ${action}`));
    // Indent each line of the details for readability
    for (const line of details.split("\n")) {
      console.log(chalk.yellow(`  │  `) + chalk.dim(line));
    }
    console.log(chalk.yellow(`  └─`));

    return new Promise<boolean>((resolve) => {
      this.rl!.question(
        chalk.yellow("  Allow? (y/n) "),
        (answer: string) => {
          const normalized = answer.trim().toLowerCase();
          if (normalized === "y" || normalized === "yes") {
            console.log(chalk.green("  ✓ Approved"));
            resolve(true);
          } else {
            console.log(chalk.red("  ✗ Denied"));
            resolve(false);
          }
        },
      );
    });
  }

  /** Whether auto-approve mode is active. */
  isAutoApprove(): boolean {
    return this.autoApprove;
  }

  /** Close the underlying readline interface, if any. */
  close(): void {
    if (this.rl) {
      this.rl.close();
      this.rl = null;
    }
  }
}
