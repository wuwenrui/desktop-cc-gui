// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import type { ConversationItem, ThreadSummary } from "../../../types";
import { buildWorkspaceIndex } from "./buildWorkspaceIndex";
import {
  isProviderStale,
  threadFingerprints,
  syncWorkspaceIndex,
  versionKeyForProvider,
} from "./syncWorkspaceIndex";

function makeThread(id: string, name: string, updatedAt = 10): ThreadSummary {
  return { id, name, updatedAt };
}

function makeMessage(id: string, text: string): ConversationItem {
  return { id, kind: "message", role: "user", text };
}

function makeInput(overrides: Partial<{
  workspaceId: string;
  files: string[];
  threads: ThreadSummary[];
  threadItemsByThread: Record<string, ConversationItem[]>;
}> = {}) {
  return {
    workspaceId: "w-1",
    files: [],
    threads: [],
    threadItemsByThread: {},
    ...overrides,
  };
}

describe("syncWorkspaceIndex", () => {
  it("returns a fresh build when there is no previous state", () => {
    const result = syncWorkspaceIndex({
      ...makeInput({ files: ["a.ts"] }),
    });
    expect(result.workspaceId).toBe("w-1");
    expect(result.items.file?.length).toBe(1);
  });

  it("returns the same state reference when nothing changed", () => {
    const previous = buildWorkspaceIndex(
      makeInput({
        files: ["a.ts", "b.ts"],
        threads: [makeThread("t-1", "Thread")],
        threadItemsByThread: { "t-1": [makeMessage("m-1", "hello")] },
      }),
    );
    const result = syncWorkspaceIndex({
      ...makeInput({
        files: ["a.ts", "b.ts"],
        threads: [makeThread("t-1", "Thread")],
        threadItemsByThread: { "t-1": [makeMessage("m-1", "hello")] },
      }),
      previous,
    });
    expect(result).toBe(previous);
  });

  it("rebuilds only the file provider when only the file count changes", () => {
    const previous = buildWorkspaceIndex(
      makeInput({
        files: ["a.ts"],
        threads: [makeThread("t-1", "Thread")],
        threadItemsByThread: { "t-1": [makeMessage("m-1", "hello")] },
      }),
    );
    const result = syncWorkspaceIndex({
      ...makeInput({
        files: ["a.ts", "b.ts"],
        threads: [makeThread("t-1", "Thread")],
        threadItemsByThread: { "t-1": [makeMessage("m-1", "hello")] },
      }),
      previous,
    });

    expect(result.items.file).not.toBe(previous.items.file);
    expect(result.items.file?.length).toBe(2);
    // Threads and messages are untouched → reference preserved.
    expect(result.items.thread).toBe(previous.items.thread);
    expect(result.items.message).toBe(previous.items.message);
    expect(result.sourceVersions.thread).toBe(previous.sourceVersions.thread);
    expect(result.sourceVersions.message).toBe(previous.sourceVersions.message);
    expect(result.sourceVersions.file?.version).not.toBe(
      previous.sourceVersions.file?.version,
    );
  });

  it("rebuilds the thread provider when thread count changes", () => {
    const previous = buildWorkspaceIndex(
      makeInput({
        files: ["a.ts"],
        threads: [makeThread("t-1", "Thread")],
        threadItemsByThread: { "t-1": [makeMessage("m-1", "hello")] },
      }),
    );
    const result = syncWorkspaceIndex({
      ...makeInput({
        files: ["a.ts"],
        threads: [makeThread("t-1", "Thread"), makeThread("t-2", "Thread 2")],
        threadItemsByThread: { "t-1": [makeMessage("m-1", "hello")] },
      }),
      previous,
    });

    expect(result.items.thread).not.toBe(previous.items.thread);
    expect(result.items.thread?.length).toBe(2);
    expect(result.items.file).toBe(previous.items.file);
    expect(result.items.message).toBe(previous.items.message);
  });

  it("rebuilds the message provider when message count changes", () => {
    const previous = buildWorkspaceIndex(
      makeInput({
        files: ["a.ts"],
        threads: [makeThread("t-1", "Thread")],
        threadItemsByThread: { "t-1": [makeMessage("m-1", "hello")] },
      }),
    );
    const result = syncWorkspaceIndex({
      ...makeInput({
        files: ["a.ts"],
        threads: [makeThread("t-1", "Thread")],
        threadItemsByThread: {
          "t-1": [makeMessage("m-1", "hello"), makeMessage("m-2", "world")],
        },
      }),
      previous,
    });

    expect(result.items.message).not.toBe(previous.items.message);
    expect(result.items.message?.length).toBe(2);
    expect(result.items.file).toBe(previous.items.file);
    expect(result.items.thread).toBe(previous.items.thread);
  });

  it("treats a workspaceId mismatch as a fresh build", () => {
    const previous = buildWorkspaceIndex(
      makeInput({ workspaceId: "w-1", files: ["a.ts"] }),
    );
    const result = syncWorkspaceIndex({
      ...makeInput({ workspaceId: "w-2", files: ["b.ts"] }),
      previous,
    });
    expect(result.workspaceId).toBe("w-2");
    expect(result.items.file).not.toBe(previous.items.file);
    expect(result.items.file?.[0].id).toBe("file:w-2:b.ts");
  });

  it("tracks content changes in the source version", () => {
    const first = syncWorkspaceIndex({
      ...makeInput({ files: ["a.ts"] }),
    });
    const second = syncWorkspaceIndex({
      ...makeInput({ files: ["a.ts", "b.ts"] }),
      previous: first,
    });
    const third = syncWorkspaceIndex({
      ...makeInput({ files: ["a.ts", "b.ts", "c.ts"] }),
      previous: second,
    });

    expect(first.sourceVersions.file?.version).not.toBe(
      second.sourceVersions.file?.version,
    );
    expect(second.sourceVersions.file?.version).not.toBe(
      third.sourceVersions.file?.version,
    );
  });

  it("preserves updatedAt monotonicity across rebuilds", async () => {
    const first = syncWorkspaceIndex({
      ...makeInput({ files: ["a.ts"] }),
    });
    await new Promise((resolve) => setTimeout(resolve, 2));
    const second = syncWorkspaceIndex({
      ...makeInput({ files: ["a.ts", "b.ts"] }),
      previous: first,
    });

    expect(second.sourceVersions.file?.updatedAt).toBeGreaterThanOrEqual(
      first.sourceVersions.file?.updatedAt ?? 0,
    );
  });
});

