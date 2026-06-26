import { describe, expect, it } from "vitest";
import type { ConversationItem } from "../../../types";
import { initialState, threadReducer } from "./useThreadsReducer";

const WORKSPACE = "ws-flush-batch";
const THREAD = "thread-flush-batch";
const ITEM_ID = "assistant-flush-batch";
const EARLIER = 1_700_000_000_000;
const LATER = EARLIER + 1_000;

function withSeed(state = initialState) {
  return {
    ...state,
    threadsByWorkspace: {
      [WORKSPACE]: [
        {
          id: THREAD,
          name: "flush",
          engineSource: "codex" as const,
          createdAt: EARLIER - 10_000,
          updatedAt: EARLIER - 5_000,
        },
      ],
    },
    itemsByThread: {
      [THREAD]: [] as ConversationItem[],
    },
  };
}

describe("threadReducer flushAgentCompletedBatch", () => {
  it("equivalent to 4 sequential dispatches", () => {
    const seed = withSeed();

    const sequential = threadReducer(
      threadReducer(
        threadReducer(
          threadReducer(seed, {
            type: "ensureThread",
            workspaceId: WORKSPACE,
            threadId: THREAD,
            engine: "codex",
          }),
          {
            type: "completeAgentMessage",
            workspaceId: WORKSPACE,
            threadId: THREAD,
            itemId: ITEM_ID,
            text: "hello world",
            hasCustomName: false,
            timestamp: LATER,
          },
        ),
        {
          type: "setThreadTimestamp",
          workspaceId: WORKSPACE,
          threadId: THREAD,
          timestamp: LATER,
        },
      ),
      {
        type: "setLastAgentMessage",
        threadId: THREAD,
        text: "hello world",
        timestamp: LATER,
      },
    );

    const batched = threadReducer(
      {
        ...seed,
        threadsByWorkspace: {
          [WORKSPACE]: seed.threadsByWorkspace[WORKSPACE].map((t) =>
            t.id === THREAD ? { ...t, engineSource: "codex" } : t,
          ),
        },
      },
      {
        type: "ensureThread",
        workspaceId: WORKSPACE,
        threadId: THREAD,
        engine: "codex",
      },
    );
    const batched2 = threadReducer(batched, {
      type: "flushAgentCompletedBatch",
      workspaceId: WORKSPACE,
      threadId: THREAD,
      itemId: ITEM_ID,
      text: "hello world",
      hasCustomName: false,
      timestamp: LATER,
      isActiveThread: true,
    });

    expect(batched2.itemsByThread[THREAD]).toEqual(
      sequential.itemsByThread[THREAD],
    );
    expect(batched2.threadsByWorkspace[WORKSPACE]).toEqual(
      sequential.threadsByWorkspace[WORKSPACE],
    );
    expect(batched2.lastAgentMessageByThread[THREAD]).toEqual(
      sequential.lastAgentMessageByThread[THREAD],
    );
  });

  it("isActiveThread=false sets hasUnread true", () => {
    const seed = withSeed();
    const next = threadReducer(
      {
        ...seed,
        threadsByWorkspace: {
          [WORKSPACE]: seed.threadsByWorkspace[WORKSPACE].map((t) =>
            t.id === THREAD ? { ...t, engineSource: "codex" } : t,
          ),
        },
      },
      {
        type: "ensureThread",
        workspaceId: WORKSPACE,
        threadId: THREAD,
        engine: "codex",
      },
    );
    const after = threadReducer(next, {
      type: "flushAgentCompletedBatch",
      workspaceId: WORKSPACE,
      threadId: THREAD,
      itemId: ITEM_ID,
      text: "background turn",
      hasCustomName: false,
      timestamp: LATER,
      isActiveThread: false,
    });

    expect(after.threadStatusById[THREAD]?.hasUnread).toBe(true);
  });

  it("isActiveThread=true keeps hasUnread falsy", () => {
    const seed = withSeed();
    const after = threadReducer(
      {
        ...seed,
        threadsByWorkspace: {
          [WORKSPACE]: seed.threadsByWorkspace[WORKSPACE].map((t) =>
            t.id === THREAD ? { ...t, engineSource: "codex" } : t,
          ),
        },
      },
      {
        type: "ensureThread",
        workspaceId: WORKSPACE,
        threadId: THREAD,
        engine: "codex",
      },
    );
    const after2 = threadReducer(after, {
      type: "flushAgentCompletedBatch",
      workspaceId: WORKSPACE,
      threadId: THREAD,
      itemId: ITEM_ID,
      text: "active turn",
      hasCustomName: false,
      timestamp: LATER,
      isActiveThread: true,
    });

    expect(after2.threadStatusById[THREAD]?.hasUnread).toBeFalsy();
  });

  it("stale timestamp keeps existing thread updatedAt", () => {
    const seed = withSeed();
    const seedWithExistingTimestamp = {
      ...seed,
      threadsByWorkspace: {
        [WORKSPACE]: [
          {
            id: THREAD,
            name: "flush",
            engineSource: "codex" as const,
            createdAt: EARLIER - 10_000,
            updatedAt: LATER + 5_000,
          },
        ],
      },
    };
    const before = threadReducer(seedWithExistingTimestamp, {
      type: "ensureThread",
      workspaceId: WORKSPACE,
      threadId: THREAD,
      engine: "codex",
    });
    const after = threadReducer(before, {
      type: "flushAgentCompletedBatch",
      workspaceId: WORKSPACE,
      threadId: THREAD,
      itemId: ITEM_ID,
      text: "stale",
      hasCustomName: false,
      timestamp: LATER,
      isActiveThread: true,
    });
    expect(after.threadsByWorkspace[WORKSPACE][0].updatedAt).toBe(LATER + 5_000);
  });

  it("legacy completeAgentMessage action still works", () => {
    const seed = withSeed();
    const s1 = threadReducer(seed, {
      type: "completeAgentMessage",
      workspaceId: WORKSPACE,
      threadId: THREAD,
      itemId: ITEM_ID,
      text: "legacy path",
      hasCustomName: false,
      timestamp: LATER,
    });
    expect(s1.itemsByThread[THREAD].length).toBeGreaterThan(0);
    expect(s1.threadsByWorkspace[WORKSPACE][0].updatedAt).toBe(EARLIER - 5_000);
  });
});
