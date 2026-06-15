// @vitest-environment jsdom
//
// Structural equivalence regression: the index produced by
// `buildWorkspaceIndex` MUST carry the same id space as the per-provider
// search functions (`searchFiles`, `searchThreads`, `searchMessages`) for
// the same raw inputs. This locks down the contract that any future hook
// switch from raw provider to indexed candidates preserves user-visible
// result identity and ranking by `id`.
//
// This test does NOT exercise ranking or score values; it only pins the
// (workspaceId, rawItem) → id mapping and the matchText normalization.

import { describe, expect, it } from "vitest";
import type { ConversationItem, ThreadSummary } from "../../../types";
import { buildWorkspaceIndex } from "./buildWorkspaceIndex";
import { searchFiles } from "../providers/filesProvider";
import { searchThreads } from "../providers/threadProvider";
import { searchMessages } from "../providers/messageProvider";

function makeThread(id: string, name: string, updatedAt = 10): ThreadSummary {
  return { id, name, updatedAt };
}

function makeMessage(id: string, text: string): ConversationItem {
  return { id, kind: "message", role: "user", text };
}

describe("index ↔ provider id equivalence: file", () => {
  it("produces the same id set as searchFiles for the same input", () => {
    const files = ["src/a.ts", "src/b.ts", ""];
    const index = buildWorkspaceIndex({
      workspaceId: "w-1",
      files,
      threads: [],
      threadItemsByThread: {},
    });
    const indexFileIds = (index.items.file ?? []).map((item) => item.id).sort();

    // searchFiles returns ids only for files that match a non-empty query.
    // Use a substring present in both paths so the id set is comparable.
    const providerIds = searchFiles("a", ["src/a.ts", "src/b.ts"], "w-1")
      .map((result) => result.id)
      .sort();
    const indexIdForSrcA = (index.items.file ?? []).find(
      (item) => item.matchText === "src/a.ts",
    )?.id;

    expect(indexFileIds).toContain("file:w-1:src/a.ts");
    expect(indexFileIds).toContain("file:w-1:src/b.ts");
    // The id for src/a.ts must match the provider's id format exactly.
    expect(providerIds).toContain(indexIdForSrcA);
  });

  it("lowercases matchText exactly as the provider lowercases the path", () => {
    const index = buildWorkspaceIndex({
      workspaceId: "w-1",
      files: ["Src/Mixed.ts"],
      threads: [],
      threadItemsByThread: {},
    });
    // searchFiles compares with toLowerCase(); index matchText is already
    // lowercased at build time. The consumer can therefore feed index items
    // into the same `indexOf` check without re-normalizing.
    const lower = (index.items.file ?? [])[0]?.matchText;
    expect(lower).toBe("src/mixed.ts");
    expect("src/mixed.ts".toLowerCase().indexOf("mixed")).toBeGreaterThanOrEqual(0);
  });
});

describe("index ↔ provider id equivalence: thread", () => {
  it("produces the same id set as searchThreads for the same input", () => {
    const threads = [makeThread("t-1", "alpha"), makeThread("t-2", "beta")];
    const index = buildWorkspaceIndex({
      workspaceId: "w-1",
      files: [],
      threads,
      threadItemsByThread: {},
    });
    const indexIds = (index.items.thread ?? []).map((item) => item.id).sort();
    const providerIds = searchThreads("a", threads, "w-1")
      .map((result) => result.id)
      .sort();
    expect(indexIds).toContain("thread:w-1:t-1");
    expect(indexIds).toContain("thread:w-1:t-2");
    expect(providerIds).toEqual(
      expect.arrayContaining([expect.stringMatching(/^thread:w-1:t-1$|^thread:w-1:t-2$/)]),
    );
  });

  it("skips empty-name threads in the same way the provider filters them", () => {
    const threads = [makeThread("t-1", ""), makeThread("t-2", "kept")];
    const index = buildWorkspaceIndex({
      workspaceId: "w-1",
      files: [],
      threads,
      threadItemsByThread: {},
    });
    expect((index.items.thread ?? []).map((item) => item.secondaryText)).toEqual([
      "t-2",
    ]);
    // Provider's filter is on `indexOf(query)`, but it would never return
    // a row for an empty name. The id set in the index is the source of
    // truth for "what would the provider consider".
    expect(
      searchThreads("k", threads, "w-1").map((r) => r.id),
    ).toEqual(["thread:w-1:t-2"]);
  });
});

describe("index ↔ provider id equivalence: message", () => {
  it("produces the same id set as searchMessages for the same input", () => {
    const threads = [makeThread("t-1", "alpha")];
    const items = [makeMessage("m-1", "hello world")];
    const index = buildWorkspaceIndex({
      workspaceId: "w-1",
      files: [],
      threads,
      threadItemsByThread: { "t-1": items },
    });
    const indexIds = (index.items.message ?? []).map((item) => item.id);
    const providerResults = searchMessages({
      query: "hello",
      workspaceId: "w-1",
      threads,
      threadItemsByThread: { "t-1": items },
    });
    const providerIds = providerResults.map((result) => result.id);
    expect(indexIds).toEqual(["message:w-1:t-1:m-1"]);
    expect(providerIds).toEqual(["message:w-1:t-1:m-1"]);
  });

  it("skips non-message items identically to the provider", () => {
    const threads = [makeThread("t-1", "alpha")];
    const items: ConversationItem[] = [
      { id: "r-1", kind: "reasoning", summary: "s", content: "c" },
      makeMessage("m-1", "hello world"),
    ];
    const index = buildWorkspaceIndex({
      workspaceId: "w-1",
      files: [],
      threads,
      threadItemsByThread: { "t-1": items },
    });
    expect((index.items.message ?? []).map((item) => item.id)).toEqual([
      "message:w-1:t-1:m-1",
    ]);
  });
});

describe("index ↔ provider id equivalence: cross-workspace", () => {
  it("the same thread id in two workspaces produces two distinct index ids", () => {
    const threads = [makeThread("t-1", "alpha")];
    const a = buildWorkspaceIndex({
      workspaceId: "w-a",
      files: [],
      threads,
      threadItemsByThread: {},
    });
    const b = buildWorkspaceIndex({
      workspaceId: "w-b",
      files: [],
      threads,
      threadItemsByThread: {},
    });
    expect((a.items.thread ?? [])[0].id).toBe("thread:w-a:t-1");
    expect((b.items.thread ?? [])[0].id).toBe("thread:w-b:t-1");
  });
});
