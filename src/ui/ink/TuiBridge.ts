/**
 * TuiBridge — Imperative-to-Declarative Bridge
 *
 * Bridges the imperative Renderer API (called by the agentic loop)
 * with the declarative React rendering model (Ink components).
 *
 * The runner calls methods on this object; React components subscribe
 * to events via the `useBridge` hook and re-render on state changes.
 *
 * Text delta throttling: `renderAssistantText()` is called per-token
 * (potentially hundreds of times per second). The bridge buffers deltas
 * and flushes them to React state at ~20fps to avoid excessive re-renders.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single entry in the conversation display history. */
export interface ConversationEntry {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
}

/** State of a tool being executed. */
export interface ToolDisplayState {
  id: string;
  name: string;
  status: "running" | "success" | "error" | "denied";
  input?: unknown;
  result?: string;
  isError?: boolean;
}

/** Status bar information. */
export interface StatusBarState {
  model: string;
  apiStatus: "connected" | "mock" | "error";
  tokens: number;
  maxTokens: number;
  turnCount: number;
  toolCount: number;
  autoApprove: boolean;
}

/** Confirmation dialog request. */
export interface ConfirmRequest {
  action: string;
  details: string;
  resolve: (value: boolean) => void;
}

/** Banner information. */
export interface BannerState {
  version: string;
  model: string;
  connected: boolean;
}

// ---------------------------------------------------------------------------
// Event types
// ---------------------------------------------------------------------------

type BridgeEventType =
  | "conversationUpdate"
  | "streamingUpdate"
  | "toolUpdate"
  | "statusUpdate"
  | "clearConversation"
  | "bannerUpdate"
  | "confirmation"
  | "exit";

type BridgeListener = (event: BridgeEventType, data?: unknown) => void;

// ---------------------------------------------------------------------------
// TuiBridge class
// ---------------------------------------------------------------------------

/**
 * Bridge between the imperative runner and the declarative React UI.
 *
 * The runner calls methods like `addUserMessage()`, `streamTextDelta()`,
 * etc. The bridge buffers and throttles updates, then emits events that
 * React components subscribe to via `useBridge()`.
 */
export class TuiBridge {
  private listeners: BridgeListener[] = [];

  // Accumulated state (mutated by the runner, read by React)
  private _messages: ConversationEntry[] = [];
  private _streamingText = "";
  private _isStreaming = false;
  private _tools: ToolDisplayState[] = [];
  private _status: StatusBarState = {
    model: "",
    apiStatus: "mock",
    tokens: 0,
    maxTokens: 4096,
    turnCount: 0,
    toolCount: 0,
    autoApprove: false,
  };
  private _banner: BannerState | null = null;
  private _nextId = 0;

  // Text delta throttling — flush at ~20fps
  private _pendingTextDelta = "";
  private _flushTimer: ReturnType<typeof setTimeout> | null = null;
  private static readonly FLUSH_INTERVAL_MS = 50;

  // ── Listener management ────────────────────────────────────────────

  addListener(listener: BridgeListener): void {
    this.listeners.push(listener);
  }

  removeListener(listener: BridgeListener): void {
    this.listeners = this.listeners.filter((l) => l !== listener);
  }

  private emit(event: BridgeEventType, data?: unknown): void {
    for (const listener of this.listeners) {
      listener(event, data);
    }
  }

  // ── Getters for React state ────────────────────────────────────────

  get messages(): ConversationEntry[] {
    return this._messages;
  }
  get streamingText(): string {
    return this._streamingText;
  }
  get isStreaming(): boolean {
    return this._isStreaming;
  }
  get tools(): ToolDisplayState[] {
    return this._tools;
  }
  get status(): StatusBarState {
    return this._status;
  }
  get banner(): BannerState | null {
    return this._banner;
  }

  // ── Imperative API called by the runner ────────────────────────────

  setBanner(version: string, model: string, connected: boolean): void {
    this._banner = { version, model, connected };
    this._status.model = model;
    this._status.apiStatus = connected ? "connected" : "mock";
    this.emit("bannerUpdate");
  }

