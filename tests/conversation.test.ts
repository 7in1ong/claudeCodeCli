/**
 * ConversationManager Unit Tests
 *
 * Covers: basic message add/read, consecutive tool_result merging,
 * truncation without orphaned tool_result, reset state zeroing.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { ConversationManager } from "../src/llm/conversation.js";
import type {
  ContentBlockParam,
  ToolUseBlockParam,
  ToolResultBlockParam,
} from "@anthropic-ai/sdk/resources/messages/messages.js";

describe("ConversationManager", () => {
  let manager: ConversationManager;

  beforeEach(() => {
    manager = new ConversationManager({ systemPrompt: "You are a helpful assistant." });
  });

  // ---------------------------------------------------------------------------
  // Basic message add/read
  // ---------------------------------------------------------------------------
  describe("basic message operations", () => {
    it("should start with empty message history", () => {
      expect(manager.getMessages()).toHaveLength(0);
      expect(manager.getMessageCount()).toBe(0);
      expect(manager.getTurnCount()).toBe(0);
      expect(manager.getTokenCount()).toBe(0);
    });

    it("should preserve system prompt from constructor", () => {
      expect(manager.getSystemPrompt()).toBe("You are a helpful assistant.");
    });

    it("should add user messages and increment turn count", () => {
      manager.addUserMessage("Hello");
      expect(manager.getMessages()).toHaveLength(1);
      expect(manager.getTurnCount()).toBe(1);

      manager.addUserMessage("How are you?");
      expect(manager.getMessages()).toHaveLength(2);
      expect(manager.getTurnCount()).toBe(2);
    });

    it("should add assistant messages without incrementing turn count", () => {
      manager.addUserMessage("Hello");
      manager.addAssistantMessage("Hi there!");
      expect(manager.getMessages()).toHaveLength(2);
      expect(manager.getTurnCount()).toBe(1); // only user message counts
    });

    it("should track estimated token count", () => {
      manager.addUserMessage("Hello world");
      const tokensAfterFirst = manager.getTokenCount();
      expect(tokensAfterFirst).toBeGreaterThan(0);

      manager.addAssistantMessage("Hi, how can I help you today?");
      expect(manager.getTokenCount()).toBeGreaterThan(tokensAfterFirst);
    });

    it("should return messages in correct Anthropic API format", () => {
      manager.addUserMessage("Hello");
      manager.addAssistantMessage("Hi!");

      const messages = manager.getMessages();
      expect(messages).toEqual([
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi!" },
      ]);
    });

    it("should support assistant messages with content block arrays", () => {
      const blocks: ContentBlockParam[] = [
        { type: "text", text: "Let me use a tool." },
        { type: "tool_use", id: "tool_1", name: "search", input: { query: "test" } },
      ];
      manager.addAssistantMessage(blocks);

      const messages = manager.getMessages();
      expect(messages).toHaveLength(1);
      expect(messages[0].role).toBe("assistant");
      expect(Array.isArray(messages[0].content)).toBe(true);
    });

    it("should allow setting system prompt after construction", () => {
      manager.setSystemPrompt("New system prompt");
      expect(manager.getSystemPrompt()).toBe("New system prompt");
    });

    it("should report state snapshot via getState()", () => {
      manager.addUserMessage("Hello");
      manager.addAssistantMessage("Hi!");

      const state = manager.getState();
      expect(state.messageCount).toBe(2);
      expect(state.turnCount).toBe(1);
      expect(state.estimatedTokens).toBeGreaterThan(0);
      expect(state.systemPrompt).toBe("You are a helpful assistant.");
    });
  });

  // ---------------------------------------------------------------------------
  // Consecutive tool_result merging
  // ---------------------------------------------------------------------------
  describe("tool_result merging", () => {
    it("should create a user message for the first tool result", () => {
      manager.addToolResult("tool_1", "result 1");

      const messages = manager.getMessages();
      expect(messages).toHaveLength(1);
      expect(messages[0].role).toBe("user");
      expect(Array.isArray(messages[0].content)).toBe(true);
      const content = messages[0].content as ToolResultBlockParam[];
      expect(content).toHaveLength(1);
      expect(content[0].type).toBe("tool_result");
      expect(content[0].tool_use_id).toBe("tool_1");
    });

    it("should merge consecutive tool_result into a single user message", () => {
      manager.addToolResult("tool_1", "result 1");
      manager.addToolResult("tool_2", "result 2");
      manager.addToolResult("tool_3", "result 3");

      const messages = manager.getMessages();
      expect(messages).toHaveLength(1); // all merged into one
      const content = messages[0].content as ToolResultBlockParam[];
      expect(content).toHaveLength(3);
      expect(content[0].tool_use_id).toBe("tool_1");
      expect(content[1].tool_use_id).toBe("tool_2");
      expect(content[2].tool_use_id).toBe("tool_3");
    });

    it("should NOT merge tool_result if preceded by a regular user message", () => {
      manager.addUserMessage("regular text");
      manager.addToolResult("tool_1", "result 1");

      const messages = manager.getMessages();
      expect(messages).toHaveLength(2);
      expect(messages[0].content).toBe("regular text");
      const content = messages[1].content as ToolResultBlockParam[];
      expect(content).toHaveLength(1);
    });

    it("should support is_error flag on tool_result", () => {
      manager.addToolResult("tool_1", "error occurred", true);

      const messages = manager.getMessages();
      const content = messages[0].content as ToolResultBlockParam[];
      expect(content[0].is_error).toBe(true);
    });

    it("should handle tool_use in assistant then tool_result in user", () => {
      const toolUse: ToolUseBlockParam = {
        type: "tool_use",
        id: "tool_1",
        name: "search",
        input: { query: "test" },
      };
      manager.addAssistantMessage([toolUse]);
      manager.addToolResult("tool_1", "found 3 results");

      const messages = manager.getMessages();
      expect(messages).toHaveLength(2);
      expect(messages[0].role).toBe("assistant");
      expect(messages[1].role).toBe("user");

      const assistantContent = messages[0].content as ContentBlockParam[];
      expect(assistantContent[0].type).toBe("tool_use");

      const userContent = messages[1].content as ToolResultBlockParam[];
      expect(userContent[0].type).toBe("tool_result");
    });
  });

  // ---------------------------------------------------------------------------
  // Truncation — no orphaned tool_result after truncation
  // ---------------------------------------------------------------------------
  describe("truncation", () => {
    it("should not truncate when within token limit", () => {
      const largeManager = new ConversationManager({ maxContextTokens: 100_000 });
      largeManager.addUserMessage("Hello");
      largeManager.addAssistantMessage("Hi!");

      const removed = largeManager.truncate();
      expect(removed).toBe(0);
      expect(largeManager.getMessages()).toHaveLength(2);
    });

    it("should truncate oldest messages when token limit is exceeded", () => {
      const smallManager = new ConversationManager({ maxContextTokens: 10 });

      // Add enough messages to exceed the small limit
      smallManager.addUserMessage("first user message that is long enough");
      smallManager.addAssistantMessage("first assistant reply that is long enough");
      smallManager.addUserMessage("second user message");
      smallManager.addAssistantMessage("second assistant reply");

      const removed = smallManager.truncate();
      expect(removed).toBeGreaterThan(0);
    });

    it("should never leave orphaned tool_result at the start after truncation", () => {
      // Create a scenario where truncation might leave an orphaned tool_result:
      // 1. user message
      // 2. assistant with tool_use
      // 3. user with tool_result
      // 4. assistant reply
      // If messages 1 and 2 get dropped, message 3 becomes an orphaned tool_result.
      const smallManager = new ConversationManager({ maxContextTokens: 20 });

      // Turn 1: user + assistant(tool_use)
      smallManager.addUserMessage("This is a long first message that should be dropped");
      const toolUse: ToolUseBlockParam = {
        type: "tool_use",
        id: "tool_1",
        name: "do_something",
        input: { arg: "value" },
      };
      smallManager.addAssistantMessage([toolUse]);
      // Tool result follows
      smallManager.addToolResult("tool_1", "result from first tool");
      // Assistant continues
      smallManager.addAssistantMessage("Based on the result I will continue now");

      // Turn 2: more conversation to fill tokens
      smallManager.addUserMessage("second user message here for tokens");
      smallManager.addAssistantMessage("second assistant reply here too");

      smallManager.truncate();

      // After truncation, the first message must NOT be an orphaned tool_result
      const messages = smallManager.getMessages();
      if (messages.length > 0) {
        const first = messages[0];
        if (first.role === "user" && Array.isArray(first.content)) {
          // If first message is user with array content, it must not be
          // exclusively tool_result blocks (that would be orphaned)
          const allToolResults = first.content.every(
            (b: ContentBlockParam) => b.type === "tool_result"
          );
          expect(allToolResults).toBe(false);
        }
      }
    });

    it("should handle multiple orphaned tool_result messages at the start", () => {
      // Edge case: multiple consecutive tool_result-only user messages
      // could appear if tool_use/tool_result pairs are stacked.
      const smallManager = new ConversationManager({ maxContextTokens: 30 });

      // Build a scenario with tool_use/tool_result pairs
      smallManager.addUserMessage("long first user message to exceed token limit quickly");
      smallManager.addAssistantMessage("long first assistant response that gets dropped");
      const toolUse1: ToolUseBlockParam = {
        type: "tool_use",
        id: "t1",
        name: "tool_a",
        input: {},
      };
      smallManager.addAssistantMessage([toolUse1]);
      smallManager.addToolResult("t1", "result_a");

      smallManager.addUserMessage("second regular user message to keep");
      smallManager.addAssistantMessage("second assistant reply to keep");

      smallManager.truncate();

      const messages = smallManager.getMessages();
      // The first message, if it exists, should not be an orphaned tool_result
      if (messages.length > 0) {
        const first = messages[0];
        if (first.role === "user" && Array.isArray(first.content)) {
          const allToolResults = first.content.every(
            (b: ContentBlockParam) => b.type === "tool_result"
          );
          expect(allToolResults).toBe(false);
        }
      }
    });

    it("should preserve the most recent exchange", () => {
      const smallManager = new ConversationManager({ maxContextTokens: 20 });

      smallManager.addUserMessage("old message that should be dropped when truncated");
      smallManager.addAssistantMessage("old reply that should also be dropped");
      smallManager.addUserMessage("recent message to keep");
      smallManager.addAssistantMessage("recent reply to keep");

      smallManager.truncate();

      const messages = smallManager.getMessages();
      // At minimum the last two messages should survive
      expect(messages.length).toBeGreaterThanOrEqual(2);
      const lastTwo = messages.slice(-2);
      expect(lastTwo[0].content).toContain("recent message");
      expect(lastTwo[1].content).toContain("recent reply");
    });

    it("should report needsTruncation correctly", () => {
      const smallManager = new ConversationManager({ maxContextTokens: 5 });
      expect(smallManager.needsTruncation()).toBe(false);

      smallManager.addUserMessage("This is a long message that exceeds the token limit");
      expect(smallManager.needsTruncation()).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Reset (/clear command)
  // ---------------------------------------------------------------------------
  describe("reset", () => {
    it("should clear all message history", () => {
      manager.addUserMessage("Hello");
      manager.addAssistantMessage("Hi!");
      manager.addToolResult("tool_1", "result");

      manager.reset();

      expect(manager.getMessages()).toHaveLength(0);
      expect(manager.getMessageCount()).toBe(0);
    });

    it("should reset token count to zero", () => {
      manager.addUserMessage("Hello");
      manager.addAssistantMessage("Hi there!");
      expect(manager.getTokenCount()).toBeGreaterThan(0);

      manager.reset();
      expect(manager.getTokenCount()).toBe(0);
    });

    it("should reset turn count to zero", () => {
      manager.addUserMessage("Turn 1");
      manager.addUserMessage("Turn 2");
      expect(manager.getTurnCount()).toBe(2);

      manager.reset();
      expect(manager.getTurnCount()).toBe(0);
    });

    it("should preserve system prompt after reset", () => {
      manager.reset();
      expect(manager.getSystemPrompt()).toBe("You are a helpful assistant.");
    });

    it("should allow new messages after reset", () => {
      manager.addUserMessage("Before reset");
      manager.reset();
      manager.addUserMessage("After reset");

      const messages = manager.getMessages();
      expect(messages).toHaveLength(1);
      expect(messages[0].content).toBe("After reset");
      expect(manager.getTurnCount()).toBe(1);
    });

    it("should return zeroed state via getState() after reset", () => {
      manager.addUserMessage("Hello");
      manager.addAssistantMessage("Hi!");
      manager.reset();

      const state = manager.getState();
      expect(state.messageCount).toBe(0);
      expect(state.turnCount).toBe(0);
      expect(state.estimatedTokens).toBe(0);
      // System prompt preserved
      expect(state.systemPrompt).toBe("You are a helpful assistant.");
    });
  });

  // ---------------------------------------------------------------------------
  // Constructor options
  // ---------------------------------------------------------------------------
  describe("constructor options", () => {
    it("should default to empty system prompt when not provided", () => {
      const m = new ConversationManager();
      expect(m.getSystemPrompt()).toBe("");
    });

    it("should accept custom maxContextTokens", () => {
      const m = new ConversationManager({ maxContextTokens: 500 });
      const state = m.getState();
      expect(state.maxContextTokens).toBe(500);
    });

    it("should default maxContextTokens to 100000", () => {
      const m = new ConversationManager();
      const state = m.getState();
      expect(state.maxContextTokens).toBe(100_000);
    });
  });
});
