/**
 * Theme System Unit Tests
 *
 * Covers: theme registry (register, get, list), active theme switching,
 * built-in themes availability, custom theme registration, and
 * /theme command logic (switching + validation).
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  registerTheme,
  getTheme,
  getActiveTheme,
  setActiveTheme,
  listThemeNames,
} from "../src/ui/themes/index.js";
import type { Theme } from "../src/ui/themes/theme.js";

describe("Theme Registry", () => {
  // Reset active theme before each test for isolation
  beforeEach(() => {
    setActiveTheme("default");
  });

  // ---------------------------------------------------------------------------
  // Built-in themes
  // ---------------------------------------------------------------------------
  describe("built-in themes", () => {
    it("should have 'default' theme registered", () => {
      const theme = getTheme("default");
      expect(theme).toBeDefined();
      expect(theme!.name).toBe("default");
      expect(theme!.displayName).toBe("Default");
    });

    it("should have 'dark' theme registered", () => {
      const theme = getTheme("dark");
      expect(theme).toBeDefined();
      expect(theme!.name).toBe("dark");
      expect(theme!.displayName).toBe("Dark");
    });

    it("should have 'light' theme registered", () => {
      const theme = getTheme("light");
      expect(theme).toBeDefined();
      expect(theme!.name).toBe("light");
      expect(theme!.displayName).toBe("Light");
    });

    it("should list all three built-in themes", () => {
      const names = listThemeNames();
      expect(names).toContain("default");
      expect(names).toContain("dark");
      expect(names).toContain("light");
    });

    it("each built-in theme should have all required color keys", () => {
      const requiredKeys = [
        "assistant", "user", "error", "warning", "success",
        "tool", "toolResult", "dim", "prompt",
        "bannerTitle", "bannerMeta",
        "confirmBorder", "confirmApproved", "confirmDenied",
      ];

      for (const name of ["default", "dark", "light"]) {
        const theme = getTheme(name)!;
        for (const key of requiredKeys) {
          expect(theme.colors).toHaveProperty(key);
          expect(typeof theme.colors[key as keyof typeof theme.colors]).toBe("function");
        }
      }
    });
  });

  // ---------------------------------------------------------------------------
  // Active theme
  // ---------------------------------------------------------------------------
  describe("active theme", () => {
    it("should default to 'default' theme", () => {
      const active = getActiveTheme();
      expect(active.name).toBe("default");
    });

    it("should switch to 'dark' theme via setActiveTheme", () => {
      const result = setActiveTheme("dark");
      expect(result).toBe(true);
      expect(getActiveTheme().name).toBe("dark");
    });

    it("should switch to 'light' theme via setActiveTheme", () => {
      const result = setActiveTheme("light");
      expect(result).toBe(true);
      expect(getActiveTheme().name).toBe("light");
    });

    it("should return false for unknown theme name", () => {
      const result = setActiveTheme("nonexistent");
      expect(result).toBe(false);
    });

    it("should NOT change active theme when setActiveTheme fails", () => {
      setActiveTheme("dark"); // switch to dark first
      const result = setActiveTheme("nonexistent");
      expect(result).toBe(false);
      expect(getActiveTheme().name).toBe("dark"); // still dark
    });
  });

  // ---------------------------------------------------------------------------
  // Custom theme registration
  // ---------------------------------------------------------------------------
  describe("custom theme registration", () => {
    const customTheme: Theme = {
      name: "custom-test",
      displayName: "Custom Test",
      colors: {
        assistant: (s) => s,
        user: (s) => s,
        error: (s) => s,
        warning: (s) => s,
        success: (s) => s,
        tool: (s) => s,
        toolResult: (s) => s,
        dim: (s) => s,
        prompt: (s) => s,
        bannerTitle: (s) => s,
        bannerMeta: (s) => s,
        confirmBorder: (s) => s,
        confirmApproved: (s) => s,
        confirmDenied: (s) => s,
      },
    };

    it("should register a new theme", () => {
      registerTheme(customTheme);
      expect(getTheme("custom-test")).toBeDefined();
      expect(getTheme("custom-test")!.displayName).toBe("Custom Test");
    });

    it("should make custom theme switchable", () => {
      registerTheme(customTheme);
      const result = setActiveTheme("custom-test");
      expect(result).toBe(true);
      expect(getActiveTheme().name).toBe("custom-test");
    });

    it("should appear in listThemeNames after registration", () => {
      registerTheme(customTheme);
      expect(listThemeNames()).toContain("custom-test");
    });

    it("should overwrite existing theme with the same name", () => {
      const updated: Theme = { ...customTheme, displayName: "Updated Custom" };
      registerTheme(updated);
      expect(getTheme("custom-test")!.displayName).toBe("Updated Custom");
    });
  });

  // ---------------------------------------------------------------------------
  // getTheme
  // ---------------------------------------------------------------------------
  describe("getTheme", () => {
    it("should return undefined for unregistered theme", () => {
      expect(getTheme("no-such-theme")).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // Color functions produce styled output
  // ---------------------------------------------------------------------------
  describe("color functions", () => {
    it("each color function should accept a string and return a string", () => {
      const theme = getActiveTheme();
      const colorKeys = Object.keys(theme.colors) as (keyof typeof theme.colors)[];
      for (const key of colorKeys) {
        const result = theme.colors[key]("test");
        expect(typeof result).toBe("string");
        // The result should contain the input text (chalk wraps it)
        expect(result).toContain("test");
      }
    });
  });
});
