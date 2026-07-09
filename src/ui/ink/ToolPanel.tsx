/**
 * ToolPanel Component
 *
 * Displays tool execution status in real-time.
 * Shows each tool's name, status (running/complete/error), input preview,
 * and optionally the result.
 */

import React from "react";
import { Box, Text } from "ink";
import type { ToolDisplayState } from "./TuiBridge.js";
import { theme } from "./theme.js";

interface ToolPanelProps {
  tools: ToolDisplayState[];
  maxHeight: number;
}

export function ToolPanel({
  tools,
  maxHeight,
}: ToolPanelProps): React.ReactElement {
  // Only show running or recently completed tools
  const activeTools = tools.filter(
    (t) => t.status === "running" || tools.indexOf(t) >= tools.length - 3,
  );

  if (activeTools.length === 0) {
    return <></>;
  }

  const visibleTools = activeTools.slice(-maxHeight);

  return (
    <Box
      flexDirection="column"
      borderTop={true}
      borderColor={theme.colors.border}
    >
      {visibleTools.map((tool) => (
        <ToolItem key={tool.id} tool={tool} />
      ))}
    </Box>
  );
}

function ToolItem({
  tool,
}: {
  tool: ToolDisplayState;
}): React.ReactElement {
  const statusIcon = getStatusIcon(tool.status);
  const statusColor = getStatusColor(tool.status);

  return (
    <Box flexDirection="column" paddingLeft={1}>
      <Box>
        <Text color={statusColor}>{statusIcon} </Text>
        <Text bold color={theme.colors.tool}>
          {tool.name}
        </Text>
        {tool.status === "running" && (
          <Text dimColor> — executing...</Text>
        )}
        {tool.status === "denied" && (
          <Text color={theme.colors.toolError}> — denied</Text>
        )}
      </Box>

      {/* Tool input preview */}
      {tool.input != null && (
        <Box paddingLeft={2}>
          <Text dimColor>
            input: {truncateJson(tool.input, 100)}
          </Text>
        </Box>
      )}

      {/* Tool result (abbreviated) */}
      {tool.result && (
        <Box paddingLeft={2}>
          <Text
            color={tool.isError ? theme.colors.toolError : theme.colors.dim}
          >
            result: {truncateString(tool.result, 200)}
          </Text>
        </Box>
      )}
    </Box>
  );
}

function getStatusIcon(status: ToolDisplayState["status"]): string {
  switch (status) {
    case "running":
      return "⏳";
    case "success":
      return "✓";
    case "error":
      return "✗";
    case "denied":
      return "⊘";
  }
}

function getStatusColor(status: ToolDisplayState["status"]): string {
  switch (status) {
    case "running":
      return theme.colors.toolRunning;
    case "success":
      return theme.colors.toolSuccess;
    case "error":
      return theme.colors.toolError;
    case "denied":
      return theme.colors.toolError;
  }
}

function truncateJson(obj: unknown, maxLen: number): string {
  const str = JSON.stringify(obj);
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + "...";
}

function truncateString(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + "...";
}
