/**
 * Theme Registry
 *
 * Central registry for all available themes. Provides lookup by name
 * and a getter for the currently active theme.
 */

import type { Theme } from "./theme.js";
import { defaultTheme } from "./default.js";
import { darkTheme } from "./dark.js";
import { lightTheme } from "./light.js";

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

const themes = new Map<string, Theme>();

/** Register a theme. Later registrations with the same name overwrite. */
export function registerTheme(theme: Theme): void {
  themes.set(theme.name, theme);
}

/** Look up a theme by name. Returns undefined if not found. */
export function getTheme(name: string): Theme | undefined {
  return themes.get(name);
}

/** Return the names of all registered themes. */
export function listThemeNames(): string[] {
  return Array.from(themes.keys());
}

// ---------------------------------------------------------------------------
// Active theme
// ---------------------------------------------------------------------------

let activeTheme: Theme = defaultTheme;

/** Get the currently active theme. */
export function getActiveTheme(): Theme {
  return activeTheme;
}

/**
 * Set the active theme by name.
 * Returns true if the theme was found and activated, false otherwise.
 */
export function setActiveTheme(name: string): boolean {
  const theme = themes.get(name);
  if (!theme) return false;
  activeTheme = theme;
  return true;
}

// ---------------------------------------------------------------------------
// Built-in themes — register on module load
// ---------------------------------------------------------------------------

registerTheme(defaultTheme);
registerTheme(darkTheme);
registerTheme(lightTheme);
