import { describe, expect, it } from "vitest";
import type { ThreadSummary, WorkspaceInfo } from "../../../types";
import { buildSessionRadarFeed } from "./useSessionRadarFeed";

function createWorkspace(id: string, name: string): WorkspaceInfo {
  return {
    id,
    name,
    path: `/tmp/${id}`,
    settings: { sidebarCollapsed: true },
    connected: true,
    kind: "main",
  } as unknown as WorkspaceInfo;
}

function createThread(
  id: string,
  name: string,
  updatedAt: number,
  engineSource: "codex" | "claude" | "gemini" | "opencode" = "codex",
): ThreadSummary {
  return {
    id,
    name,
    updatedAt,
    engineSource,
  };
}

describe("buildSessionRadarFeed", () => {
  it("collects running sessions and excludes live completed sessions", () => {
    const workspaceA = createWorkspace("ws-a", "Workspace A");
    const workspaceB = createWorkspace("ws-b", "Workspace B");
    const now = 10_000_000;

    const feed = buildSessionRadarFeed({
      workspaces: [workspaceA, workspaceB],
      threadsByWorkspace: {
        [workspaceA.id]: [
          createThread("a-running", "A Running", now - 5000),
          createThread("a-recent", "A Recent", now - 10000),
          createThread("a-old", "A Old", now - 3_600_000),
        ],
        [workspaceB.id]: [createThread("b-running", "B Running", now - 2000)],
      },
      threadStatusById: {
        "a-running": { isProcessing: true, processingStartedAt: now - 4000 },
        "a-recent": { isProcessing: false, lastDurationMs: 1234 },
        "a-old": { isProcessing: false, lastDurationMs: 5678 },
        "b-running": { isProcessing: true, processingStartedAt: now - 1500 },
      },
      threadItemsByThread: {},
      lastAgentMessageByThread: {
        "a-recent": { text: "recent done", timestamp: now - 9000 },
        "a-old": { text: "too old", timestamp: now - 3_600_000 },
      },
      now,
    });

    expect(feed.runningSessions.map((entry) => entry.threadId)).toEqual([
      "b-running",
      "a-running",
    ]);
    expect(feed.runningSessions[0]?.startedAt).toBe(now - 1500);
    expect(feed.runningSessions[0]?.durationMs).toBe(1500);
    expect(feed.recentCompletedSessions).toEqual([]);
    expect(feed.runningCountByWorkspaceId).toEqual({
      [workspaceA.id]: 1,
      [workspaceB.id]: 1,
    });
    expect(feed.recentCountByWorkspaceId).toEqual({});
  });

  it("respects running and recent limits", () => {
    const workspace = createWorkspace("ws-main", "Workspace Main");
    const now = 2_000_000;

    const feed = buildSessionRadarFeed({
      workspaces: [workspace],
      threadsByWorkspace: {
        [workspace.id]: [
          createThread("r1", "Run 1", now - 1000),
          createThread("r2", "Run 2", now - 2000),
          createThread("r3", "Run 3", now - 3000),
          createThread("c1", "Done 1", now - 1100),
          createThread("c2", "Done 2", now - 2100),
          createThread("c3", "Done 3", now - 3100),
        ],
      },
      threadStatusById: {
        r1: { isProcessing: true },
        r2: { isProcessing: true },
        r3: { isProcessing: true },
        c1: { isProcessing: false, lastDurationMs: 1200 },
        c2: { isProcessing: false, lastDurationMs: 1200 },
        c3: { isProcessing: false, lastDurationMs: 1200 },
      },
      threadItemsByThread: {},
      lastAgentMessageByThread: {},
      now,
      runningLimit: 2,
      recentLimit: 2,
    });

    expect(feed.runningSessions.map((entry) => entry.threadId)).toEqual(["r1", "r2"]);
    expect(feed.recentCompletedSessions).toEqual([]);
  });

  it("dedupes and stably orders running sessions when freshness ties", () => {
    const workspaceA = createWorkspace("ws-a", "Workspace A");
    const workspaceB = createWorkspace("ws-b", "Workspace B");
    const now = 5_000_000;

    const feed = buildSessionRadarFeed({
      workspaces: [workspaceB, workspaceA, workspaceA],
      threadsByWorkspace: {
        [workspaceA.id]: [
          createThread("thread-b", "Thread B", now),
          createThread("thread-a", "Thread A", now),
        ],
        [workspaceB.id]: [createThread("thread-c", "Thread C", now)],
      },
      threadStatusById: {
        "thread-a": { isProcessing: true, processingStartedAt: now - 2000 },
        "thread-b": { isProcessing: true, processingStartedAt: now - 2000 },
        "thread-c": { isProcessing: true, processingStartedAt: now - 2000 },
      },
      threadItemsByThread: {},
      lastAgentMessageByThread: {},
      now,
    });

    expect(feed.runningSessions.map((entry) => entry.id)).toEqual([
      "ws-a:thread-a",
      "ws-a:thread-b",
      "ws-b:thread-c",
    ]);
  });

  it("keeps running counts keyed to the affected workspace", () => {
    const workspaceA = createWorkspace("ws-a", "Workspace A");
    const workspaceB = createWorkspace("ws-b", "Workspace B");
    const now = 8_000_000;

    const baseInput = {
      workspaces: [workspaceA, workspaceB],
      threadsByWorkspace: {
        [workspaceA.id]: [
          createThread("a-1", "A 1", now - 1000),
          createThread("a-2", "A 2", now - 2000),
        ],
        [workspaceB.id]: [
          createThread("b-1", "B 1", now - 3000),
          createThread("b-2", "B 2", now - 4000),
        ],
      },
      threadItemsByThread: {},
      lastAgentMessageByThread: {},
      now,
    };

    const firstFeed = buildSessionRadarFeed({
      ...baseInput,
      threadStatusById: {
        "a-1": { isProcessing: true },
        "b-1": { isProcessing: true },
      },
    });
    const secondFeed = buildSessionRadarFeed({
      ...baseInput,
      threadStatusById: {
        "a-1": { isProcessing: true },
        "a-2": { isProcessing: true },
        "b-1": { isProcessing: true },
      },
    });

    expect(firstFeed.runningCountByWorkspaceId).toEqual({
      "ws-a": 1,
      "ws-b": 1,
    });
    expect(secondFeed.runningCountByWorkspaceId).toEqual({
      "ws-a": 2,
      "ws-b": 1,
    });
    expect(secondFeed.runningSessions.filter((entry) => entry.workspaceId === "ws-b")).toHaveLength(1);
  });
});
