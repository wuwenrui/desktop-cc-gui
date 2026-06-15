import { describe, expect, it } from "vitest";
import type { ConversationItem } from "../../../types";
import {
  __getPrepareThreadItemsCallCountForTests,
  __resetPrepareThreadItemsCallCountForTests,
} from "../../../utils/threadItems";
import { __profile, initialState, threadReducer } from "./useThreadsReducer";
import type { ThreadState } from "./useThreadsReducer";


function processingEngineState(
  threadId: string,
  items: ConversationItem[],
): ThreadState {
  return {
    ...initialState,
    threadStatusById: {
      [threadId]: {
        isProcessing: true,
        hasUnread: false,
        isReviewing: false,
        isContextCompacting: false,
        processingStartedAt: Date.now() - 100,
        lastDurationMs: null,
        heartbeatPulse: 1,
      },
    },
    itemsByThread: {
      [threadId]: items,
    },
  };
}

function makeAppendDelta(
  threadId: string,
  itemId: string,
  delta: string,
) {
  return {
    type: "appendAgentDelta" as const,
    workspaceId: "ws-1",
    threadId,
    itemId,
    delta,
    hasCustomName: false,
  };
}

function makeComplete(
  threadId: string,
  itemId: string,
  text: string,
) {
  return {
    type: "completeAgentMessage" as const,
    workspaceId: "ws-1",
    threadId,
    itemId,
    text,
    hasCustomName: false,
  };
}

const ENGINES: Array<{ prefix: string; threadId: string; itemId: string }> = [
  { prefix: "codex", threadId: "codex:thread-fast", itemId: "assistant-live" },
  { prefix: "gemini", threadId: "gemini:thread-fast", itemId: "assistant-live" },
  { prefix: "opencode", threadId: "opencode:thread-fast", itemId: "assistant-live" },
];

describe("threadReducer non-Claude live delta fast path", () => {
  for (const engine of ENGINES) {
    it(`${engine.prefix}: streaming live deltas skip prepareThreadItems and merge text in place`, () => {
      const userItem: ConversationItem = {
        id: "user-1",
        kind: "message",
        role: "user",
        text: "继续",
      };
      const assistantItem: ConversationItem = {
        id: engine.itemId,
        kind: "message",
        role: "assistant",
        text: "Hello",
        isFinal: false,
      };
      const base = processingEngineState(engine.threadId, [
        userItem,
        assistantItem,
      ]);

      __resetPrepareThreadItemsCallCountForTests();
      const first = threadReducer(
        base,
        makeAppendDelta(engine.threadId, engine.itemId, " world"),
      );
      const second = threadReducer(
        first,
        makeAppendDelta(engine.threadId, engine.itemId, "!"),
      );

      expect(__getPrepareThreadItemsCallCountForTests()).toBe(0);
      const items = second.itemsByThread[engine.threadId] ?? [];
      expect(items[0]).toBe(userItem);
      expect(items[1]?.kind).toBe("message");
      if (items[1]?.kind === "message") {
        expect(items[1].text).toBe("Hello world!");
        expect(items[1].isFinal).toBe(false);
      }
    });

    it(`${engine.prefix}: completeAgentMessage falls back to slow path and preserves final metadata`, () => {
      const assistantItem: ConversationItem = {
        id: engine.itemId,
        kind: "message",
        role: "assistant",
        text: "Hello",
        isFinal: false,
      };
      const base = processingEngineState(engine.threadId, [assistantItem]);

      const streaming = threadReducer(
        base,
        makeAppendDelta(engine.threadId, engine.itemId, " world"),
      );

      __resetPrepareThreadItemsCallCountForTests();
      const completed = threadReducer(
        streaming,
        makeComplete(engine.threadId, engine.itemId, "Hello world"),
      );

      expect(__getPrepareThreadItemsCallCountForTests()).toBe(1);
      const message = completed.itemsByThread[engine.threadId]?.[0];
      expect(message?.kind).toBe("message");
      if (message?.kind === "message") {
        expect(message.text).toBe("Hello world");
        expect(message.isFinal).toBe(true);
        expect(message.finalCompletedAt).toEqual(expect.any(Number));
      }
    });
  }

  it("preserves reasoning and assistant item order across interleaving codex deltas", () => {
    const threadId = "codex:thread-reasoning";
    const userItem: ConversationItem = {
      id: "user-1",
      kind: "message",
      role: "user",
      text: "go",
    };
    const reasoningItem: ConversationItem = {
      id: "reasoning-live",
      kind: "reasoning",
      summary: "thinking",
      content: "t1",
    };
    const assistantItem: ConversationItem = {
      id: "assistant-live",
      kind: "message",
      role: "assistant",
      text: "Result",
      isFinal: false,
    };
    const base = processingEngineState(threadId, [
      userItem,
      reasoningItem,
      assistantItem,
    ]);

    __resetPrepareThreadItemsCallCountForTests();
    const next = threadReducer(
      base,
      makeAppendDelta(threadId, "assistant-live", " +1"),
    );

    expect(__getPrepareThreadItemsCallCountForTests()).toBe(0);
    const items = next.itemsByThread[threadId] ?? [];
    expect(items[0]?.id).toBe("user-1");
    expect(items[1]?.id).toBe("reasoning-live");
    expect(items[2]?.kind).toBe("message");
    if (items[2]?.kind === "message") {
      expect(items[2].text).toBe("Result +1");
    }
  });

  it("skips prepareThreadItems in a 1000-delta codex streaming burst", () => {
    const threadId = "codex:thread-burst";
    const assistantItem: ConversationItem = {
      id: "assistant-live",
      kind: "message",
      role: "assistant",
      text: "",
      isFinal: false,
    };
    let state = processingEngineState(threadId, [assistantItem]);

    __profile.reset();
    for (let index = 0; index < 1000; index += 1) {
      const tag = `t${index.toString(36).padStart(2, "0")}`;
      state = threadReducer(
        state,
        makeAppendDelta(threadId, "assistant-live", tag),
      );
    }

    expect(__profile.snapshot()).toEqual({
      componentRenderCounts: {},
      prepareThreadItemsCallCount: 0,
      reducerDispatchCount: 1000,
    });
    const message = state.itemsByThread[threadId]?.[0];
    expect(message?.kind).toBe("message");
    if (message?.kind === "message") {
      // 1000 distinct tags each 3 chars; we only assert non-empty + processing.
      expect(message.text.length).toBeGreaterThan(0);
    }
  });

  it("records component render counts for profiler evidence", () => {
    __profile.reset();

    __profile.recordComponentRender("composer");
    __profile.recordComponentRender("composer");
    __profile.recordComponentRender(" sidebar ");
    __profile.recordComponentRender(" ");

    expect(__profile.snapshot().componentRenderCounts).toEqual({
      composer: 2,
      sidebar: 1,
    });
  });
});
