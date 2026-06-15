// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import type { ConversationItem, ThreadSummary } from "../../../types";
import {
  buildWorkspaceIndex,
  sourceVersionKey,
} from "./buildWorkspaceIndex";
import { isIndexStale } from "./indexItem";

function makeThread(id: string, name: string, updatedAt = 10): ThreadSummary {
  return { id, name, updatedAt };
}

function makeMessage(id: string, text: string): ConversationItem {
  return { id, kind: "message", role: "user", text };
}

describe("buildWorkspaceIndex", () => {
  it("normalizes files, threads and messages with stable ids", () => {
    const state = buildWorkspaceIndex({
      workspaceId: "w-1",
      files: ["src/foo.ts", "src/bar.ts"],
      threads: [makeThread("t-1", "Thread One")],
      threadItemsByThread: {
        "t-1": [makeMessage("m-1", "hello world")],
      },
    });

    expect(state.workspaceId).toBe("w-1");
    expect(state.items.file?.map((item) => item.id)).toEqual([
      "file:w-1:src/foo.ts",
      "file:w-1:src/bar.ts",
    ]);
    expect(state.items.thread?.map((item) => item.id)).toEqual([
      "thread:w-1:t-1",
    ]);
    expect(state.items.message?.map((item) => item.id)).toEqual([
      "message:w-1:t-1:m-1",
    ]);
  });

  it("lowercases matchText but preserves secondaryText casing", () => {
    const state = buildWorkspaceIndex({
      workspaceId: "w-1",
      files: ["Src/MixedCase.ts"],
      threads: [makeThread("t-1", "MixedCase Thread")],
      threadItemsByThread: {
        "t-1": [makeMessage("m-1", "MixedCase Message")],
      },
    });

    expect(state.items.file?.[0].matchText).toBe("src/mixedcase.ts");
    expect(state.items.file?.[0].secondaryText).toBe("Src/MixedCase.ts");
    expect(state.items.thread?.[0].matchText).toBe("mixedcase thread");
    expect(state.items.message?.[0].matchText).toBe("mixedcase message");
  });

  it("drops empty files and threads", () => {
    const state = buildWorkspaceIndex({
      workspaceId: "w-1",
      files: ["", "  ", "src/keep.ts"],
      threads: [makeThread("t-1", ""), makeThread("t-2", "kept")],
      threadItemsByThread: {},
    });

    expect(state.items.file?.map((item) => item.secondaryText)).toEqual([
      "src/keep.ts",
    ]);
    expect(state.items.thread?.map((item) => item.secondaryText)).toEqual([
      "t-2",
    ]);
  });

  it("skips non-message conversation items when building message index", () => {
    const state = buildWorkspaceIndex({
      workspaceId: "w-1",
      files: [],
      threads: [makeThread("t-1", "t")],
      threadItemsByThread: {
        "t-1": [
          { id: "r-1", kind: "reasoning", summary: "s", content: "c" },
          makeMessage("m-1", "kept"),
        ],
      },
    });

    expect(state.items.message?.map((item) => item.id)).toEqual([
      "message:w-1:t-1:m-1",
    ]);
  });

  it("encodes content-aware source versions", () => {
    const state = buildWorkspaceIndex({
      workspaceId: "w-1",
      files: ["a.ts", "b.ts"],
      threads: [makeThread("t-1", "t"), makeThread("t-2", "u")],
      threadItemsByThread: {
        "t-1": [makeMessage("m-1", "x"), makeMessage("m-2", "y")],
        "t-2": [makeMessage("m-3", "z")],
      },
    });

    expect(state.sourceVersions.file?.version).toBeGreaterThan(0);
    expect(state.sourceVersions.thread?.version).toBeGreaterThan(0);
    expect(state.sourceVersions.message?.version).toBeGreaterThan(0);
    expect(state.sourceVersions.file?.workspaceId).toBe("w-1");
  });

  it("produces stable ids across rebuilds when source does not change", () => {
    const a = buildWorkspaceIndex({
      workspaceId: "w-1",
      files: ["src/a.ts"],
      threads: [makeThread("t-1", "Thread")],
      threadItemsByThread: { "t-1": [makeMessage("m-1", "x")] },
    });
    const b = buildWorkspaceIndex({
      workspaceId: "w-1",
      files: ["src/a.ts"],
      threads: [makeThread("t-1", "Thread")],
      threadItemsByThread: { "t-1": [makeMessage("m-1", "x")] },
    });

    expect(a.items.file?.[0].id).toBe(b.items.file?.[0].id);
    expect(a.items.thread?.[0].id).toBe(b.items.thread?.[0].id);
    expect(a.items.message?.[0].id).toBe(b.items.message?.[0].id);
  });

  it("isIndexStale returns false against a fresh build with same source", () => {
    const state = buildWorkspaceIndex({
      workspaceId: "w-1",
      files: ["a.ts"],
      threads: [makeThread("t-1", "t")],
      threadItemsByThread: {},
    });
    expect(
      isIndexStale(state, {
        workspaceId: "w-1",
        provider: "file",
        version: state.sourceVersions.file?.version ?? -1,
        updatedAt: 0,
      }),
    ).toBe(false);
  });
});

describe("sourceVersionKey", () => {
  it("matches the builder's stored provider version", () => {
    const input = {
      workspaceId: "w-1",
      files: ["a.ts", "b.ts"],
      threads: [] as ThreadSummary[],
      threadItemsByThread: {},
    };
    const state = buildWorkspaceIndex(input);
    expect(sourceVersionKey("w-1", "file", input)).toEqual({
      workspaceId: "w-1",
      provider: "file",
      version: state.sourceVersions.file?.version,
      updatedAt: 0,
    });
  });

  it("can be compared with isIndexStale for content-aware checks", () => {
    const input = {
      workspaceId: "w-1",
      files: ["a.ts", "b.ts"],
      threads: [] as ThreadSummary[],
      threadItemsByThread: {},
    };
    const previous = sourceVersionKey("w-1", "file", input);
    expect(
      isIndexStale(
        {
          workspaceId: "w-1",
          items: {},
          sourceVersions: { file: previous },
        },
        sourceVersionKey("w-1", "file", input),
      ),
    ).toBe(false);
    expect(
      isIndexStale(
        {
          workspaceId: "w-1",
          items: {},
          sourceVersions: { file: previous },
        },
        sourceVersionKey("w-1", "file", {
          ...input,
          files: ["a.ts", "c.ts"],
        }),
      ),
    ).toBe(true);
  });
});
