#!/usr/bin/env node

/**
 * Claude Code CLI - Entry Point
 *
 * Main entry for the CLI application.
 * Parses command-line arguments and dispatches to the appropriate handler.
 */

import { run } from "./runner.js";

run().catch((error: unknown) => {
  if (error instanceof Error) {
    console.error(`Error: ${error.message}`);
  } else {
    console.error("An unknown error occurred");
  }
  process.exit(1);
});
