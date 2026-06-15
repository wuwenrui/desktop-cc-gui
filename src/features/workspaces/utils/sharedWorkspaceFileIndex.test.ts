import { afterEach, describe, expect, it } from "vitest";
import { searchFiles } from "../../search/providers/filesProvider";
import {
  clearSharedWorkspaceFileIndexes,
  invalidateSharedWorkspaceFileIndex,
  readSharedWorkspaceFileIndex,
  tokenizeWorkspacePath,
  upsertSharedWorkspaceFileIndex,
} from "./sharedWorkspaceFileIndex";

afterEach(() => {
  clearSharedWorkspaceFileIndexes();
});

describe("shared workspace file index", () => {
  it("tokenizes path and directory segments without storing file contents", () => {
    expect(tokenizeWorkspacePath("src/features/search/filesProvider.ts")).toEqual([
      "src",
      "features",
      "search",
      "filesprovider",
      "ts",
    ]);
  });

  it("stores a guarded per-workspace index by source version", () => {
    upsertSharedWorkspaceFileIndex({
      workspaceId: "workspace-1",
      sourceVersion: "source-v1",
      files: ["src/app.tsx"],
      directories: ["src"],
      partial: false,
    });

    expect(readSharedWorkspaceFileIndex({
      workspaceId: "workspace-1",
      sourceVersion: "source-v1",
    })?.files[0]).toMatchObject({
      path: "src/app.tsx",
      pathTokens: ["src", "app", "tsx"],
      directoryTokens: ["src"],
    });
    expect(readSharedWorkspaceFileIndex({
      workspaceId: "workspace-1",
      sourceVersion: "source-v2",
    })).toBeNull();
  });

  it("lets file search reuse a fresh shared index and fallback to legacy candidates", () => {
    upsertSharedWorkspaceFileIndex({
      workspaceId: "workspace-1",
      sourceVersion: "source-v1",
      files: ["src/shared-index.ts"],
      directories: ["src"],
      partial: false,
    });

    expect(
      searchFiles("shared", ["legacy-only.ts"], "workspace-1", "source-v1")
        .map((result) => result.filePath),
    ).toEqual(["src/shared-index.ts"]);
    expect(
      searchFiles("legacy", ["legacy-only.ts"], "workspace-1", "source-v2")
        .map((result) => result.filePath),
    ).toEqual(["legacy-only.ts"]);
  });

  it("does not let stale shared index entries override current file candidates", () => {
    upsertSharedWorkspaceFileIndex({
      workspaceId: "workspace-1",
      sourceVersion: "source-v1",
      files: ["src/old-result.ts"],
      directories: ["src"],
      partial: false,
    });
    invalidateSharedWorkspaceFileIndex({
      workspaceId: "workspace-1",
      changedPaths: ["src\\old-result.ts"],
    });

    expect(
      searchFiles("current", ["src/current-result.ts"], "workspace-1", "source-v1")
        .map((result) => result.filePath),
    ).toEqual(["src/current-result.ts"]);
    expect(readSharedWorkspaceFileIndex({ workspaceId: "workspace-1" })?.invalidatedPaths)
      .toEqual(["src/old-result.ts"]);
  });

  it("marks changed paths as stale invalidations", () => {
    upsertSharedWorkspaceFileIndex({
      workspaceId: "workspace-1",
      sourceVersion: "source-v1",
      files: ["src/app.tsx"],
      directories: ["src"],
      partial: false,
    });

    invalidateSharedWorkspaceFileIndex({
      workspaceId: "workspace-1",
      changedPaths: ["src/app.tsx"],
    });

    expect(readSharedWorkspaceFileIndex({ workspaceId: "workspace-1" })).toMatchObject({
      freshness: "stale",
      invalidatedPaths: ["src/app.tsx"],
    });
  });
});
