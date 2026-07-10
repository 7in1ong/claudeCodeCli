/**
 * ConversationPanel Component
 *
 * Displays the conversation history in a scrollable panel.
 * Uses flexDirection="column-reverse" for auto-scroll-to-bottom behavior.
 * Each message is rendered with role-based styling.
 */

import React from "react";
import { Box, Text } from "ink";
import type { ConversationEntry } from "./TuiBridge.js";
import { MarkdownDisplay } from "./MarkdownDisplay.js";
import { theme } from "./theme.js";

interface ConversationPanelProps {
  messages: ConversationEntry[];
  streamingText: string;
  isStreaming: boolean;
  height: number;
}

export function ConversationPanel({
  messages,
  streamingText,
  isStreaming,
  height,
}: ConversationPanelProps): React.ReactElement {
  return (
    <Box
      flexDirection="column-reverse"
      height={height}
      overflow="hidden"
      flexGrow={1}
    >
      <Box flexDirection="column-reverse">
        {/* Streaming text (shown after last assistant message) */}
        {isStreaming && streamingText && (
          <Box paddingLeft={1} flexDirection="column">
            <MarkdownDisplay content={streamingText} streaming={true} />
          </Box>
        )}

        {/* Messages in reverse order (newest first, for column-reverse) */}
        {[...messages].reverse().map((msg) => (
          <MessageItem key={msg.id} entry={msg} />
        ))}
      </Box>
    </Box>
  );
}

function MessageItem({
  entry,
}: {
  entry: ConversationEntry;
}): React.ReactElement {
  switch (entry.role) {
    case "user":
      return (
        <Box paddingLeft={1} marginBottom={1} flexDirection="column">
          <Text bold color={theme.colors.user}>
            You:
          </Text>
          <Text color={theme.colors.user}>{entry.content}</Text>
        </Box>
      );

    case "assistant":
      return (
        <Box paddingLeft={1} marginBottom={1} flexDirection="column">
          <Text bold color={theme.colors.assistant}>
            Claude:
          </Text>
          <MarkdownDisplay content={entry.content} />
        </Box>
      );

    case "system":
      return (
        <Box paddingLeft={1} marginBottom={1}>
          <Text color={theme.colors.system} dimColor>
            ⚡ {entry.content}
          </Text>
        </Box>
      );

    default:
      return (
        <Box paddingLeft={1} marginBottom={1}>
          <Text>{entry.content}</Text>
        </Box>
      );
  }
}
