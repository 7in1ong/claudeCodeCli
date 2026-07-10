/**
 * Dark Theme
 *
 * A darker, muted palette with higher contrast between elements.
 * Uses brighter accent colors on a conceptual "dark" background.
 */

import chalk from "chalk";
import type { Theme } from "./theme.js";

export const darkTheme: Theme = {
  name: "dark",
  displayName: "Dark",
  colors: {
    assistant: chalk.white,
    user: chalk.blueBright,
    error: chalk.redBright,
    warning: chalk.yellowBright,
    success: chalk.greenBright,
    tool: chalk.magentaBright,
    toolResult: chalk.cyanBright,
    dim: chalk.gray,
    prompt: chalk.greenBright,
    bannerTitle: chalk.bold.white,
    bannerMeta: chalk.gray,
    confirmBorder: chalk.magentaBright,
    confirmApproved: chalk.greenBright,
    confirmDenied: chalk.redBright,
  },
};
