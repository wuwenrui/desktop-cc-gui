// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ConversationItem } from "../../../types";
import type { ThreadState } from "./useThreadsReducer";
import { useThreadRealtimeHistoryReconcile } from "./useThreadRealtimeHistoryReconcile";

function createProcessingStatus(): ThreadState["threadStatusById"][string] {
  return {
    isProcessing: true,
    hasUnread: false,
    isReviewing: false,
    processingStartedAt: Date.now(),
    lastDurationMs: null,
  };
}

function createAssistantFinalItem(id: string, text: string): ConversationItem {
  return {
    id,
    kind: "message",
    role: "assistant",
    text,
    isFinal: true,
    finalCompletedAt: Date.now(),
  };
}

describe("useThreadRealtimeHistoryReconcile Codex terminal drift", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-20T08:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("reconciles Codex assistant completion while the thread is still processing", async () => {
    const itemsByThreadRef = {
      current: {
        "thread-a": [createAssistantFinalItem("assistant-a", "done")],
      } satisfies Record<string, ConversationItem[]>,
    };
    const threadStatusByIdRef = {
      current: {
        "thread-a": createProcessingStatus(),
      } satisfies ThreadState["threadStatusById"],
    };
    const refreshThread = vi.fn().mockResolvedValue("thread-a");
    const settleCodexTerminalDrift = vi.fn();

    const { result } = renderHook(() =>
      useThreadRealtimeHistoryReconcile({
        itemsByThreadRef,
        refreshThread,
        resolveCanonicalThreadId: (threadId) => threadId,
        settleCodexTerminalDrift,
        threadStatusByIdRef,
        threadsByWorkspace: {
          "ws-1": [
            {
              id: "thread-a",
              name: "A",
              updatedAt: Date.now(),
              engineSource: "codex",
            },
          ],
        },
      }),
    );

    act(() => {
      result.current.handleCodexAssistantCompletedForHistoryReconcile({
        workspaceId: "ws-1",
        threadId: "thread-a",
        turnId: "turn-a",
      });
    });

    expect(refreshThread).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_200);
    });

    expect(refreshThread).toHaveBeenCalledWith("ws-1", "thread-a");
    expect(settleCodexTerminalDrift).toHaveBeenCalledWith({
      workspaceId: "ws-1",
      threadId: "thread-a",
      turnId: "turn-a",
      source: "assistant-completed",
    });
  });

  it("does not reconcile Codex assistant completion without a turn id", async () => {
    const itemsByThreadRef = {
      current: {
        "thread-a": [createAssistantFinalItem("assistant-a", "done")],
      } satisfies Record<string, ConversationItem[]>,
    };
    const threadStatusByIdRef = {
      current: {
        "thread-a": createProcessingStatus(),
      } satisfies ThreadState["threadStatusById"],
    };
    const refreshThread = vi.fn().mockResolvedValue("thread-a");
    const settleCodexTerminalDrift = vi.fn();

    const { result } = renderHook(() =>
      useThreadRealtimeHistoryReconcile({
        itemsByThreadRef,
        refreshThread,
        resolveCanonicalThreadId: (threadId) => threadId,
        settleCodexTerminalDrift,
        threadStatusByIdRef,
        threadsByWorkspace: {
          "ws-1": [
            {
              id: "thread-a",
              name: "A",
              updatedAt: Date.now(),
              engineSource: "codex",
            },
          ],
        },
      }),
    );

    act(() => {
      result.current.handleCodexAssistantCompletedForHistoryReconcile({
        workspaceId: "ws-1",
        threadId: "thread-a",
      });
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(4_500);
    });

    expect(refreshThread).not.toHaveBeenCalled();
    expect(settleCodexTerminalDrift).not.toHaveBeenCalled();
  });

  it("deduplicates activation terminal-drift reconciliation per thread and turn", async () => {
    const itemsByThreadRef = {
      current: {
        "thread-a": [createAssistantFinalItem("assistant-a", "done")],
      } satisfies Record<string, ConversationItem[]>,
    };
    const threadStatusByIdRef = {
      current: {
        "thread-a": createProcessingStatus(),
      } satisfies ThreadState["threadStatusById"],
    };
    const refreshThread = vi.fn().mockResolvedValue("thread-a");
    const settleCodexTerminalDrift = vi.fn();

    const { result } = renderHook(() =>
      useThreadRealtimeHistoryReconcile({
        itemsByThreadRef,
        refreshThread,
        resolveCanonicalThreadId: (threadId) => threadId,
        settleCodexTerminalDrift,
        threadStatusByIdRef,
        threadsByWorkspace: {
          "ws-1": [
            {
              id: "thread-a",
              name: "A",
              updatedAt: Date.now(),
              engineSource: "codex",
            },
          ],
        },
      }),
    );

    act(() => {
      result.current.handleCodexActivationTerminalDriftReconcile({
        workspaceId: "ws-1",
        threadId: "thread-a",
        turnId: "turn-a",
      });
      result.current.handleCodexActivationTerminalDriftReconcile({
        workspaceId: "ws-1",
        threadId: "thread-a",
        turnId: "turn-a",
      });
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_200);
    });

    expect(refreshThread).toHaveBeenCalledTimes(1);
    expect(settleCodexTerminalDrift).toHaveBeenCalledTimes(1);
    expect(settleCodexTerminalDrift).toHaveBeenCalledWith({
      workspaceId: "ws-1",
      threadId: "thread-a",
      turnId: "turn-a",
      source: "activation-terminal-drift",
    });
  });
});
