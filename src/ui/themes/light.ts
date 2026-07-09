/**
 * Light / High-Contrast Theme
 *
 * Designed for light terminal backgrounds. Uses darker, bolder
 * colors for maximum readability on white/light backgrounds.
 */

import chalk from "chalk";
import type { Theme } from "./theme.js";

export const lightTheme: Theme = {
  name: "light",
  displayName: "Light",
  colors: {
    assistant: chalk.blue,
    user: chalk.magenta,
    error: chalk.bold.red,
    warning: chalk.bold.yellow,
    success: chalk.bold.green,
    tool: chalk.magenta,
    toolResult: chalk.blue,
    dim: chalk.gray,
    prompt: chalk.bold.blue,
    bannerTitle: chalk.bold.blue,
    bannerMeta: chalk.gray,
    confirmBorder: chalk.bold.magenta,
    confirmApproved: chalk.bold.green,
    confirmDenied: chalk.bold.red,
  },
};
