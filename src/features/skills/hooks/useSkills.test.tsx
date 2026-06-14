/** @vitest-environment jsdom */
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkspaceInfo } from "../../../types";
import { getInstalledSkillIndex, getSkillsList } from "../../../services/tauri";
import { useSkills } from "./useSkills";

vi.mock("../../../services/tauri", () => ({
  getInstalledSkillIndex: vi.fn(),
  getSkillsList: vi.fn(),
}));

const workspace: WorkspaceInfo = {
  id: "workspace-1",
  name: "Workspace",
  path: "/tmp/workspace",
  connected: true,
  settings: {
    sidebarCollapsed: false,
  },
};

describe("useSkills", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getInstalledSkillIndex).mockResolvedValue({});
  });

  it("normalizes skill names and reads nested skills/list response", async () => {
    vi.mocked(getSkillsList).mockResolvedValue({
      result: {
        data: [
          {
            cwd: "/tmp/workspace",
            skills: [
              {
                name: "$find-skills",
                path: "/Users/test/.codex/skills/find-skills/SKILL.md",
                description: "discover and install skills",
                enabled: true,
                source: "global_codex",
              },
              {
                name: "/security-review",
                path: "/Users/test/.codex/skills/security-review/SKILL.md",
                shortDescription: "security checks",
                enabled: true,
              },
              {
                name: "disabled-skill",
                path: "/tmp/disabled/SKILL.md",
                enabled: false,
              },
            ],
          },
        ],
      },
    });

    const { result } = renderHook(() =>
      useSkills({
        activeWorkspace: workspace,
      }),
    );

    await waitFor(() => {
      expect(result.current.skills).toHaveLength(2);
    });

    expect(result.current.skills).toEqual([
      {
        name: "find-skills",
        path: "/Users/test/.codex/skills/find-skills/SKILL.md",
        description: "discover and install skills",
        source: "global_codex",
      },
      {
        name: "security-review",
        path: "/Users/test/.codex/skills/security-review/SKILL.md",
        description: "security checks",
      },
    ]);
  });

  it("passes custom skill directories and refreshes when they change", async () => {
    vi.mocked(getSkillsList).mockResolvedValue([]);

    const { rerender } = renderHook(
      ({ customSkillDirectories }) =>
        useSkills({
          activeWorkspace: workspace,
          customSkillDirectories,
        }),
      {
        initialProps: {
          customSkillDirectories: [
            "/opt/skills",
            "  /opt/skills  ",
            "",
            "~/shared-skills",
          ],
        },
      },
    );

    await waitFor(() => {
      expect(getSkillsList).toHaveBeenCalledWith("workspace-1", [
        "/opt/skills",
        "~/shared-skills",
      ]);
    });

    rerender({ customSkillDirectories: ["/new/skills"] });

    await waitFor(() => {
      expect(getSkillsList).toHaveBeenLastCalledWith("workspace-1", [
        "/new/skills",
      ]);
    });
  });

  it("adds installed lawhub display names to matching skills", async () => {
    vi.mocked(getSkillsList).mockResolvedValue([
      {
        name: "criminal-defense-workflow",
        path: "/Users/test/.claude/skills/criminal-defense-workflow/SKILL.md",
        enabled: true,
        source: "global_claude",
      },
    ]);
    vi.mocked(getInstalledSkillIndex).mockResolvedValue({
      "criminal-defense-workflow": {
        display_name: "刑事辩护全流程",
      },
    });

    const { result } = renderHook(() =>
      useSkills({
        activeWorkspace: workspace,
      }),
    );

    await waitFor(() => {
      expect(result.current.skills).toEqual([
        expect.objectContaining({
          name: "criminal-defense-workflow",
          displayName: "刑事辩护全流程",
        }),
      ]);
    });
  });
});
