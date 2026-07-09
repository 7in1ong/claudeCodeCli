/**
 * StatusBar Component
 *
 * Persistent bottom bar showing current model, token usage,
 * API connection status, and conversation turn count.
 */

import React from "react";
import { Box, Text } from "ink";
import type { StatusBarState } from "./TuiBridge.js";
import { theme } from "./theme.js";

interface StatusBarProps {
  status: StatusBarState;
  isProcessing: boolean;
}

export function StatusBar({
  status,
  isProcessing,
}: StatusBarProps): React.ReactElement {
  const apiLabel = getApiLabel(status.apiStatus);
  const tokenDisplay = formatTokens(status.tokens, status.maxTokens);

  return (
    <Box
      paddingX={1}
      borderStyle="single"
      borderColor={theme.colors.border}
      justifyContent="space-between"
    >
      {/* Left: model + processing indicator */}
      <Box>
        <Text bold>Claude Code</Text>
        <Text dimColor> │ </Text>
        <Text dimColor>{status.model}</Text>
        {isProcessing && (
          <>
            <Text dimColor> │ </Text>
            <Text color={theme.colors.toolRunning}>● processing</Text>
          </>
        )}
      </Box>

      {/* Right: tokens + turns + API status */}
      <Box>
        <Text dimColor>tokens: {tokenDisplay}</Text>
        <Text dimColor> │ </Text>
        <Text dimColor>turns: {status.turnCount}</Text>
        <Text dimColor> │ </Text>
        <Text>{apiLabel}</Text>
      </Box>
    </Box>
  );
}

function getApiLabel(apiStatus: StatusBarState["apiStatus"]): string {
  switch (apiStatus) {
    case "connected":
      return "API";
    case "mock":
      return "Mock";
    case "error":
      return "Error";
  }
}

function formatTokens(tokens: number, maxTokens: number): string {
  if (tokens === 0) return "0";
  if (maxTokens > 0) {
    if (tokens >= 1000) {
      return `${(tokens / 1000).toFixed(1)}k/${(maxTokens / 1000).toFixed(0)}k`;
    }
    return `${tokens}/${maxTokens}`;
  }
  if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(1)}k`;
  }
  return String(tokens);
}
