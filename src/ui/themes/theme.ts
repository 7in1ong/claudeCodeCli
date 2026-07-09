/**
 * Theme Interface
 *
 * Defines the color palette used by the CLI renderer.
 * Every chalk-based output goes through a Theme so the
 * entire color scheme can be swapped at runtime.
 */

/**
 * A color function signature compatible with chalk.
 * Accepts a string and returns a styled string.
 */
export type ColorFn = (text: string) => string;

/**
 * Complete color mapping for every rendering scenario in the CLI.
 */
export interface ThemeColors {
  /** Assistant (Claude) response text */
  assistant: ColorFn;
  /** User message label and text */
  user: ColorFn;
  /** Error messages */
  error: ColorFn;
  /** Warning messages */
  warning: ColorFn;
  /** Success indicators (e.g. ✓ Approved, spinner success) */
  success: ColorFn;
  /** Tool name and status labels */
  tool: ColorFn;
  /** Tool result output */
  toolResult: ColorFn;
  /** Dim / secondary text (hints, timestamps, separators) */
  dim: ColorFn;
  /** Prompt string (e.g. "> ") */
  prompt: ColorFn;
  /** Banner title */
  bannerTitle: ColorFn;
  /** Banner subtitle / meta info */
  bannerMeta: ColorFn;
  /** Confirmation prompt border */
  confirmBorder: ColorFn;
  /** Confirmation approved text */
  confirmApproved: ColorFn;
  /** Confirmation denied text */
  confirmDenied: ColorFn;
}

/**
 * A complete theme definition: a name plus the full color palette.
 */
export interface Theme {
  /** Unique theme identifier (used in config and /theme command) */
  name: string;
  /** Human-readable display name */
  displayName: string;
  /** The color palette */
  colors: ThemeColors;
}