  addUserMessage(text: string): void {
    this._messages.push({
      id: `msg-${this._nextId++}`,
      role: "user",
      content: text,
      timestamp: Date.now(),
    });
    this.emit("conversationUpdate");
  }

  addAssistantMessage(text: string): void {
    this._messages.push({
      id: `msg-${this._nextId++}`,
      role: "assistant",
      content: text,
      timestamp: Date.now(),
    });
    this.emit("conversationUpdate");
  }

  addSystemMessage(text: string): void {
    this._messages.push({
      id: `msg-${this._nextId++}`,
      role: "system",
      content: text,
      timestamp: Date.now(),
    });
    this.emit("conversationUpdate");
  }

  streamTextDelta(text: string): void {
    this._pendingTextDelta += text;
    if (!this._isStreaming) {
      this._isStreaming = true;
      this._streamingText = "";
    }

    // Throttle flushes
    if (!this._flushTimer) {
      this._flushTimer = setTimeout(
        () => this.flushStreamBuffer(),
        TuiBridge.FLUSH_INTERVAL_MS,
      );
    }
  }

  private flushStreamBuffer(): void {
    this._flushTimer = null;
    if (this._pendingTextDelta) {
      this._streamingText += this._pendingTextDelta;
      this._pendingTextDelta = "";
      this.emit("streamingUpdate");
    }
  }

  endStream(): void {
    // Flush any remaining buffered text
    if (this._flushTimer) {
      clearTimeout(this._flushTimer);
      this._flushTimer = null;
    }
    if (this._pendingTextDelta) {
      this._streamingText += this._pendingTextDelta;
      this._pendingTextDelta = "";
    }

    // Commit streaming text as a complete assistant message
    if (this._streamingText) {
      this.addAssistantMessage(this._streamingText);
    }
    this._streamingText = "";
    this._isStreaming = false;
    this.emit("streamingUpdate");
    this.emit("conversationUpdate");
  }

  toolStart(name: string): void {
    const id = `tool-${this._nextId++}`;
    this._tools.push({
      id,
      name,
      status: "running",
    });
    this.emit("toolUpdate");
  }

  toolInput(name: string, input: unknown): void {
    const tool = this._tools.find(
      (t) => t.name === name && t.status === "running",
    );
    if (tool) {
      tool.input = input;
    }
    this.emit("toolUpdate");
  }

  toolResult(name: string, result: string, isError: boolean): void {
    const tool = this._tools.find(
      (t) => t.name === name && t.status === "running",
    );
    if (tool) {
      tool.status = isError ? "error" : "success";
      tool.result = result;
      tool.isError = isError;
    }
    // Auto-remove completed tools after a short delay
    // (keep them visible briefly so the user sees the result)
    this.emit("toolUpdate");
  }

  updateStatus(partial: Partial<StatusBarState>): void {
    Object.assign(this._status, partial);
    this.emit("statusUpdate");
  }

  clearConversation(): void {
    this._messages = [];
    this._tools = [];
    this._streamingText = "";
    this._isStreaming = false;
    this.emit("clearConversation");
  }

  renderHelp(
    commands: Array<{ name: string; description: string }>,
  ): void {
    const helpText = commands
      .map((c) => `  ${c.name}  — ${c.description}`)
      .join("\n");
    this.addSystemMessage(helpText);
  }

  showError(error: string, suggestion?: string): void {
    const msg = suggestion ? `${error}\n${suggestion}` : error;
    this.addSystemMessage(`Error: ${msg}`);
    this.emit("conversationUpdate");
  }

  requestConfirmation(
    action: string,
    details: string,
  ): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      this.emit("confirmation", {
        action,
        details,
        resolve,
      } satisfies ConfirmRequest);
    });
  }

  signalExit(): void {
    this.emit("exit");
  }

  // ── Cleanup ────────────────────────────────────────────────────────

  dispose(): void {
    if (this._flushTimer) {
      clearTimeout(this._flushTimer);
      this._flushTimer = null;
    }
    this.listeners = [];
  }
}
