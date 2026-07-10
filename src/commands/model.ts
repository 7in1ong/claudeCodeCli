/**
 * /model Command
 *
 * Switches the LLM model at runtime. Resets the client to force
 * re-initialization with the new model on the next API call.
 *
 * Usage:
 *   /model <name>        Switch to the specified model
 *   /model               Show the current model
 */

import { SlashCommand } from "./base.js";
import type { CommandContext } from "./context.js";
import type { ParsedArgs } from "./parser.js";
import type { ArgDefinition } from "./base.js";
import { resetClient } from "../llm/client.js";
import { getActiveTheme } from "../ui/themes/index.js";

export class ModelCommand extends SlashCommand {
  readonly name = "model";
  readonly aliases = ["m"];
  readonly description = "Switch or display the current LLM model";
  readonly args: ArgDefinition[] = [
    {
      name: "name",
      description: "Model identifier (e.g. claude-opus-4-20250514)",
      required: false,
      kind: "positional",
    },
  ];

  async execute(args: ParsedArgs, context: CommandContext): Promise<void> {
    const modelName = args.positionals[0];
    const theme = getActiveTheme();

    if (!modelName) {
      console.log(
        theme.colors.dim(`  Current model: `) + theme.colors.assistant(context.config.model),
      );
      return;
    }

    // Update config and reset the LLM client so the next call uses the new model
    context.config.model = modelName;
    resetClient();

    console.log(
      theme.colors.success(`  Model switched to: `) + theme.colors.assistant(modelName),
    );
  }
}
