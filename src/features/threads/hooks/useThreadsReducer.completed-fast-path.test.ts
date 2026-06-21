import { describe, expect, it } from "vitest";
import type { ConversationItem } from "../../../types";
import {
  __getPrepareThreadItemsCallCountForTests,
  __resetPrepareThreadItemsCallCountForTests,
} from "../../../utils/threadItems";
import { initialState, threadReducer } from "./useThreadsReducer";

const ITEM_ID = "assistant-completed-fast-path";

function buildAssistantItem(text: string, isFinal: boolean): ConversationItem {
  return {
    id: ITEM_ID,
    kind: "message",
    role: "assistant",
    text,
    isFinal,
  };
}

function processingState(
  threadId: string,
  items: ConversationItem[],
) {
  return {
    ...initialState,
    threadStatusById: {
      [threadId]: {
        isProcessing: false,
        hasUnread: false,
        isReviewing: false,
        isContextCompacting: false,
        processingStartedAt: null,
        lastDurationMs: null,
        heartbeatPulse: 0,
      },
    },
    itemsByThread: { [threadId]: items },
  };
}

function processingStateWithDuration(
  threadId: string,
  items: ConversationItem[],
  durationMs: number | null,
) {
  return {
    ...initialState,
    threadStatusById: {
      [threadId]: {
        isProcessing: false,
        hasUnread: false,
        isReviewing: false,
        isContextCompacting: false,
        processingStartedAt: null,
        lastDurationMs: durationMs,
        heartbeatPulse: 0,
      },
    },
    itemsByThread: { [threadId]: items },
  };
}

function makeComplete(threadId: string, text: string) {
  return {
    type: "completeAgentMessage" as const,
    workspaceId: "ws-1",
    threadId,
    itemId: ITEM_ID,
    text,
    hasCustomName: false,
  };
}

function makeUpsert(threadId: string, item: ConversationItem) {
  return {
    type: "upsertItem" as const,
    workspaceId: "ws-1",
    threadId,
    item,
    hasCustomName: false,
  };
}

describe("threadReducer complete/upsert fast path (INCREMENTAL_DERIVATION_ENABLED)", () => {
  it("completeAgentMessage on already-final equivalent text returns prior state reference", () => {
    const threadId = "thread-complete-fast";
    const text = "Final answer text after streaming";
    const base = processingStateWithDuration(
      threadId,
      [buildAssistantItem(text, true) as ConversationItem],
      null,
    );

    __resetPrepareThreadItemsCallCountForTests();
    const next = threadReducer(base, makeComplete(threadId, text));

    expect(__getPrepareThreadItemsCallCountForTests()).toBe(0);
    expect(next).toBe(base);
  });

  it("completeAgentMessage when text diverges from existing final still updates state", () => {
    const threadId = "thread-complete-diverges";
    const base = processingStateWithDuration(
      threadId,
      [buildAssistantItem("old text", true) as ConversationItem],
      80,
    );

    __resetPrepareThreadItemsCallCountForTests();
    const next = threadReducer(
      base,
      makeComplete(threadId, "brand new text different from old text"),
    );

    expect(__getPrepareThreadItemsCallCountForTests()).toBe(1);
    expect(next).not.toBe(base);
    const items = next.itemsByThread[threadId] ?? [];
    expect(items[0]?.kind).toBe("message");
    if (items[0]?.kind === "message") {
      expect(items[0].text).toBe("brand new text different from old text");
      expect(items[0].isFinal).toBe(true);
    }
  });

  it("completeAgentMessage on streaming (not-yet-final) item still updates state", () => {
    const threadId = "thread-complete-from-streaming";
    const base = processingStateWithDuration(
      threadId,
      [buildAssistantItem("Hello", false) as ConversationItem],
      null,
    );

    __resetPrepareThreadItemsCallCountForTests();
    const next = threadReducer(base, makeComplete(threadId, "Hello world"));

    expect(__getPrepareThreadItemsCallCountForTests()).toBe(1);
    const items = next.itemsByThread[threadId] ?? [];
    expect(items[0]?.kind).toBe("message");
    if (items[0]?.kind === "message") {
      expect(items[0].isFinal).toBe(true);
    }
  });

  it("upsertItem on existing same-id same-data item returns prior state reference", () => {
    const threadId = "thread-upsert-same";
    const assistantItem = buildAssistantItem("unchanged assistant text", true);
    const base = processingState(threadId, [assistantItem]);
    __resetPrepareThreadItemsCallCountForTests();
    const next = threadReducer(base, makeUpsert(threadId, assistantItem));
    expect(__getPrepareThreadItemsCallCountForTests()).toBe(0);
    expect(next).toBe(base);
  });

  it("upsertItem on tool item still uses slow path", () => {
    const threadId = "thread-upsert-tool";
    const toolItem: ConversationItem = {
      id: "tool-1",
      kind: "tool",
      toolType: "Read",
      title: "Read",
      detail: "a.ts",
      status: "completed",
    };
    const base = processingState(threadId, [toolItem]);
    __resetPrepareThreadItemsCallCountForTests();
    const next = threadReducer(base, makeUpsert(threadId, toolItem));
    expect(__getPrepareThreadItemsCallCountForTests()).toBe(1);
    expect(next).not.toBe(base);
    expect(next.itemsByThread[threadId]?.length).toBe(1);
  });

  it("upsertItem on a new (non-existing) item still updates state and calls prepareThreadItems", () => {
    const threadId = "thread-upsert-new";
    const newReasoningItem: ConversationItem = {
      id: "reasoning-new",
      kind: "reasoning",
      summary: "thinking",
      content: "thought body",
    };
    const base = processingState(threadId, []);
    __resetPrepareThreadItemsCallCountForTests();
    const next = threadReducer(base, makeUpsert(threadId, newReasoningItem));
    expect(__getPrepareThreadItemsCallCountForTests()).toBe(1);
    expect(next.itemsByThread[threadId]?.length).toBe(1);
  });
});
