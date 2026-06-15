// @vitest-environment jsdom
//
// Index invalidation regression tests. These tests pin down the contract
// that `syncWorkspaceIndex` MUST rebuild the stale provider's items in a
// way that is observable to the consumer, and MUST keep the non-stale
// providers' data intact.
//
// The tests do not run the search compute path; they are unit tests on
// the indexing layer so the contract is locked down before the hook is
// wired up to read the index in a future iteration.

import { describe, expect, it } from "vitest";
import type { ConversationItem, ThreadSummary } from "../../../types";
import { buildWorkspaceIndex } from "./buildWorkspaceIndex";
import {
  isProviderStale,
  syncWorkspaceIndex,
} from "./syncWorkspaceIndex";
import type { WorkspaceIndexState } from "./indexItem";

function makeThread(id: string, name: string, updatedAt = 10): ThreadSummary {
  return { id, name, updatedAt };
}

function makeMessage(id: string, text: string): ConversationItem {
  return { id, kind: "message", role: "user", text };
}

function input(overrides: Partial<{
  workspaceId: string;
  files: string[];
  threads: ThreadSummary[];
  threadItemsByThread: Record<string, ConversationItem[]>;
}> = {}) {
  return {
    workspaceId: "w-1",
    files: [] as string[],
    threads: [] as ThreadSummary[],
    threadItemsByThread: {} as Record<string, ConversationItem[]>,
    ...overrides,
  };
}

function fileIds(state: WorkspaceIndexState): string[] {
  return (state.items.file ?? []).map((item) => item.id);
}
function messageIds(state: WorkspaceIndexState): string[] {
  return (state.items.message ?? []).map((item) => item.id);
}

describe("index invalidation: file provider", () => {
  it("a newly added file shows up in the rebuilt index", () => {
    const first = buildWorkspaceIndex(input({ files: ["a.ts"] }));
    const second = syncWorkspaceIndex({
      ...input({ files: ["a.ts", "b.ts"] }),
      previous: first,
    });
    expect(fileIds(second)).toContain("file:w-1:b.ts");
    expect(fileIds(second)).toContain("file:w-1:a.ts");
  });

  it("a removed file is gone from the rebuilt index", () => {
    const first = buildWorkspaceIndex(input({ files: ["a.ts", "b.ts"] }));
    const second = syncWorkspaceIndex({
      ...input({ files: ["a.ts"] }),
      previous: first,
    });
    expect(fileIds(second)).toEqual(["file:w-1:a.ts"]);
  });

  it("an unchanged file list reuses the same items reference", () => {
    const first = buildWorkspaceIndex(input({ files: ["a.ts", "b.ts"] }));
    const second = syncWorkspaceIndex({
      ...input({ files: ["a.ts", "b.ts"] }),
      previous: first,
    });
    expect(second).toBe(first);
    expect(second.items.file).toBe(first.items.file);
  });

  it("a same-count file replacement rebuilds the file provider", () => {
    const first = buildWorkspaceIndex(input({ files: ["a.ts", "b.ts"] }));
    const second = syncWorkspaceIndex({
      ...input({ files: ["a.ts", "c.ts"] }),
      previous: first,
    });
    expect(fileIds(second)).toEqual(["file:w-1:a.ts", "file:w-1:c.ts"]);
    expect(second.items.file).not.toBe(first.items.file);
  });
});

describe("index invalidation: thread provider", () => {
  it("adding a thread grows the thread items list and the version", () => {
    const first = buildWorkspaceIndex(
      input({ threads: [makeThread("t-1", "alpha")] }),
    );
    const second = syncWorkspaceIndex({
      ...input({
        threads: [makeThread("t-1", "alpha"), makeThread("t-2", "beta")],
      }),
      previous: first,
    });
    expect(second.items.thread?.length).toBe(2);
    expect(second.sourceVersions.thread?.version).not.toBe(
      first.sourceVersions.thread?.version,
    );
  });

  it("a same-count thread rename rebuilds the thread provider", () => {
    const first = buildWorkspaceIndex(
      input({ threads: [makeThread("t-1", "alpha")] }),
    );
    const second = syncWorkspaceIndex({
      ...input({ threads: [makeThread("t-1", "renamed")] }),
      previous: first,
    });
    expect(second.items.thread?.[0]?.matchText).toBe("renamed");
    expect(second.items.thread).not.toBe(first.items.thread);
  });
});

describe("index invalidation: message provider", () => {
  it("a new message in an existing thread appears in the rebuilt index", () => {
    const first = buildWorkspaceIndex(
      input({
        threads: [makeThread("t-1", "alpha")],
        threadItemsByThread: { "t-1": [makeMessage("m-1", "hi")] },
      }),
    );
    const second = syncWorkspaceIndex({
      ...input({
        threads: [makeThread("t-1", "alpha")],
        threadItemsByThread: {
          "t-1": [makeMessage("m-1", "hi"), makeMessage("m-2", "world")],
        },
      }),
      previous: first,
    });
    expect(messageIds(second)).toEqual([
      "message:w-1:t-1:m-1",
      "message:w-1:t-1:m-2",
    ]);
  });

  it("a removed message disappears from the rebuilt index", () => {
    const first = buildWorkspaceIndex(
      input({
        threads: [makeThread("t-1", "alpha")],
        threadItemsByThread: {
          "t-1": [makeMessage("m-1", "hi"), makeMessage("m-2", "world")],
        },
      }),
    );
    const second = syncWorkspaceIndex({
      ...input({
        threads: [makeThread("t-1", "alpha")],
        threadItemsByThread: { "t-1": [makeMessage("m-1", "hi")] },
      }),
      previous: first,
    });
    expect(messageIds(second)).toEqual(["message:w-1:t-1:m-1"]);
  });

  it("a same-count message edit rebuilds the message provider", () => {
    const first = buildWorkspaceIndex(
      input({
        threads: [makeThread("t-1", "alpha")],
        threadItemsByThread: { "t-1": [makeMessage("m-1", "old text")] },
      }),
    );
    const second = syncWorkspaceIndex({
      ...input({
        threads: [makeThread("t-1", "alpha")],
        threadItemsByThread: { "t-1": [makeMessage("m-1", "new text")] },
      }),
      previous: first,
    });
    expect(second.items.message?.[0]?.matchText).toBe("new text");
    expect(second.items.message).not.toBe(first.items.message);
  });
});

