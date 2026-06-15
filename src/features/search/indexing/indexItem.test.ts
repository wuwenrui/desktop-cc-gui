import { describe, expect, it } from "vitest";
import {
  isIndexStale,
  type SourceVersion,
  type WorkspaceIndexState,
} from "./indexItem";

const baseVersion = (overrides: Partial<SourceVersion> = {}): SourceVersion => ({
  workspaceId: "w-1",
  provider: "file",
  version: 1,
  updatedAt: 1_000,
  ...overrides,
});

describe("isIndexStale", () => {
  it("treats a missing state as stale", () => {
    expect(isIndexStale(undefined, baseVersion())).toBe(true);
  });

  it("treats a missing provider entry as stale", () => {
    const state: WorkspaceIndexState = {
      workspaceId: "w-1",
      items: {},
      sourceVersions: {},
    };
    expect(isIndexStale(state, baseVersion())).toBe(true);
  });

  it("returns false when versions match exactly", () => {
    const state: WorkspaceIndexState = {
      workspaceId: "w-1",
      items: {},
      sourceVersions: { file: baseVersion() },
    };
    expect(isIndexStale(state, baseVersion())).toBe(false);
  });

  it("detects a version bump as stale", () => {
    const state: WorkspaceIndexState = {
      workspaceId: "w-1",
      items: {},
      sourceVersions: { file: baseVersion({ version: 1 }) },
    };
    expect(isIndexStale(state, baseVersion({ version: 2 }))).toBe(true);
  });

  it("treats a workspace mismatch as stale even when versions match", () => {
    const state: WorkspaceIndexState = {
      workspaceId: "w-1",
      items: {},
      sourceVersions: { file: baseVersion({ workspaceId: "w-1", version: 7 }) },
    };
    expect(
      isIndexStale(state, baseVersion({ workspaceId: "w-2", version: 7 })),
    ).toBe(true);
  });

  it("treats a stored provider identity mismatch as stale", () => {
    const state: WorkspaceIndexState = {
      workspaceId: "w-1",
      items: {},
      sourceVersions: {
        file: baseVersion({ provider: "thread", version: 7 }),
      },
    };
    expect(isIndexStale(state, baseVersion({ version: 7 }))).toBe(true);
  });

  it("compares per provider, not globally", () => {
    const state: WorkspaceIndexState = {
      workspaceId: "w-1",
      items: {},
      sourceVersions: {
        thread: baseVersion({ provider: "thread", version: 4 }),
      },
    };
    // file provider has no entry yet, so it is still stale even though
    // thread is fully synced.
    expect(isIndexStale(state, baseVersion({ provider: "file" }))).toBe(true);
    expect(
      isIndexStale(state, baseVersion({ provider: "thread", version: 4 })),
    ).toBe(false);
  });
});
