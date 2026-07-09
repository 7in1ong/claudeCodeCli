/**
 * CLI Runner
 *
 * Orchestrates the CLI lifecycle: argument parsing, environment setup,
 * tool registration, and dispatching to the main conversation loop.
 */

import chalk from "chalk";
import ora from "ora";
import { ToolRegistry, ToolExecutor, registerBuiltInTools } from "../tools/index.js";

export async function run(): Promise<void> {
  const spinner = ora("Initializing Claude Code CLI...").start();

  // TODO: Parse CLI arguments
  // TODO: Load configuration

  // Initialize tool registry and register built-in tools
  const registry = new ToolRegistry();
  registerBuiltInTools(registry);
  const executor = new ToolExecutor(registry);

  spinner.succeed(
    chalk.green(
      `Claude Code CLI ready. ${registry.size} tool(s) registered: ${registry.list().map((t) => t.name).join(", ")}`,
    ),
  );

  // TODO: Initialize LLM client
  // TODO: Start interactive loop

  // Suppress unused-variable warnings during scaffold phase
  void executor;
}
