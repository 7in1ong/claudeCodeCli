/**
 * ConfigManager Unit Tests
 *
 * Covers: load with defaults, get/set individual keys, getAll, reset,
 * auto-creation of config file, handling corrupted config, persistence.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, readFileSync, existsSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ConfigManager } from "../src/config/config-manager.js";

describe("ConfigManager", () => {
  let tempDir: string;
  let configPath: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "config-test-"));
    configPath = join(tempDir, ".claude-code", "config.json");
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  // ---------------------------------------------------------------------------
  // First run — auto-creation with defaults
  // ---------------------------------------------------------------------------
  describe("first run / auto-creation", () => {
    it("should create config file with defaults when none exists", () => {
      const cm = new ConfigManager(configPath);
      expect(existsSync(configPath)).toBe(true);
      expect(cm.get("theme")).toBe("default");
      expect(cm.get("model")).toBe("claude-sonnet-4-20250514");
      expect(cm.get("autoConfirm")).toBe(false);
      expect(cm.get("maxTokens")).toBe(4096);
      expect(cm.get("apiKey")).toBe("");
    });

    it("should create parent directories if they don't exist", () => {
      const deepPath = join(tempDir, "a", "b", "c", "config.json");
      new ConfigManager(deepPath);
      expect(existsSync(deepPath)).toBe(true);
    });

    it("should write valid JSON to the config file", () => {
      new ConfigManager(configPath);
      const raw = readFileSync(configPath, "utf-8");
      const parsed = JSON.parse(raw);
      expect(parsed).toHaveProperty("theme");
      expect(parsed).toHaveProperty("model");
      expect(parsed).toHaveProperty("autoConfirm");
      expect(parsed).toHaveProperty("maxTokens");
      expect(parsed).toHaveProperty("apiKey");
    });
  });

  // ---------------------------------------------------------------------------
  // get / set
  // ---------------------------------------------------------------------------
  describe("get and set", () => {
    it("should return default value for get() before any set()", () => {
      const cm = new ConfigManager(configPath);
      expect(cm.get("theme")).toBe("default");
    });

    it("should persist a set() call and read it back via get()", () => {
      const cm = new ConfigManager(configPath);
      cm.set("theme", "dark");
      expect(cm.get("theme")).toBe("dark");
    });

    it("should persist set() to disk immediately", () => {
      const cm = new ConfigManager(configPath);
      cm.set("theme", "light");
      const raw = readFileSync(configPath, "utf-8");
      const parsed = JSON.parse(raw);
      expect(parsed.theme).toBe("light");
    });

    it("should survive reload — new ConfigManager reads persisted values", () => {
      const cm1 = new ConfigManager(configPath);
      cm1.set("theme", "dark");
      cm1.set("maxTokens", 8192);

      const cm2 = new ConfigManager(configPath);
      expect(cm2.get("theme")).toBe("dark");
      expect(cm2.get("maxTokens")).toBe(8192);
    });

    it("should handle boolean values correctly", () => {
      const cm = new ConfigManager(configPath);
      cm.set("autoConfirm", true);
      expect(cm.get("autoConfirm")).toBe(true);
      cm.set("autoConfirm", false);
      expect(cm.get("autoConfirm")).toBe(false);
    });

    it("should handle numeric values correctly", () => {
      const cm = new ConfigManager(configPath);
      cm.set("maxTokens", 16384);
      expect(cm.get("maxTokens")).toBe(16384);
    });

    it("should handle string values correctly", () => {
      const cm = new ConfigManager(configPath);
      cm.set("apiKey", "sk-test-123");
      expect(cm.get("apiKey")).toBe("sk-test-123");
    });
  });

  // ---------------------------------------------------------------------------
  // getAll
  // ---------------------------------------------------------------------------
  describe("getAll", () => {
    it("should return all config values", () => {
      const cm = new ConfigManager(configPath);
      const all = cm.getAll();
      expect(all).toHaveProperty("theme");
      expect(all).toHaveProperty("model");
      expect(all).toHaveProperty("apiKey");
      expect(all).toHaveProperty("autoConfirm");
      expect(all).toHaveProperty("maxTokens");
    });

    it("should return a copy (not a reference to internal state)", () => {
      const cm = new ConfigManager(configPath);
      const all1 = cm.getAll();
      all1.theme = "mutated";
      expect(cm.get("theme")).toBe("default");
    });
  });

  // ---------------------------------------------------------------------------
  // reset
  // ---------------------------------------------------------------------------
  describe("reset", () => {
    it("should restore all values to defaults", () => {
      const cm = new ConfigManager(configPath);
      cm.set("theme", "dark");
      cm.set("maxTokens", 99999);
      cm.set("apiKey", "sk-secret");

      cm.reset();

      expect(cm.get("theme")).toBe("default");
      expect(cm.get("maxTokens")).toBe(4096);
      expect(cm.get("apiKey")).toBe("");
      expect(cm.get("autoConfirm")).toBe(false);
    });

    it("should persist reset to disk", () => {
      const cm = new ConfigManager(configPath);
      cm.set("theme", "dark");
      cm.reset();

      const cm2 = new ConfigManager(configPath);
      expect(cm2.get("theme")).toBe("default");
    });
  });

  // ---------------------------------------------------------------------------
  // Corrupted config
  // ---------------------------------------------------------------------------
  describe("corrupted config handling", () => {
    it("should fall back to defaults when config file contains invalid JSON", () => {
      const dir = join(tempDir, ".claude-code");
      mkdirSync(dir, { recursive: true });
      writeFileSync(configPath, "{ this is not valid json", "utf-8");

      const cm = new ConfigManager(configPath);
      expect(cm.get("theme")).toBe("default");
      expect(cm.get("model")).toBe("claude-sonnet-4-20250514");
    });
  });

  // ---------------------------------------------------------------------------
  // Partial config (new keys added in later versions)
  // ---------------------------------------------------------------------------
  describe("partial config / forward compatibility", () => {
    it("should merge partial config with defaults for missing keys", () => {
      const dir = join(tempDir, ".claude-code");
      mkdirSync(dir, { recursive: true });
      writeFileSync(configPath, JSON.stringify({ theme: "dark" }), "utf-8");

      const cm = new ConfigManager(configPath);
      expect(cm.get("theme")).toBe("dark");
      expect(cm.get("model")).toBe("claude-sonnet-4-20250514");
      expect(cm.get("autoConfirm")).toBe(false);
      expect(cm.get("maxTokens")).toBe(4096);
    });
  });

  // ---------------------------------------------------------------------------
  // getPath
  // ---------------------------------------------------------------------------
  describe("getPath", () => {
    it("should return the config file path", () => {
      const cm = new ConfigManager(configPath);
      expect(cm.getPath()).toBe(configPath);
    });
  });
});
