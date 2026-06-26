import { describe, expect, it } from "vitest";

import type { ConversationItem } from "../../../types";
import {
  EMPTY_SIDEBAR_SUBAGENT_ITEMS,
  buildShellRuntimeSummary,
} from "./layoutShellSummary";

function assistantItem(id: string, text: string): ConversationItem {
  return {
    id,
    kind: "message",
    role: "assistant",
    text,
  };
}

function toolItem(id: string): ConversationItem {
  return {
    id,
    kind: "tool",
    toolType: "agent",
    title: "Tool: Agent",
    detail: JSON.stringify({ task_id: id, description: "Inspect" }),
    status: "running",
  };
}

describe("layoutShellSummary", () => {
  it("keeps non-Claude realtime streams out of sidebar subagent items", () => {
    const summary = buildShellRuntimeSummary({
      activeWorkspaceId: "ws-1",
      activeThreadId: "codex:thread-1",
      activeItems: [assistantItem("assistant-1", "streaming")],
      activeThreadStatus: { isProcessing: true },
    });

    expect(summary.isActiveThreadProcessing).toBe(true);
    expect(summary.canCopyActiveThread).toBe(true);
    expect(summary.sidebarSubagentItems).toBe(EMPTY_SIDEBAR_SUBAGENT_ITEMS);
  });

  it("passes only Claude tool items needed for live subagent rows", () => {
    const tool = toolItem("tool-1");
    const summary = buildShellRuntimeSummary({
      activeWorkspaceId: "ws-1",
      activeThreadId: "claude:thread-1",
      activeItems: [assistantItem("assistant-1", "ignored"), tool],
      activeThreadStatus: {
        hasUnread: true,
        isReviewing: true,
        isContextCompacting: true,
      },
    });

    expect(summary.hasActiveThreadUnread).toBe(true);
    expect(summary.isActiveThreadReviewing).toBe(true);
    expect(summary.isActiveThreadContextCompacting).toBe(true);
    expect(summary.sidebarSubagentItems).toEqual([tool]);
  });
});
