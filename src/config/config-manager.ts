/**
 * ConfigManager
 *
 * Type-safe configuration manager that persists user preferences
 * to ~/.claude-code/config.json. Creates the config file with
 * sensible defaults on first access.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { homedir } from "node:os";

// ---------------------------------------------------------------------------
// Config schema
// ---------------------------------------------------------------------------

export interface Config {
  /** Active model identifier (e.g. "claude-sonnet-4-20250514") */
  model: string;
  /** Anthropic API key (empty string = use env var) */
  apiKey: string;
  /** Active theme name */
  theme: string;
  /** Auto-approve tool actions without prompting */
  autoConfirm: boolean;
  /** Maximum tokens per response */
  maxTokens: number;
}

/** Every key in Config, as a union type for type-safe access. */
export type ConfigKey = keyof Config;

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG: Config = {
  model: "claude-sonnet-4-20250514",
  apiKey: "",
  theme: "default",
  autoConfirm: false,
  maxTokens: 4096,
};

// ---------------------------------------------------------------------------
// ConfigManager
// ---------------------------------------------------------------------------

export class ConfigManager {
  private configPath: string;
  private config: Config;

  constructor(configPath?: string) {
    this.configPath = configPath ?? join(homedir(), ".claude-code", "config.json");
    this.config = this.load();
  }

  /**
   * Read a single config value by key.
   */
  get<K extends ConfigKey>(key: K): Config[K] {
    return this.config[key];
  }

  /**
   * Write a single config value. Persists immediately to disk.
   */
  set<K extends ConfigKey>(key: K, value: Config[K]): void {
    this.config[key] = value;
    this.save();
  }

  /**
   * Return a shallow copy of the full config object.
   */
  getAll(): Readonly<Config> {
    return { ...this.config };
  }

  /**
   * Reset all config values to their defaults and persist.
   */
  reset(): void {
    this.config = { ...DEFAULT_CONFIG };
    this.save();
  }

  /** Absolute path to the config file (useful for diagnostics). */
  getPath(): string {
    return this.configPath;
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private load(): Config {
    if (!existsSync(this.configPath)) {
      // First run — create the file with defaults
      this.config = { ...DEFAULT_CONFIG };
      this.save();
      return this.config;
    }

    try {
      const raw = readFileSync(this.configPath, "utf-8");
      const parsed = JSON.parse(raw) as Partial<Config>;
      // Merge with defaults so new keys are always present
      return { ...DEFAULT_CONFIG, ...parsed };
    } catch {
      // Corrupted config — fall back to defaults and overwrite
      this.config = { ...DEFAULT_CONFIG };
      this.save();
      return this.config;
    }
  }

  private save(): void {
    const dir = dirname(this.configPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(this.configPath, JSON.stringify(this.config, null, 2) + "\n", "utf-8");
  }
}