describe("isProviderStale", () => {
  it("treats missing state as stale", () => {
    expect(isProviderStale(undefined, "w-1", "file", makeInput({ files: ["a.ts"] }))).toBe(true);
  });

  it("returns false when the content version matches the stored version", () => {
    const state = buildWorkspaceIndex(makeInput({ files: ["a.ts", "b.ts"] }));
    expect(
      isProviderStale(state, "w-1", "file", makeInput({ files: ["b.ts", "a.ts"] })),
    ).toBe(false);
  });

  it("returns true when same-count content drifts from the stored version", () => {
    const state = buildWorkspaceIndex(makeInput({ files: ["a.ts", "b.ts"] }));
    expect(
      isProviderStale(state, "w-1", "file", makeInput({ files: ["a.ts", "c.ts"] })),
    ).toBe(true);
  });
});

describe("versionKeyForProvider", () => {
  it("returns the stored version key for a provider", () => {
    const state = buildWorkspaceIndex(makeInput({ files: ["a.ts"] }));
    const key = versionKeyForProvider(state, "file");
    expect(key?.workspaceId).toBe("w-1");
    expect(key?.provider).toBe("file");
  });

  it("returns undefined for a provider that was never built", () => {
    const state = buildWorkspaceIndex(makeInput({ files: ["a.ts"] }));
    // The build currently seeds file / thread / message; this asserts the
    // helper is honest when the slot is missing.
    expect(versionKeyForProvider(state, "kanban")).toBeUndefined();
  });
});

describe("threadFingerprints (inline)", () => {
  function t(id: string, name: string) {
    return { id, name, updatedAt: 0 };
  }
  it("produces a sorted list of id+name pairs", () => {
    expect(threadFingerprints([t("t-2", "beta"), t("t-1", "alpha")])).toEqual([
      "thread\u0000t-1\u0000alpha\u00000",
      "thread\u0000t-2\u0000beta\u00000",
    ]);
  });
  it("skips threads with empty names", () => {
    expect(threadFingerprints([t("t-1", ""), t("t-2", "kept")])).toEqual([
      "thread\u0000t-2\u0000kept\u00000",
    ]);
  });
  it("detects a rename in place as a different fingerprint set", () => {
    expect(threadFingerprints([t("t-1", "Original")])).not.toEqual(
      threadFingerprints([t("t-1", "Renamed")]),
    );
  });
});
