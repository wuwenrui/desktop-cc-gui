// @vitest-environment jsdom
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getWorkspaceFiles, readWorkspaceFile } from "../../../services/tauri";
import { useGovernanceEvidence } from "./useGovernanceEvidence";

vi.mock("../../../services/tauri", () => ({
  getWorkspaceFiles: vi.fn(),
  readWorkspaceFile: vi.fn(),
}));

const getWorkspaceFilesMock = vi.mocked(getWorkspaceFiles);
const readWorkspaceFileMock = vi.mocked(readWorkspaceFile);

describe("useGovernanceEvidence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not read files when disabled", () => {
    const { result } = renderHook(() => useGovernanceEvidence("ws-1", false));

    expect(result.current).toEqual({
      evidence: [],
      isLoading: false,
      error: null,
    });
    expect(getWorkspaceFilesMock).not.toHaveBeenCalled();
  });

  it("does not read files when workspace id is missing", () => {
    const { result } = renderHook(() => useGovernanceEvidence(null, true));

    expect(result.current).toEqual({
      evidence: [],
      isLoading: false,
      error: null,
    });
    expect(getWorkspaceFilesMock).not.toHaveBeenCalled();
  });

  it("loads read-only governance evidence from workspace files", async () => {
    getWorkspaceFilesMock.mockResolvedValue({
      files: [
        "openspec/changes/demo/tasks.md",
        "package.json",
        ".github/workflows/large-file-governance.yml",
        ".github/workflows/heavy-test-noise-sentry.yml",
      ],
      directories: [],
      gitignored_files: [],
      gitignored_directories: [],
    });
    readWorkspaceFileMock.mockImplementation(async (_workspaceId, path) => {
      if (path === "openspec/changes/demo/tasks.md") {
        return { content: "- [x] done\n- [ ] todo\n", truncated: false };
      }
      if (path === "package.json") {
        return {
          content: JSON.stringify({
            scripts: {
              "check:engine-capability-matrix": "node a.mjs",
            },
          }),
          truncated: false,
        };
      }
      return { content: "", truncated: false };
    });

    const { result } = renderHook(() => useGovernanceEvidence("ws-1", true));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(getWorkspaceFilesMock).toHaveBeenCalledWith("ws-1");
    expect(readWorkspaceFileMock).toHaveBeenCalledWith(
      "ws-1",
      "openspec/changes/demo/tasks.md",
    );
    expect(readWorkspaceFileMock).toHaveBeenCalledWith(
      "ws-1",
      ".artifacts/large-files-gate.json",
    );
    expect(readWorkspaceFileMock).not.toHaveBeenCalledWith(
      "ws-1",
      ".artifacts/large-files-near-threshold.json",
    );
    expect(readWorkspaceFileMock).toHaveBeenCalledWith(
      "ws-1",
      ".artifacts/heavy-test-noise.json",
    );
    expect(readWorkspaceFileMock).toHaveBeenCalledWith("ws-1", "package.json");
    expect(result.current.evidence.map((entry) => entry.id)).toEqual([
      "heavy-test-noise:.artifacts/heavy-test-noise.json",
      "large-file:.artifacts/large-files-gate.json",
      "openspec:tasks",
      "script:harness",
      "workflow:governance",
    ]);
    expect(
      result.current.evidence.filter(
        (entry) => entry.degradationReason === "governance-artifact-missing",
      ),
    ).toHaveLength(2);
  });

  it("reads near-threshold artifact only when the project exposes that gate", async () => {
    getWorkspaceFilesMock.mockResolvedValue({
      files: ["package.json"],
      directories: [],
      gitignored_files: [],
      gitignored_directories: [],
    });
    readWorkspaceFileMock.mockImplementation(async (_workspaceId, path) => {
      if (path === "package.json") {
        return {
          content: JSON.stringify({
            scripts: {
              "check:large-files:near-threshold":
                "node scripts/check-large-files.mjs",
            },
          }),
          truncated: false,
        };
      }
      return { content: "", truncated: false };
    });

    const { result } = renderHook(() => useGovernanceEvidence("ws-1", true));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(readWorkspaceFileMock).toHaveBeenCalledWith(
      "ws-1",
      ".artifacts/large-files-near-threshold.json",
    );
    expect(result.current.evidence.map((entry) => entry.id)).toContain(
      "large-file:.artifacts/large-files-near-threshold.json",
    );
  });

  it("returns degraded evidence when workspace listing fails", async () => {
    getWorkspaceFilesMock.mockRejectedValue(new Error("bridge unavailable"));

    const { result } = renderHook(() => useGovernanceEvidence("ws-1", true));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toBe("bridge unavailable");
    expect(result.current.evidence).toMatchObject([
      {
        id: "governance:workspace-read",
        source: "workflow",
        status: "unknown",
        degraded: true,
        degradationReason: "governance-evidence-unavailable",
        updatedAt: "1970-01-01T00:00:00.000Z",
        title: "Governance evidence",
        summary: "Governance files could not be read: bridge unavailable",
        payload: {
          kind: "legacy-workspace-evidence",
        },
      },
    ]);
  });
});
