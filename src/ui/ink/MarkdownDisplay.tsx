/**
 * MarkdownDisplay Component
 *
 * Renders Markdown content using Ink components.
 * Supports headings, code blocks (with syntax highlighting), lists,
 * blockquotes, bold/italic, and inline code.
 *
 * Uses `marked` to tokenize Markdown and `cli-highlight` for code
 * syntax highlighting. During streaming, renders raw text for performance;
 * once complete, parses and renders proper Markdown.
 */

import React from "react";
import { Box, Text } from "ink";
import { marked, type Token } from "marked";
import { highlight } from "cli-highlight";
import chalk from "chalk";
import { theme } from "./theme.js";

interface MarkdownDisplayProps {
  content: string;
  streaming?: boolean;
}

export function MarkdownDisplay({
  content,
  streaming = false,
}: MarkdownDisplayProps): React.ReactElement {
  if (streaming) {
    return <Text color={theme.colors.assistant}>{content}</Text>;
  }

  let tokens: Token[];
  try {
    tokens = marked.lexer(content);
  } catch {
    return <Text color={theme.colors.assistant}>{content}</Text>;
  }

  return (
    <Box flexDirection="column">
      {tokens.map((token, i) => (
        <React.Fragment key={i}>{renderToken(token)}</React.Fragment>
      ))}
    </Box>
  );
}

function renderToken(token: Token): React.ReactElement {
  switch (token.type) {
    case "heading":
      return renderHeading(
        token as Token & { depth: number; text: string },
      );

    case "paragraph":
      return (
        <Box marginBottom={1}>
          <Text color={theme.colors.assistant}>
            {renderInline((token as Token & { text: string }).text)}
          </Text>
        </Box>
      );

    case "code":
      return renderCode(token as Token & { lang?: string; text: string });

    case "list":
      return renderList(
        token as Token & {
          ordered: boolean;
          items: Array<{ text: string }>;
        },
      );

    case "blockquote":
      return (
        <Box
          paddingLeft={2}
          borderStyle="single"
          borderColor={theme.colors.dim}
          marginBottom={1}
        >
          <Text color={theme.colors.dim} italic>
            {(token as Token & { text: string }).text}
          </Text>
        </Box>
      );

    case "hr":
      return (
        <Box marginBottom={1}>
          <Text dimColor>{"─".repeat(60)}</Text>
        </Box>
      );

    case "space":
      return <Box height={1} />;

    default:
      if ("text" in token && typeof token.text === "string") {
        return (
          <Box marginBottom={1}>
            <Text color={theme.colors.assistant}>{token.text}</Text>
          </Box>
        );
      }
      if ("raw" in token && typeof token.raw === "string") {
        return (
          <Box marginBottom={1}>
            <Text color={theme.colors.assistant}>{token.raw}</Text>
          </Box>
        );
      }
      return <></>;
  }
}

function renderHeading(token: {
  depth: number;
  text: string;
}): React.ReactElement {
  const { depth, text } = token;
  const prefix = "#".repeat(depth) + " ";

  if (depth === 1) {
    return (
      <Box marginBottom={1} marginTop={1}>
        <Text bold color={theme.colors.assistant}>
          {prefix}
          {text.toUpperCase()}
        </Text>
      </Box>
    );
  }
  return (
    <Box marginBottom={1}>
      <Text bold color={theme.colors.assistant}>
        {prefix}
        {text}
      </Text>
    </Box>
  );
}

function renderCode(token: {
  lang?: string;
  text: string;
}): React.ReactElement {
  const { lang, text } = token;
  const lines = text.split("\n");
  const maxLineNumWidth = String(lines.length).length;

  // Attempt syntax highlighting — strip ANSI for Ink compatibility
  let displayLines: string[];
  try {
    const highlighted = highlight(text, {
      language: lang || "plaintext",
      ignoreIllegals: true,
    });
    displayLines = highlighted.split("\n").map(stripAnsi);
  } catch {
    displayLines = lines;
  }

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box>
        <Text dimColor>
          {"┌─ "}
          {lang || "code"}
        </Text>
      </Box>
      {displayLines.map((line, i) => (
        <Box key={i}>
          <Text dimColor>
            {"│ "}
            {String(i + 1).padStart(maxLineNumWidth)}{" "}
          </Text>
          <Text>{line}</Text>
        </Box>
      ))}
      <Box>
        <Text dimColor>{"└" + "─".repeat(Math.min(text.length, 50) + 2)}</Text>
      </Box>
    </Box>
  );
}

function renderList(token: {
  ordered: boolean;
  items: Array<{ text: string }>;
}): React.ReactElement {
  return (
    <Box flexDirection="column" marginBottom={1} paddingLeft={2}>
      {token.items.map((item, i) => {
        const bullet = token.ordered ? `${i + 1}.` : "•";
        return (
          <Box key={i}>
            <Text color={theme.colors.assistant}>
              {bullet} {renderInline(item.text)}
            </Text>
          </Box>
        );
      })}
    </Box>
  );
}

/**
 * Process inline Markdown formatting (bold, italic, code, links).
 * Returns a string with chalk formatting applied.
 */
function renderInline(text: string): string {
  let result = text;

  // Inline code: `code`
  result = result.replace(/`([^`]+)`/g, (_m, code: string) => {
    return chalk.bgHex("#2a2a3a").white(` ${code} `);
  });

  // Bold: **text** or __text__
  result = result.replace(/\*\*([^*]+)\*\*/g, (_m, bold: string) =>
    chalk.bold(bold),
  );
  result = result.replace(/__([^_]+)__/g, (_m, bold: string) =>
    chalk.bold(bold),
  );

  // Italic: *text* or _text_
  result = result.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, (_m, it: string) =>
    chalk.italic(it),
  );
  result = result.replace(/(?<!_)_([^_]+)_(?!_)/g, (_m, it: string) =>
    chalk.italic(it),
  );

  // Links: [text](url)
  result = result.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    (_m, linkText: string, url: string) =>
      chalk.underline.blue(`${linkText} (${url})`),
  );

  return result;
}

/** Strip ANSI escape codes from a string. */
function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*m/g, "");
}
