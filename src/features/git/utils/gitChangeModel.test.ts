import { describe, expect, it } from "vitest";
import type { GitFileDiff, GitFileStatus } from "../../../types";
import {
  buildCanonicalGitChanges,
  countDiffStats,
  getGitChangeActionKey,
  getGitChangeListRowKey,
  getGitChangeViewerKey,
  inferGitDiffStatus,
  normalizeGitChangePath,
} from "./gitChangeModel";

const statusFile = (
  path: string,
  status: string,
  additions = 0,
  deletions = 0,
): GitFileStatus => ({ path, status, additions, deletions });

const diffFile = (
  path: string,
  diff: string,
  status?: string,
): GitFileDiff => {
  const entry: GitFileDiff = { path, diff };
  if (status) {
    entry.status = status;
  }
  return entry;
};

describe("gitChangeModel", () => {
  it("normalizes repository-relative paths without OS-specific APIs", () => {
    expect(normalizeGitChangePath("src\\features//git\\file.ts")).toBe(
      "src/features/git/file.ts",
    );
    expect(normalizeGitChangePath(" docs/My File.md ")).toBe("docs/My File.md");
  });

  it("keeps status entries authoritative when matching diff evidence exists", () => {
    const result = buildCanonicalGitChanges({
      files: [statusFile("src/app.ts", "M", 3, 1)],
      stagedFiles: [statusFile("src/app.ts", "M", 3, 1)],
      diffs: [diffFile("src/app.ts", "@@ -1 +1 @@\n-old\n+new", "A")],
    });

    expect(result.files).toEqual([statusFile("src/app.ts", "M", 3, 1)]);
    expect(result.stagedFiles).toEqual([statusFile("src/app.ts", "M", 3, 1)]);
    expect(result.viewerDiffs[0]).toMatchObject({
      path: "src/app.ts",
      status: "M",
      diff: "@@ -1 +1 @@\n-old\n+new",
    });
  });

  it("fills missing status stats from matching diff evidence", () => {
    const result = buildCanonicalGitChanges({
      files: [statusFile("CHANGELOG.md", "M", 0, 0)],
      unstagedFiles: [statusFile("CHANGELOG.md", "M", 0, 0)],
      diffs: [
        diffFile(
          "CHANGELOG.md",
          "@@ -1,2 +1,8 @@\n old\n+one\n+two\n+three\n+four\n+five\n+six",
        ),
      ],
    });

    expect(result.files).toEqual([statusFile("CHANGELOG.md", "M", 6, 0)]);
    expect(result.unstagedFiles).toEqual([statusFile("CHANGELOG.md", "M", 6, 0)]);
  });

  it("adds diff-only new files as preview-only fallback rows", () => {
    const result = buildCanonicalGitChanges({
      files: [],
      diffs: [
        diffFile(
          "src/new-file.ts",
          "diff --git a/src/new-file.ts b/src/new-file.ts\nnew file mode 100644\n--- /dev/null\n+++ b/src/new-file.ts\n@@ -0,0 +1 @@\n+export {};",
        ),
      ],
    });

    expect(result.files).toEqual([
      {
        path: "src/new-file.ts",
        status: "A",
        additions: 1,
        deletions: 0,
        isDiffOnlyFallback: true,
        mutationDisabled: true,
      },
    ]);
    expect(result.unstagedFiles[0]?.mutationDisabled).toBe(true);
    expect(result.viewerDiffs[0]?.isDiffOnlyFallback).toBe(true);
  });

  it("adds diff-only deleted files as preview-only fallback rows", () => {
    const result = buildCanonicalGitChanges({
      files: [],
      diffs: [
        diffFile(
          "src/old-file.ts",
          "diff --git a/src/old-file.ts b/src/old-file.ts\ndeleted file mode 100644\n--- a/src/old-file.ts\n+++ /dev/null\n@@ -1 +0,0 @@\n-export {};",
        ),
      ],
    });

    expect(result.files[0]).toMatchObject({
      path: "src/old-file.ts",
      status: "D",
      additions: 0,
      deletions: 1,
      isDiffOnlyFallback: true,
      mutationDisabled: true,
    });
  });

  it("preserves same-path staged and unstaged section state", () => {
    const result = buildCanonicalGitChanges({
      files: [statusFile("src/app.ts", "M", 2, 2)],
      stagedFiles: [statusFile("src/app.ts", "M", 1, 0)],
      unstagedFiles: [statusFile("src\\app.ts", "M", 1, 2)],
      diffs: [diffFile("src/app.ts", "@@ -1 +1 @@\n-old\n+new")],
    });

    expect(result.stagedFiles).toHaveLength(1);
    expect(result.unstagedFiles).toHaveLength(1);
    expect(getGitChangeListRowKey("staged", "src/app.ts")).not.toBe(
      getGitChangeListRowKey("unstaged", "src/app.ts"),
    );
    expect(getGitChangeViewerKey("src\\app.ts")).toBe("src/app.ts");
    expect(getGitChangeActionKey("unstaged", "src/app.ts", "discard")).toBe(
      "unstaged:src/app.ts:discard",
    );
  });

  it("does not duplicate fallback diff stats across staged and unstaged rows", () => {
    const result = buildCanonicalGitChanges({
      files: [statusFile("src/app.ts", "M", 0, 0)],
      stagedFiles: [statusFile("src/app.ts", "M", 0, 0)],
      unstagedFiles: [statusFile("src/app.ts", "M", 0, 0)],
      diffs: [diffFile("src/app.ts", "@@ -1 +1 @@\n-old\n+new")],
    });

    expect(result.files).toEqual([statusFile("src/app.ts", "M", 1, 1)]);
    expect(result.stagedFiles).toEqual([statusFile("src/app.ts", "M", 0, 0)]);
    expect(result.unstagedFiles).toEqual([statusFile("src/app.ts", "M", 0, 0)]);
  });

  it("infers status consistently for CRLF and LF diffs", () => {
    const lfDiff =
      "diff --git a/a.txt b/a.txt\nnew file mode 100644\n--- /dev/null\n+++ b/a.txt\n@@ -0,0 +1,2 @@\n+one\n+two";
    const crlfDiff = lfDiff.replace(/\n/g, "\r\n");

    expect(inferGitDiffStatus(diffFile("a.txt", lfDiff))).toBe("A");
    expect(inferGitDiffStatus(diffFile("a.txt", crlfDiff))).toBe("A");
    expect(countDiffStats(lfDiff)).toEqual(countDiffStats(crlfDiff));
  });

  it("accepts optional diff status and old payloads without status", () => {
    expect(inferGitDiffStatus(diffFile("renamed.ts", "", "R"))).toBe("R");
    expect(
      inferGitDiffStatus(diffFile("modified.ts", "@@ -1 +1 @@\n-a\n+b")),
    ).toBe("M");
  });

  it("infers rename display status from rename headers", () => {
    const result = buildCanonicalGitChanges({
      files: [],
      diffs: [
        diffFile(
          "src/new-name.ts",
          "diff --git a/src/old-name.ts b/src/new-name.ts\nsimilarity index 98%\nrename from src/old-name.ts\nrename to src/new-name.ts",
        ),
      ],
    });

    expect(result.files[0]?.status).toBe("R");
  });

  it("drops missing-path payloads and does not synthesize fallback without diff evidence", () => {
    const result = buildCanonicalGitChanges({
      files: [],
      diffs: [
        { path: "", diff: "@@ -1 +1 @@" },
        { path: "src/empty.ts", diff: "" },
      ],
    });

    expect(result.files).toEqual([]);
    expect(result.viewerDiffs).toEqual([]);
  });

  it("preserves image metadata through projection", () => {
    const result = buildCanonicalGitChanges({
      files: [statusFile("assets/logo.png", "M")],
      diffs: [
        {
          path: "assets/logo.png",
          diff: "",
          isBinary: true,
          isImage: true,
          oldImageData: "old",
          newImageData: "new",
          oldImageMime: "image/png",
          newImageMime: "image/png",
        },
      ],
    });

    expect(result.viewerDiffs[0]).toMatchObject({
      isBinary: true,
      isImage: true,
      oldImageData: "old",
      newImageData: "new",
    });
  });
});
