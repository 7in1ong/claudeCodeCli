/**
 * InkRenderer — TUI Renderer Implementation
 *
 * Implements the Renderer interface using Ink (React for CLI).
 * Provides a panel-based layout with:
 *   - Conversation panel (scrollable history with Markdown rendering)
 *   - Tool execution panel (real-time status indicators)
 *   - Status bar (model, tokens, API status)
 *   - Input panel (with history navigation and multi-line support)
 *
 * All rendering is delegated to a TuiBridge, which the React App
 * component subscribes to for reactive updates.
 *
 * When `startInteractive()` is called, the InkRenderer replaces the
 * readline-based REPL with an Ink application that owns stdin.
 */

import React from "react";
import { render as inkRender, type Instance as InkInstance } from "ink";
import type { Renderer } from "./renderer.js";
import { App } from "./ink/App.js";
import { TuiBridge } from "./ink/TuiBridge.js";

export class InkRenderer implements Renderer {
  private bridge: TuiBridge;
  private inkInstance: InkInstance | null = null;
  private autoApproveFlag = false;
  private exitResolve: (() => void) | null = null;

  constructor(options?: { autoApprove?: boolean }) {
    this.bridge = new TuiBridge();
    this.autoApproveFlag = options?.autoApprove ?? false;
  }

  // ── Renderer interface implementation ──────────────────────────────

  renderBanner(version: string, model: string, connected: boolean): void {
    this.bridge.setBanner(version, model, connected);
  }

  renderUserMessage(text: string): void {
    this.bridge.addUserMessage(text);
  }

  renderAssistantText(text: string): void {
    this.bridge.streamTextDelta(text);
  }

  endStream(): void {
    this.bridge.endStream();
  }

  renderToolStart(toolName: string): void {
    this.bridge.toolStart(toolName);
  }

  renderToolInput(toolName: string, input: unknown): void {
    this.bridge.toolInput(toolName, input);
  }

  renderToolResult(
    toolName: string,
    content: string,
    isError: boolean,
  ): void {
    this.bridge.toolResult(toolName, content, isError);
  }

  renderError(error: string, suggestion?: string): void {
    this.bridge.showError(error, suggestion);
  }

  renderSystemMessage(text: string): void {
    this.bridge.addSystemMessage(text);
  }

  renderHelp(
    commands: Array<{ name: string; description: string }>,
  ): void {
    this.bridge.renderHelp(commands);
  }

  renderNewline(): void {
    // No-op in TUI mode — visual separation is handled by layout
  }

  // ── TUI-specific optional methods ──────────────────────────────────

  async startInteractive(
    handler: (input: string) => Promise<void>,
  ): Promise<void> {
    return new Promise<void>((resolve) => {
      this.exitResolve = resolve;

      this.inkInstance = inkRender(
        React.createElement(App, {
          bridge: this.bridge,
          inputHandler: handler,
        }),
        {
          exitOnCtrlC: false,
        },
      );

      this.inkInstance.waitUntilExit().then(() => {
        resolve();
      });
    });
  }

  async confirm(action: string, details: string): Promise<boolean> {
    if (this.autoApproveFlag) return true;
    return this.bridge.requestConfirmation(action, details);
  }

  cleanup(): void {
    if (this.inkInstance) {
      this.inkInstance.unmount();
      this.inkInstance = null;
    }
    this.bridge.dispose();
  }

  // ── Internal helpers ───────────────────────────────────────────────

  /**
   * Signal the Ink app to exit. Called when the user types an exit command.
   */
  exit(): void {
    this.bridge.signalExit();
    if (this.exitResolve) {
      this.exitResolve();
    }
  }
}