describe("index invalidation: cross-provider isolation", () => {
  it("a file change does not affect thread or message items", () => {
    const first = buildWorkspaceIndex(
      input({
        files: ["a.ts"],
        threads: [makeThread("t-1", "alpha")],
        threadItemsByThread: { "t-1": [makeMessage("m-1", "hi")] },
      }),
    );
    const second = syncWorkspaceIndex({
      ...input({
        files: ["a.ts", "b.ts"],
        threads: [makeThread("t-1", "alpha")],
        threadItemsByThread: { "t-1": [makeMessage("m-1", "hi")] },
      }),
      previous: first,
    });
    expect(second.items.file).not.toBe(first.items.file);
    expect(second.items.thread).toBe(first.items.thread);
    expect(second.items.message).toBe(first.items.message);
  });

  it("a thread change does not affect file or message items", () => {
    const first = buildWorkspaceIndex(
      input({
        files: ["a.ts"],
        threads: [makeThread("t-1", "alpha")],
        threadItemsByThread: { "t-1": [makeMessage("m-1", "hi")] },
      }),
    );
    const second = syncWorkspaceIndex({
      ...input({
        files: ["a.ts"],
        threads: [makeThread("t-1", "alpha"), makeThread("t-2", "beta")],
        threadItemsByThread: { "t-1": [makeMessage("m-1", "hi")] },
      }),
      previous: first,
    });
    expect(second.items.thread).not.toBe(first.items.thread);
    expect(second.items.file).toBe(first.items.file);
    expect(second.items.message).toBe(first.items.message);
  });

  it("a message change does not affect file or thread items", () => {
    const first = buildWorkspaceIndex(
      input({
        files: ["a.ts"],
        threads: [makeThread("t-1", "alpha")],
        threadItemsByThread: { "t-1": [makeMessage("m-1", "hi")] },
      }),
    );
    const second = syncWorkspaceIndex({
      ...input({
        files: ["a.ts"],
        threads: [makeThread("t-1", "alpha")],
        threadItemsByThread: {
          "t-1": [makeMessage("m-1", "hi"), makeMessage("m-2", "world")],
        },
      }),
      previous: first,
    });
    expect(second.items.message).not.toBe(first.items.message);
    expect(second.items.file).toBe(first.items.file);
    expect(second.items.thread).toBe(first.items.thread);
  });
});

describe("index invalidation: workspace isolation", () => {
  it("two workspaces index independently and do not share items", () => {
    const a = buildWorkspaceIndex(
      input({ workspaceId: "w-a", files: ["a.ts"] }),
    );
    const b = buildWorkspaceIndex(
      input({ workspaceId: "w-b", files: ["b.ts"] }),
    );
    expect(a.items.file?.[0].id).toBe("file:w-a:a.ts");
    expect(b.items.file?.[0].id).toBe("file:w-b:b.ts");
  });

  it("syncing workspace B does not mutate workspace A state", () => {
    const a = buildWorkspaceIndex(
      input({ workspaceId: "w-a", files: ["a.ts"] }),
    );
    const b = buildWorkspaceIndex(
      input({ workspaceId: "w-b", files: ["b.ts"] }),
    );
    const b2 = syncWorkspaceIndex({
      ...input({ workspaceId: "w-b", files: ["b.ts", "c.ts"] }),
      previous: b,
    });
    expect(b2.workspaceId).toBe("w-b");
    expect(a).toBe(a);
    expect(b2.items.file).not.toBe(b.items.file);
  });
});

describe("index invalidation: empty / boundary states", () => {
  it("going from empty to one file rebuilds the file provider", () => {
    const first = buildWorkspaceIndex(input());
    const second = syncWorkspaceIndex({
      ...input({ files: ["a.ts"] }),
      previous: first,
    });
    expect(second.items.file?.length).toBe(1);
    expect(second.sourceVersions.file?.version).not.toBe(
      first.sourceVersions.file?.version,
    );
  });

  it("going from one file to empty rebuilds the file provider", () => {
    const first = buildWorkspaceIndex(input({ files: ["a.ts"] }));
    const second = syncWorkspaceIndex({
      ...input({ files: [] }),
      previous: first,
    });
    expect(second.items.file?.length).toBe(0);
    expect(second.sourceVersions.file?.version).toBe(0);
  });

  it("isProviderStale reflects empty provider content", () => {
    const state = buildWorkspaceIndex(input({ files: ["a.ts"] }));
    expect(isProviderStale(state, "w-1", "file", input({ files: [] }))).toBe(true);
    expect(isProviderStale(state, "w-1", "file", input({ files: ["a.ts"] }))).toBe(false);
  });
});
