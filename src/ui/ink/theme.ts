/**
 * TUI Theme Constants
 *
 * Colors and layout values for the Ink-based TUI renderer.
 */

export const theme = {
  colors: {
    user: "blue",
    assistant: "cyan",
    system: "yellow",
    tool: "magenta",
    toolRunning: "yellow",
    toolSuccess: "green",
    toolError: "red",
    statusBg: "#1a1a2e",
    statusFg: "#a0a0b0",
    inputPrompt: "green",
    border: "#444466",
    dim: "#888888",
    error: "red",
    highlight: "cyan",
  },
  layout: {
    /** Height of the status bar (single line + borders). */
    statusBarHeight: 3,
    /** Height of the input area (single line + borders). */
    inputHeight: 3,
    /** Maximum height for the tool panel. */
    toolPanelMaxHeight: 8,
  },
} as const;
