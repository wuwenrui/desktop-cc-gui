import { describe, expect, it } from "vitest";
import type { ThreadState } from "./useThreadsReducer";
import { initialState, threadReducer } from "./useThreadsReducer";

describe("threadReducer history restore", () => {
  it("preserves the local Codex compaction message through history reconcile", () => {
    const base: ThreadState = {
      ...initialState,
      itemsByThread: {
        "thread-1": [
          {
            id: "assistant-history-1",
            kind: "message",
            role: "assistant",
            text: "之前的回答",
          },
          {
            id: "context-compacted-codex-compact-thread-1",
            kind: "message",
            role: "assistant",
            text: "Codex 已压缩背景信息",
            engineSource: "codex",
          },
        ],
      },
      threadStatusById: {
        "thread-1": {
          isProcessing: false,
          hasUnread: false,
          isReviewing: false,
          isContextCompacting: false,
          processingStartedAt: null,
          lastDurationMs: null,
          heartbeatPulse: 0,
          continuationPulse: 0,
          terminalPulse: 0,
          codexCompactionSource: "auto",
          codexCompactionLifecycleState: "completed",
          codexCompactionCompletedAt: 2_000,
          lastTokenUsageUpdatedAt: 1_000,
        },
      },
    };

    const next = threadReducer(base, {
      type: "setThreadItems",
      threadId: "thread-1",
      items: [
        {
          id: "assistant-history-1",
          kind: "message",
          role: "assistant",
          text: "之前的回答",
        },
        {
          id: "assistant-history-2",
          kind: "message",
          role: "assistant",
          text: "新的历史补帧",
        },
      ],
    });

    expect(next.itemsByThread["thread-1"]).toEqual([
      {
        id: "assistant-history-1",
        kind: "message",
        role: "assistant",
        text: "之前的回答",
      },
      {
        id: "context-compacted-codex-compact-thread-1",
        kind: "message",
        role: "assistant",
        text: "Codex 已压缩背景信息",
        engineSource: "codex",
      },
      {
        id: "assistant-history-2",
        kind: "message",
        role: "assistant",
        text: "新的历史补帧",
      },
    ]);
  });

  it("keeps long assistant history items untruncated when restoring thread items", () => {
    const longText = Array.from({ length: 5_200 }, (_, index) =>
      `段${index.toString(36).padStart(5, "0")}`,
    ).join("");
    const base: ThreadState = {
      ...initialState,
      threadStatusById: {
        "thread-long": {
          isProcessing: false,
          hasUnread: false,
          isReviewing: false,
          isContextCompacting: false,
          processingStartedAt: null,
          lastDurationMs: null,
          heartbeatPulse: 0,
        },
      },
    };

    const next = threadReducer(base, {
      type: "setThreadItems",
      threadId: "thread-long",
      items: [
        {
          id: "assistant-long",
          kind: "message",
          role: "assistant",
          text: longText,
        },
      ],
    });

    const restored = next.itemsByThread["thread-long"]?.[0];
    expect(restored?.kind).toBe("message");
    if (restored?.kind === "message") {
      expect(restored.text.length).toBe(longText.length);
      expect(restored.text).not.toContain("...");
    }
  });
});
