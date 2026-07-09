/**
 * Default Theme
 *
 * The original color scheme — cyan assistant, blue user labels,
 * yellow tool indicators, magenta tool results.
 */

import chalk from "chalk";
import type { Theme } from "./theme.js";

export const defaultTheme: Theme = {
  name: "default",
  displayName: "Default",
  colors: {
    assistant: chalk.cyan,
    user: chalk.blue,
    error: chalk.red,
    warning: chalk.yellow,
    success: chalk.green,
    tool: chalk.yellow,
    toolResult: chalk.magenta,
    dim: chalk.dim,
    prompt: chalk.green,
    bannerTitle: chalk.bold.cyan,
    bannerMeta: chalk.dim,
    confirmBorder: chalk.yellow,
    confirmApproved: chalk.green,
    confirmDenied: chalk.red,
  },
};
