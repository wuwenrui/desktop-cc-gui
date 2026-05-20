import { describe, expect, it } from "vitest";
import type { WorkspaceInfo } from "../../../types";
import { buildWorkspaceHeaderGroups } from "./workspaceHeaderGroups";

function workspace(overrides: Partial<WorkspaceInfo> & Pick<WorkspaceInfo, "id" | "name">): WorkspaceInfo {
  const { id, name, ...rest } = overrides;
  const settings = {
    sidebarCollapsed: false,
    sortOrder: null,
    ...overrides.settings,
  };
  return {
    id,
    name,
    path: `/repo/${id}`,
    ...rest,
    settings,
  } as WorkspaceInfo;
}

describe("workspace header groups", () => {
  it("injects sorted worktrees after their parent workspace", () => {
    const parent = workspace({ id: "main", name: "Main" });
    const beta = workspace({
      id: "beta",
      name: "Beta",
      kind: "worktree",
      parentId: "main",
      settings: { sidebarCollapsed: false, sortOrder: 2 },
    });
    const alpha = workspace({
      id: "alpha",
      name: "Alpha",
      kind: "worktree",
      parentId: "main",
      settings: { sidebarCollapsed: false, sortOrder: 1 },
    });

    expect(
      buildWorkspaceHeaderGroups(
        [{ id: "group", name: "Group", workspaces: [parent] }],
        [parent, beta, alpha],
      )[0]?.workspaces.map((entry) => entry.id),
    ).toEqual(["main", "alpha", "beta"]);
  });

  it("preserves parent-only groups without creating replacement hubs", () => {
    const parent = workspace({ id: "main", name: "Main" });

    expect(
      buildWorkspaceHeaderGroups(
        [{ id: null, name: "Default", workspaces: [parent] }],
        [parent],
      ),
    ).toEqual([{ id: null, name: "Default", workspaces: [parent] }]);
  });
});
