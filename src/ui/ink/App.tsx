/**
 * TUI App Component
 *
 * The main Ink application component that orchestrates all panels.
 * Composes ConversationPanel, ToolPanel, StatusBar, and InputPanel
 * into a full-screen layout.
 *
 * Includes the `useBridge` hook that subscribes to TuiBridge events
 * and provides reactive React state.
 */

import React, { useState, useEffect, useCallback } from "react";
import { Box, Text, useApp, useInput, useStdout } from "ink";
import {
  TuiBridge,
  type ConversationEntry,
  type ToolDisplayState,
  type StatusBarState,
  type ConfirmRequest,
  type BannerState,
} from "./TuiBridge.js";
import { ConversationPanel } from "./ConversationPanel.js";
import { ToolPanel } from "./ToolPanel.js";
import { StatusBar } from "./StatusBar.js";
import { InputPanel } from "./InputPanel.js";
import { theme } from "./theme.js";

// ---------------------------------------------------------------------------
// useBridge hook
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

function useBridge(bridge: TuiBridge) {
  const [messages, setMessages] = useState<ConversationEntry[]>([
    ...bridge.messages,
  ]);
  const [streamingText, setStreamingText] = useState(bridge.streamingText);
  const [isStreaming, setIsStreaming] = useState(bridge.isStreaming);
  const [tools, setTools] = useState<ToolDisplayState[]>([...bridge.tools]);
  const [status, setStatus] = useState<StatusBarState>({ ...bridge.status });
  const [banner, setBanner] = useState<BannerState | null>(bridge.banner);
  const [confirmRequest, setConfirmRequest] =
    useState<ConfirmRequest | null>(null);

  useEffect(() => {
    const listener: BridgeListener = (event, data) => {
      switch (event) {
        case "conversationUpdate":
          setMessages([...bridge.messages]);
          break;
        case "streamingUpdate":
          setStreamingText(bridge.streamingText);
          setIsStreaming(bridge.isStreaming);
          break;
        case "toolUpdate":
          setTools([...bridge.tools]);
          break;
        case "statusUpdate":
          setStatus({ ...bridge.status });
          break;
        case "clearConversation":
          setMessages([]);
          setTools([]);
          setStreamingText("");
          setIsStreaming(false);
          break;
        case "bannerUpdate":
          setBanner(bridge.banner);
          break;
        case "confirmation":
          setConfirmRequest(data as ConfirmRequest);
          break;
      }
    };

    bridge.addListener(listener);
    return () => bridge.removeListener(listener);
  }, [bridge]);

  return {
    messages,
    streamingText,
    isStreaming,
    tools,
    status,
    banner,
    confirmRequest,
    setConfirmRequest,
  };
}

// ---------------------------------------------------------------------------
// Confirmation dialog
// ---------------------------------------------------------------------------

function ConfirmDialog({
  request,
}: {
  request: ConfirmRequest;
}): React.ReactElement {
  useInput((input) => {
    const key = input.trim().toLowerCase();
    if (key === "y" || key === "yes") {
      request.resolve(true);
    } else if (key === "n" || key === "no") {
      request.resolve(false);
    }
  });

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={theme.colors.toolRunning}
      paddingX={1}
      marginX={2}
    >
      <Text bold color={theme.colors.toolRunning}>
        ⚠ {request.action}
      </Text>
      {request.details.split("\n").map((line, i) => (
        <Text key={i} dimColor>
          {line}
        </Text>
      ))}
      <Text color={theme.colors.toolRunning}>Allow? (y/n)</Text>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Banner
// ---------------------------------------------------------------------------

function Banner({
  banner,
}: {
  banner: BannerState;
}): React.ReactElement {
  const modeLabel = banner.connected ? "API connected" : "Mock mode";
  const modeColor = banner.connected ? "green" : "yellow";

  return (
    <Box flexDirection="column" paddingX={1} marginBottom={1}>
      <Text bold color="cyan">
        Claude Code CLI{" "}
        <Text dimColor>v{banner.version}</Text>
      </Text>
      <Text dimColor>
        Model: {banner.model} • <Text color={modeColor}>{modeLabel}</Text>
      </Text>
      <Text dimColor>
        Type a message to chat. &quot;\&quot; at end of line for
        multi-line. /help for commands.
      </Text>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// App component
// ---------------------------------------------------------------------------

interface AppProps {
  bridge: TuiBridge;
  inputHandler: (input: string) => Promise<void>;
}

export function App({
  bridge,
  inputHandler,
}: AppProps): React.ReactElement {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const terminalHeight = stdout?.rows ?? 24;
  const terminalWidth = stdout?.columns ?? 80;

  const {
    messages,
    streamingText,
    isStreaming,
    tools,
    status,
    banner,
    confirmRequest,
    setConfirmRequest,
  } = useBridge(bridge);

  const isProcessing =
    isStreaming || tools.some((t) => t.status === "running");

  // Handle Ctrl+C
  useInput((input, key) => {
    if (key.ctrl && input === "c") {
      bridge.signalExit();
      exit();
    }
  });

  // Handle exit event from bridge
  useEffect(() => {
    const listener: BridgeListener = (event) => {
      if (event === "exit") {
        exit();
      }
    };
    bridge.addListener(listener);
    return () => bridge.removeListener(listener);
  }, [bridge, exit]);

  // Input submission handler
  const handleSubmit = useCallback(
    async (text: string) => {
      await inputHandler(text);
    },
    [inputHandler],
  );

  // Confirmation response handler
  const handleConfirmResponse = useCallback(
    (result: boolean) => {
      if (confirmRequest) {
        confirmRequest.resolve(result);
        setConfirmRequest(null);
      }
    },
    [confirmRequest, setConfirmRequest],
  );

  // Calculate layout heights
  const statusBarHeight = theme.layout.statusBarHeight;
  const inputHeight = theme.layout.inputHeight;
  const toolPanelHeight =
    tools.length > 0
      ? Math.min(tools.length + 2, theme.layout.toolPanelMaxHeight)
      : 0;
  const bannerHeight = banner ? 4 : 0;
  const confirmHeight = confirmRequest ? 5 : 0;
  const conversationHeight = Math.max(
    5,
    terminalHeight -
      statusBarHeight -
      inputHeight -
      toolPanelHeight -
      bannerHeight -
      confirmHeight,
  );

  return (
    <Box
      flexDirection="column"
      height={terminalHeight}
      width={terminalWidth}
    >
      {/* Banner */}
      {banner && <Banner banner={banner} />}

      {/* Confirmation dialog overlay */}
      {confirmRequest && (
        <ConfirmDialog
          request={{
            ...confirmRequest,
            resolve: handleConfirmResponse,
          }}
        />
      )}

      {/* Main content area */}
      <Box flexDirection="column" flexGrow={1} overflow="hidden">
        <ConversationPanel
          messages={messages}
          streamingText={streamingText}
          isStreaming={isStreaming}
          height={conversationHeight}
        />
        <ToolPanel
          tools={tools}
          maxHeight={theme.layout.toolPanelMaxHeight}
        />
      </Box>

      {/* Status bar */}
      <StatusBar status={status} isProcessing={isProcessing} />

      {/* Input area */}
      <InputPanel onSubmit={handleSubmit} disabled={isProcessing} />
    </Box>
  );
}
