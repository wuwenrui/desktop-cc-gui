import { describe, expect, it, beforeEach } from "vitest";
import {
  clearThreadRowProjectionCache,
  getThreadRowProjection,
  getThreadRowProjectionCacheSize,
} from "./threadRowProjection";

describe("ThreadRowProjection", () => {
  beforeEach(() => {
    clearThreadRowProjectionCache();
  });

  it("memoizes projections by (workspaceId, threadId, statusVersion)", () => {
    const input = {
      workspaceId: "ws-1",
      threadId: "thread-1",
      statusVersion: "v1",
      isProcessing: true,
      hasUnread: false,
      backgroundActivityLabel: "running",
    };
    const a = getThreadRowProjection(input);
    const b = getThreadRowProjection(input);
    expect(a).toBe(b);
    expect(getThreadRowProjectionCacheSize()).toBe(1);
  });

  it("treats a status version bump as a fresh projection", () => {
    const a = getThreadRowProjection({
      workspaceId: "ws-1",
      threadId: "thread-1",
      statusVersion: "v1",
      isProcessing: false,
      hasUnread: false,
      backgroundActivityLabel: null,
    });
    const b = getThreadRowProjection({
      workspaceId: "ws-1",
      threadId: "thread-1",
      statusVersion: "v2",
      isProcessing: true,
      hasUnread: true,
      backgroundActivityLabel: "running",
    });
    expect(a).not.toBe(b);
    expect(b.isProcessing).toBe(true);
    expect(getThreadRowProjectionCacheSize()).toBe(2);
  });

  it("bounds the LRU cache to 200 entries", () => {
    for (let i = 0; i < 250; i += 1) {
      getThreadRowProjection({
        workspaceId: "ws-1",
        threadId: `thread-${i}`,
        statusVersion: "v1",
        isProcessing: false,
        hasUnread: false,
        backgroundActivityLabel: null,
      });
    }
    expect(getThreadRowProjectionCacheSize()).toBe(200);
  });
});
