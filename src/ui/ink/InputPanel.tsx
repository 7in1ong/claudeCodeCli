/**
 * InputPanel Component
 *
 * Text input with history navigation (up/down arrows) and multi-line support.
 * Captures raw keypresses for full control over editing behavior.
 */

import React, { useState, useCallback, useRef } from "react";
import { Box, Text, useInput } from "ink";
import { theme } from "./theme.js";

interface InputPanelProps {
  onSubmit: (text: string) => void;
  disabled?: boolean;
}

export function InputPanel({
  onSubmit,
  disabled = false,
}: InputPanelProps): React.ReactElement {
  const [value, setValue] = useState("");
  const [cursorPos, setCursorPos] = useState(0);
  const [multiLineMode, setMultiLineMode] = useState(false);
  const [multiLineBuffer, setMultiLineBuffer] = useState<string[]>([]);

  const history = useRef<string[]>([]);
  const historyIndex = useRef(-1);

  const handleSubmit = useCallback(() => {
    if (multiLineMode) {
      if (value.trim() === ".") {
        const fullText = multiLineBuffer.join("\n");
        setMultiLineMode(false);
        setMultiLineBuffer([]);
        setValue("");
        setCursorPos(0);
        if (fullText.trim()) {
          history.current.unshift(fullText);
          historyIndex.current = -1;
          onSubmit(fullText);
        }
        return;
      }
      setMultiLineBuffer((prev) => [...prev, value]);
      setValue("");
      setCursorPos(0);
      return;
    }

    if (value.trimEnd().endsWith("\\")) {
      const firstLine = value.trimEnd().slice(0, -1);
      setMultiLineMode(true);
      setMultiLineBuffer([firstLine]);
      setValue("");
      setCursorPos(0);
      return;
    }

    if (value.trim()) {
      history.current.unshift(value);
      historyIndex.current = -1;
      onSubmit(value);
    }
    setValue("");
    setCursorPos(0);
  }, [value, multiLineMode, multiLineBuffer, onSubmit]);

  useInput((input, key) => {
    if (disabled) return;

    if (key.ctrl && input === "c") return; // let App handle Ctrl+C

    // Ctrl+U — clear line
    if (key.ctrl && input === "u") {
      setValue("");
      setCursorPos(0);
      return;
    }

    // Enter — submit
    if (key.return) {
      handleSubmit();
      return;
    }

    // Backspace
    if (key.backspace || key.delete) {
      if (cursorPos > 0) {
        const newVal =
          value.slice(0, cursorPos - 1) + value.slice(cursorPos);
        setValue(newVal);
        setCursorPos(cursorPos - 1);
      }
      return;
    }

    // Up arrow — history previous
    if (key.upArrow) {
      if (history.current.length > 0) {
        const newIndex = Math.min(
          historyIndex.current + 1,
          history.current.length - 1,
        );
        historyIndex.current = newIndex;
        const histValue = history.current[newIndex];
        setValue(histValue);
        setCursorPos(histValue.length);
      }
      return;
    }

    // Down arrow — history next
    if (key.downArrow) {
      if (historyIndex.current > 0) {
        const newIndex = historyIndex.current - 1;
        historyIndex.current = newIndex;
        const histValue = history.current[newIndex];
        setValue(histValue);
        setCursorPos(histValue.length);
      } else if (historyIndex.current === 0) {
        historyIndex.current = -1;
        setValue("");
        setCursorPos(0);
      }
      return;
    }

    // Left/Right arrows
    if (key.leftArrow) {
      setCursorPos(Math.max(0, cursorPos - 1));
      return;
    }
    if (key.rightArrow) {
      setCursorPos(Math.min(value.length, cursorPos + 1));
      return;
    }

    if (key.tab) return;

    // Regular character input
    if (input && !key.ctrl && !key.meta) {
      const newVal =
        value.slice(0, cursorPos) + input + value.slice(cursorPos);
      setValue(newVal);
      setCursorPos(cursorPos + input.length);
    }
  });

  const promptText = multiLineMode ? "... " : "> ";

  return (
    <Box
      borderStyle="single"
      borderColor={disabled ? theme.colors.dim : theme.colors.inputPrompt}
      paddingX={0}
    >
      <Text color={theme.colors.inputPrompt} bold>
        {promptText}
      </Text>
      {multiLineMode && (
        <Text dimColor>
          {" "}
          ({multiLineBuffer.length} lines, "." to finish)
        </Text>
      )}
      {disabled ? (
        <Text dimColor>processing...</Text>
      ) : (
        <Text>
          {value.slice(0, cursorPos)}
          <Text backgroundColor={theme.colors.assistant} color="#000000">
            {cursorPos < value.length ? value[cursorPos] : " "}
          </Text>
          {value.slice(cursorPos + 1)}
        </Text>
      )}
    </Box>
  );
}
