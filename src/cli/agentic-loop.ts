/**
 * Agentic Loop
 *
 * Orchestrates the core conversation cycle:
 *   User message → ConversationManager → streamMessage → display text
 *     → if tool_use: ToolExecutor → tool_results → ConversationManager
 *     → stream again → repeat until no more tool_use
 *
 * Extracted from runner.ts so it can be shared between one-shot mode
 * and the interactive REPL.
 */

import type { ToolResultBlockParam } from "@anthropic-ai/sdk/resources/messages/messages.js";
import {
  streamMessage,
  ConversationManager,
  DEFAULT_MAX_TOKENS,
} from "../llm/index.js";
import type { ContentBlock, StreamCallbacks } from "../llm/index.js";
import { ToolRegistry, ToolExecutor } from "../tools/index.js";
import type { Renderer } from "../ui/renderer.js";
import { classifyApiError } from "../utils/errors.js";

/**
 * Process a single user message through the full agentic loop.
 *
 * Streams the assistant's response, executes any tool_use blocks the
 * model requests, feeds results back, and loops until the model stops
 * calling tools.
 *
 * The renderer is used for all output — no direct console.log calls.
 */
export async function processUserMessage(
  input: string,
  conversation: ConversationManager,
  registry: ToolRegistry,
  executor: ToolExecutor,
  renderer: Renderer,
): Promise<void> {
  conversation.addUserMessage(input);

  // Truncate old messages when context window is exceeded
  if (conversation.needsTruncation()) {
    const removed = conversation.truncate();
    renderer.renderSystemMessage(
      `\n  (context truncated: dropped ${removed} old messages to stay within limits)`,
    );
  }

  // Loop until the model stops calling tools (agentic loop)
  let hasToolUse = true;
  while (hasToolUse) {
    const callbacks: StreamCallbacks = {
      onTextDelta: (text) => {
        renderer.renderAssistantText(text);
      },
      onToolUseStart: ({ name }) => {
        renderer.renderToolStart(name);
      },
      onToolUseComplete: ({ name, input }) => {
        renderer.renderToolInput(name, input);
      },
      onError: (error) => {
        renderer.renderError(classifyApiError(error));
      },
    };

    const result = await streamMessage(
      {
        messages: [...conversation.getMessages()],
        systemPrompt: conversation.getSystemPrompt(),
        tools: registry.toAnthropicTools(),
        maxTokens: DEFAULT_MAX_TOKENS,
      },
      callbacks,
    );

    // End of text block — signal streaming complete
    renderer.endStream?.();

    // Record assistant response in conversation history
    conversation.addAssistantMessage(result.message.content);

    if (result.hasToolUse && executor) {
      // Execute tools and feed results back to the model
      const toolResults = await executor.executeTools(result.message.content);

      for (const tr of toolResults) {
        const content =
          typeof tr.content === "string"
            ? tr.content
            : JSON.stringify(tr.content);
        const isError = tr.is_error ?? false;

        // Extract tool name from the content blocks if available,
        // otherwise use a generic label
        const toolName = extractToolName(result.message.content, tr.tool_use_id);
        renderer.renderToolResult(toolName, content, isError);

        // Record tool result in conversation (as a user-role message with
        // tool_result blocks, per Anthropic API requirements)
        const trParam = tr as ToolResultBlockParam;
        conversation.addToolResult(
          trParam.tool_use_id,
          typeof trParam.content === "string"
            ? trParam.content
            : JSON.stringify(trParam.content),
          isError,
        );
      }

      renderer.renderNewline(); // blank line before next streamed response
    }

    hasToolUse = result.hasToolUse;
  }
}

/**
 * Extract the tool name from assistant content blocks by matching tool_use_id.
 */
function extractToolName(
  content: readonly ContentBlock[],
  toolUseId: string,
): string {
  for (const block of content) {
    if (block.type === "tool_use" && block.id === toolUseId) {
      return block.name ?? "unknown";
    }
  }
  return "unknown";
}
