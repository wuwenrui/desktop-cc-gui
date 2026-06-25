import { describe, expect, it } from "vitest";
import {
  cleanupThreadScopedRefs,
  createWorkspaceScopedMap,
  workspaceScopedDelete,
  workspaceScopedEntries,
  workspaceScopedGet,
  workspaceScopedHas,
  workspaceScopedSet,
} from "./workspaceScopedMap";

describe("workspaceScopedMap (chat-stream-render-isolation-2026-06 task 8.1)", () => {
  it("keeps entries isolated across workspaces", () => {
    const store = createWorkspaceScopedMap<true>();
    workspaceScopedSet(store, "ws-A", "thread-1", true);
    workspaceScopedSet(store, "ws-B", "thread-1", true);
    expect(workspaceScopedHas(store, "ws-A", "thread-1")).toBe(true);
    expect(workspaceScopedHas(store, "ws-B", "thread-1")).toBe(true);
    // Deleting from ws-A must not affect ws-B
    workspaceScopedDelete(store, "ws-A", "thread-1");
    expect(workspaceScopedHas(store, "ws-A", "thread-1")).toBe(false);
    expect(workspaceScopedHas(store, "ws-B", "thread-1")).toBe(true);
  });

  it("falls back to a no-workspace bucket when workspaceId is null", () => {
    const store = createWorkspaceScopedMap<number>();
    workspaceScopedSet(store, null, "thread-1", 1);
    workspaceScopedSet(store, undefined, "thread-2", 2);
    expect(workspaceScopedGet(store, null, "thread-1")).toBe(1);
    expect(workspaceScopedGet(store, undefined, "thread-2")).toBe(2);
  });

  it("returns false for missing entries without mutating the store", () => {
    const store = createWorkspaceScopedMap<true>();
    expect(workspaceScopedHas(store, "ws-A", "nope")).toBe(false);
    expect(store.size).toBe(0);
  });

  it("deletes missing entries without mutating the store", () => {
    const store = createWorkspaceScopedMap<true>();
    workspaceScopedDelete(store, "ws-A", "thread-1");
    expect(store.size).toBe(0);
  });

  it("cleanupThreadScopedRefs only counts stores that had a hit", () => {
    const a = createWorkspaceScopedMap<true>();
    const b = createWorkspaceScopedMap<true>();
    const c = createWorkspaceScopedMap<true>();
    workspaceScopedSet(a, "ws-1", "thread-1", true);
    workspaceScopedSet(b, "ws-1", "thread-1", true);
    // c has no entry for thread-1
    const cleaned = cleanupThreadScopedRefs([a, b, c], "ws-1", "thread-1");
    expect(cleaned).toBe(2);
    expect(workspaceScopedHas(a, "ws-1", "thread-1")).toBe(false);
    expect(workspaceScopedHas(b, "ws-1", "thread-1")).toBe(false);
  });

  it("cleanupThreadScopedRefs respects cross-workspace isolation", () => {
    const a = createWorkspaceScopedMap<true>();
    workspaceScopedSet(a, "ws-1", "thread-1", true);
    workspaceScopedSet(a, "ws-2", "thread-1", true);
    const cleaned = cleanupThreadScopedRefs([a], "ws-1", "thread-1");
    expect(cleaned).toBe(1);
    expect(workspaceScopedHas(a, "ws-1", "thread-1")).toBe(false);
    expect(workspaceScopedHas(a, "ws-2", "thread-1")).toBe(true);
  });

  it("workspaceScopedEntries returns stable insertion-ordered triples", () => {
    const store = createWorkspaceScopedMap<{ n: number }>();
    workspaceScopedSet(store, "ws-A", "thread-1", { n: 1 });
    workspaceScopedSet(store, "ws-A", "thread-2", { n: 2 });
    workspaceScopedSet(store, "ws-B", "thread-1", { n: 3 });
    expect(workspaceScopedEntries(store)).toEqual([
      { workspaceId: "ws-A", threadId: "thread-1", value: { n: 1 } },
      { workspaceId: "ws-A", threadId: "thread-2", value: { n: 2 } },
      { workspaceId: "ws-B", threadId: "thread-1", value: { n: 3 } },
    ]);
  });
});
