// @vitest-environment jsdom
import { StrictMode, type ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { WorkspaceInfo } from "../../../types";
import { deriveProjectMapStorageKey } from "../utils/storageKey";
import type { ProjectMapReadResponse } from "../services/projectMapPersistence";
import type { ProjectMapCandidate, ProjectMapDataset } from "../types";
import {
  createEmptyProjectMapDataset,
  readProjectMapDataset,
  writeProjectMapDataset,
} from "../services/projectMapPersistence";
import { runProjectMapGenerationWorker } from "../services/projectMapGenerationWorker";
import {
  __resetProjectMapWorkerClaimsForTests,
  useProjectMapDataset,
} from "./useProjectMapDataset";

vi.mock("../services/projectMapPersistence", async () => {
  const actual = await vi.importActual<typeof import("../services/projectMapPersistence")>(
    "../services/projectMapPersistence",
  );
  return {
    ...actual,
    readProjectMapDataset: vi.fn(),
    writeProjectMapDataset: vi.fn(),
  };
});

vi.mock("../services/projectMapGenerationWorker", () => ({
  runProjectMapGenerationWorker: vi.fn(async ({ dataset }) => dataset),
}));

function workspace(overrides: Pick<WorkspaceInfo, "id" | "name" | "path">): WorkspaceInfo {
  return {
    ...overrides,
    connected: true,
    settings: {} as WorkspaceInfo["settings"],
  };
}

function emptyReadResponse(storageKey: string, storageDir: string): ProjectMapReadResponse {
  return {
    storageKey,
    storageDir,
    exists: false,
    lensNodes: {},
    candidates: {},
    evidence: {},
    runs: {},
  };
}

function strictModeWrapper({ children }: { children: ReactNode }) {
  return <StrictMode>{children}</StrictMode>;
}

function datasetWithPromptNodes(input: {
  workspace: WorkspaceInfo;
  storageKey: string;
}): ProjectMapDataset {
  const dataset = createEmptyProjectMapDataset({
    identity: {
      projectName: input.workspace.name,
      workspacePath: input.workspace.path,
      workspaceId: input.workspace.id,
    },
    storageKey: input.storageKey,
  });
  const generatedBy = {
    engine: "codex",
    model: "gpt-5.3-codex-spark",
    runId: "seed",
  };
  return {
    ...dataset,
    lenses: [
      {
        id: "overview",
        title: "Overview",
        shortTitle: "Overview",
        description: "Project overview",
        status: "detected",
        confidence: "medium",
        evidence: [{ type: "file", label: "README", path: "README.md" }],
      },
    ],
    nodes: [
      {
        id: "project-core",
        lensId: "overview",
        nodeKind: "concept",
        title: "Project Core",
        summary: "Root node",
        detail: {
          coreDescription: "Root node",
          keyFacts: [],
          keyLogic: [],
          riskSignals: [],
          relatedArtifacts: [],
        },
        children: ["runtime-node"],
        sources: [{ type: "file", label: "README", path: "README.md" }],
        confidence: "medium",
        stale: false,
        candidate: false,
        lastGeneratedAt: "2026-05-26T01:00:00.000Z",
        generatedBy,
      },
      {
        id: "runtime-node",
        lensId: "overview",
        nodeKind: "runtime",
        title: "Runtime Node",
        summary: "Runtime facts",
        detail: {
          coreDescription: "Runtime facts",
          keyFacts: [],
          keyLogic: [],
          riskSignals: [],
          relatedArtifacts: [{ type: "file", label: "Vite config", path: "vite.config.ts" }],
        },
        parentId: "project-core",
        children: [],
        sources: [{ type: "file", label: "package.json", path: "package.json" }],
        confidence: "low",
        stale: false,
        candidate: true,
        lastGeneratedAt: "2026-05-26T01:00:00.000Z",
        generatedBy,
      },
      {
        id: "unrelated-node",
        lensId: "overview",
        nodeKind: "quality",
        title: "Unrelated Node",
        summary: "Should not feed node prompts",
        detail: {
          coreDescription: "Unrelated",
          keyFacts: [],
          keyLogic: [],
          riskSignals: [],
          relatedArtifacts: [],
        },
        children: [],
        sources: [{ type: "file", label: "unrelated", path: "src/unrelated.ts" }],
        confidence: "medium",
        stale: false,
        candidate: false,
        lastGeneratedAt: "2026-05-26T01:00:00.000Z",
        generatedBy,
      },
    ],
  };
}

function reviewCandidate(overrides: Partial<ProjectMapCandidate> = {}): ProjectMapCandidate {
  return {
    id: "candidate-runtime",
    status: "pending",
    createdAt: "2026-05-26T01:00:00.000Z",
    updatedAt: "2026-05-26T01:00:00.000Z",
    source: "conversation",
    targetLensId: "overview",
    targetNodeId: "runtime-node",
    patch: {
      nodeId: "runtime-node",
      summary: "Confirmed runtime facts",
      confidence: "medium",
      candidate: false,
      sources: [{ type: "file", label: "package", path: "package.json" }],
    },
    evidence: [
      {
        id: "evidence-runtime",
        priority: "code",
        observedAt: "2026-05-26T01:00:00.000Z",
        observedHash: "hash-runtime",
        source: { type: "file", label: "package", path: "package.json" },
      },
    ],
    ...overrides,
  };
}

describe("useProjectMapDataset", () => {
  beforeEach(() => {
    __resetProjectMapWorkerClaimsForTests();
    vi.mocked(readProjectMapDataset).mockReset();
    vi.mocked(writeProjectMapDataset).mockReset();
    vi.mocked(runProjectMapGenerationWorker).mockReset();
    vi.mocked(runProjectMapGenerationWorker).mockImplementation(async ({ dataset }) => dataset);
  });

  it("clears the previous workspace storage key and ignores stale reads", async () => {
    const mossx = workspace({ id: "ws-mossx", name: "mossx", path: "/repo/mossx" });
    const spring = workspace({
      id: "ws-spring",
      name: "springboot-demo",
      path: "/repo/springboot-demo",
    });
    const mossxKey = deriveProjectMapStorageKey({
      projectName: mossx.name,
      workspacePath: mossx.path,
      workspaceId: mossx.id,
    });
    const springKey = deriveProjectMapStorageKey({
      projectName: spring.name,
      workspacePath: spring.path,
      workspaceId: spring.id,
    });
    const springResponse = {
      dataset: null,
      response: emptyReadResponse(springKey, `/repo/springboot-demo/.ccgui/project-map/${springKey}`),
    };
    let resolveMossxRead: (value: Awaited<ReturnType<typeof readProjectMapDataset>>) => void =
      () => {};

    vi.mocked(readProjectMapDataset).mockImplementation(({ storageMode, workspaceId }) => {
      if (workspaceId === "ws-mossx") {
        return new Promise((resolve) => {
          resolveMossxRead = (value) => resolve(value);
        });
      }
      if (storageMode === "project" || storageMode === "global") {
        return Promise.resolve(springResponse);
      }
      return Promise.resolve(springResponse);
    });

    const { result, rerender } = renderHook(
      ({ activeWorkspace }: { activeWorkspace: WorkspaceInfo }) =>
        useProjectMapDataset(activeWorkspace),
      { initialProps: { activeWorkspace: mossx } },
    );

    expect(result.current.dataset.manifest.storageKey).toBe(mossxKey);

    rerender({ activeWorkspace: spring });

    await waitFor(() => {
      expect(result.current.dataset.manifest.storageKey).toBe(springKey);
      expect(result.current.status).toBe("empty");
    });

    await act(async () => {
      resolveMossxRead({
        dataset: null,
        response: emptyReadResponse(mossxKey, `/repo/mossx/.ccgui/project-map/${mossxKey}`),
      });
    });

    expect(result.current.dataset.manifest.storageKey).toBe(springKey);
    expect(result.current.storageDir).toBe(`/repo/springboot-demo/.ccgui/project-map/${springKey}`);
  });

  it("defaults new requests to global storage even when project path dataset exists", async () => {
    const spring = workspace({
      id: "ws-spring",
      name: "springboot-demo",
      path: "/repo/springboot-demo",
    });
    const springKey = deriveProjectMapStorageKey({
      projectName: spring.name,
      workspacePath: spring.path,
      workspaceId: spring.id,
    });
    vi.mocked(readProjectMapDataset).mockResolvedValue({
      dataset: null,
      response: emptyReadResponse(springKey, `/home/user/.ccgui/project-map/${springKey}`),
    });

    const { result } = renderHook(() => useProjectMapDataset(spring));

    await waitFor(() => expect(result.current.status).toBe("empty"));

    expect(result.current.activeReadLocation).toBe("global");
    expect(readProjectMapDataset).toHaveBeenCalledWith(
      expect.objectContaining({ storageMode: "global" }),
    );

    act(() => {
      result.current.openGlobalCollection();
    });

    expect(result.current.pendingRequest).toMatchObject({
      storageLocation: "global",
      writePath: `/home/user/.ccgui/project-map/${springKey}`,
    });
  });

  it("uses the current app engine and model for a new empty project-map collection", async () => {
    const spring = workspace({
      id: "ws-spring",
      name: "springboot-demo",
      path: "/repo/springboot-demo",
    });
    const springKey = deriveProjectMapStorageKey({
      projectName: spring.name,
      workspacePath: spring.path,
      workspaceId: spring.id,
    });
    vi.mocked(readProjectMapDataset).mockResolvedValue({
      dataset: null,
      response: emptyReadResponse(springKey, `/home/user/.ccgui/project-map/${springKey}`),
    });

    const { result } = renderHook(() =>
      useProjectMapDataset(spring, {
        generationDefaults: {
          engine: "claude",
          model: "mimo-v2.5-pro[1M]",
        },
      }),
    );

    await waitFor(() => expect(result.current.status).toBe("empty"));

    act(() => {
      result.current.openGlobalCollection();
    });

    expect(result.current.pendingRequest).toMatchObject({
      engine: "claude",
      model: "mimo-v2.5-pro[1M]",
      generationIntent: "global",
      storageLocation: "global",
      writePath: `/home/user/.ccgui/project-map/${springKey}`,
    });
  });

  it("creates action-specific node requests from the selected node instead of global evidence", async () => {
    const spring = workspace({
      id: "ws-spring",
      name: "springboot-demo",
      path: "/repo/springboot-demo",
    });
    const springKey = deriveProjectMapStorageKey({
      projectName: spring.name,
      workspacePath: spring.path,
      workspaceId: spring.id,
    });
    const dataset = datasetWithPromptNodes({ workspace: spring, storageKey: springKey });
    vi.mocked(readProjectMapDataset).mockResolvedValue({
      dataset,
      response: {
        ...emptyReadResponse(springKey, `/home/user/.ccgui/project-map/${springKey}`),
        exists: true,
      },
    });

    const { result } = renderHook(() => useProjectMapDataset(spring));

    await waitFor(() => expect(result.current.status).toBe("persisted"));

    const runtimeNode = dataset.nodes.find((node) => node.id === "runtime-node");
    expect(runtimeNode).toBeTruthy();

    act(() => {
      result.current.openNodeGeneration("node", runtimeNode!);
    });

    expect(result.current.pendingRequest).toMatchObject({
      kind: "node",
      generationIntent: "completeNode",
      scope: { kind: "node", nodeId: "runtime-node", includeDescendants: true },
    });
    expect(result.current.pendingRequest?.readSources.map((source) => source.path)).toEqual([
      "package.json",
      "vite.config.ts",
    ]);

    act(() => {
      result.current.openNodeGeneration("calibrate", runtimeNode!);
    });

    expect(result.current.pendingRequest).toMatchObject({
      kind: "node",
      generationIntent: "calibrateNode",
      scope: { kind: "node", nodeId: "runtime-node", includeDescendants: false },
    });
    expect(result.current.pendingRequest?.readSources.map((source) => source.path)).not.toContain(
      "src/unrelated.ts",
    );
  });

  it("confirms a pending candidate through the evidence gate and persists the patched dataset", async () => {
    const spring = workspace({
      id: "ws-spring",
      name: "springboot-demo",
      path: "/repo/springboot-demo",
    });
    const springKey = deriveProjectMapStorageKey({
      projectName: spring.name,
      workspacePath: spring.path,
      workspaceId: spring.id,
    });
    const dataset = {
      ...datasetWithPromptNodes({ workspace: spring, storageKey: springKey }),
      candidates: [reviewCandidate()],
      evidenceRecords: [],
    };
    vi.mocked(readProjectMapDataset).mockResolvedValue({
      dataset,
      response: {
        ...emptyReadResponse(springKey, `/home/user/.ccgui/project-map/${springKey}`),
        exists: true,
      },
    });
    vi.mocked(writeProjectMapDataset).mockResolvedValue(undefined);

    const { result } = renderHook(() => useProjectMapDataset(spring));

    await waitFor(() => expect(result.current.status).toBe("persisted"));

    await act(async () => {
      await result.current.confirmCandidate("candidate-runtime");
    });

    expect(result.current.error).toBeNull();
    expect(result.current.dataset.nodes.find((node) => node.id === "runtime-node")).toMatchObject({
      summary: "Confirmed runtime facts",
      confidence: "medium",
      candidate: false,
    });
    expect(result.current.dataset.candidates?.[0]).toMatchObject({ status: "confirmed" });
    expect(result.current.dataset.evidenceRecords).toHaveLength(1);
    expect(writeProjectMapDataset).toHaveBeenCalledWith(
      expect.objectContaining({
        dataset: expect.objectContaining({
          candidates: [expect.objectContaining({ status: "confirmed" })],
        }),
      }),
    );
  });

  it("keeps the active node unchanged and shows an error when candidate confirmation fails", async () => {
    const spring = workspace({
      id: "ws-spring",
      name: "springboot-demo",
      path: "/repo/springboot-demo",
    });
    const springKey = deriveProjectMapStorageKey({
      projectName: spring.name,
      workspacePath: spring.path,
      workspaceId: spring.id,
    });
    const dataset = {
      ...datasetWithPromptNodes({ workspace: spring, storageKey: springKey }),
      candidates: [
        reviewCandidate({
          patch: {
            nodeId: "runtime-node",
            confidence: "high",
            sources: [],
          },
        }),
      ],
    };
    vi.mocked(readProjectMapDataset).mockResolvedValue({
      dataset,
      response: {
        ...emptyReadResponse(springKey, `/home/user/.ccgui/project-map/${springKey}`),
        exists: true,
      },
    });

    const { result } = renderHook(() => useProjectMapDataset(spring));

    await waitFor(() => expect(result.current.status).toBe("persisted"));

    await act(async () => {
      await result.current.confirmCandidate("candidate-runtime");
    });

    expect(result.current.error).toContain(
      "Confirmed project-map node claims require at least one source.",
    );
    expect(result.current.dataset.nodes.find((node) => node.id === "runtime-node")?.summary).toBe(
      "Runtime facts",
    );
    expect(result.current.dataset.candidates?.[0]).toMatchObject({ status: "pending" });
    expect(writeProjectMapDataset).not.toHaveBeenCalled();
  });

  it("rejects a pending candidate without changing the active node", async () => {
    const spring = workspace({
      id: "ws-spring",
      name: "springboot-demo",
      path: "/repo/springboot-demo",
    });
    const springKey = deriveProjectMapStorageKey({
      projectName: spring.name,
      workspacePath: spring.path,
      workspaceId: spring.id,
    });
    const dataset = {
      ...datasetWithPromptNodes({ workspace: spring, storageKey: springKey }),
      candidates: [reviewCandidate()],
    };
    vi.mocked(readProjectMapDataset).mockResolvedValue({
      dataset,
      response: {
        ...emptyReadResponse(springKey, `/home/user/.ccgui/project-map/${springKey}`),
        exists: true,
      },
    });
    vi.mocked(writeProjectMapDataset).mockResolvedValue(undefined);

    const { result } = renderHook(() => useProjectMapDataset(spring));

    await waitFor(() => expect(result.current.status).toBe("persisted"));

    await act(async () => {
      await result.current.rejectCandidate("candidate-runtime");
    });

    expect(result.current.dataset.candidates?.[0]).toMatchObject({ status: "rejected" });
    expect(result.current.dataset.nodes.find((node) => node.id === "runtime-node")?.summary).toBe(
      "Runtime facts",
    );
  });

  it("switches the panel read location without changing the global write default", async () => {
    const spring = workspace({
      id: "ws-spring",
      name: "springboot-demo",
      path: "/repo/springboot-demo",
    });
    const springKey = deriveProjectMapStorageKey({
      projectName: spring.name,
      workspacePath: spring.path,
      workspaceId: spring.id,
    });
    const globalDir = `/home/user/.ccgui/project-map/${springKey}`;
    const projectDir = `/repo/springboot-demo/.ccgui/project-map/${springKey}`;

    vi.mocked(readProjectMapDataset).mockImplementation(({ storageMode }) =>
      Promise.resolve({
        dataset: null,
        response: emptyReadResponse(springKey, storageMode === "project" ? projectDir : globalDir),
      }),
    );

    const { result } = renderHook(() => useProjectMapDataset(spring));

    await waitFor(() => {
      expect(result.current.status).toBe("empty");
      expect(result.current.activeReadLocation).toBe("global");
      expect(result.current.storageDir).toBe(globalDir);
    });

    act(() => {
      result.current.switchReadLocation("project");
    });

    await waitFor(() => {
      expect(result.current.status).toBe("empty");
      expect(result.current.activeReadLocation).toBe("project");
      expect(result.current.storageDir).toBe(projectDir);
    });
    expect(readProjectMapDataset).toHaveBeenLastCalledWith(
      expect.objectContaining({ storageMode: "project" }),
    );

    act(() => {
      result.current.openGlobalCollection();
    });

    expect(result.current.pendingRequest).toMatchObject({
      storageLocation: "global",
      writePath: globalDir,
    });
  });

  it("does not switch the panel read location after confirming a project-local write", async () => {
    const spring = workspace({
      id: "ws-spring",
      name: "springboot-demo",
      path: "/repo/springboot-demo",
    });
    const springKey = deriveProjectMapStorageKey({
      projectName: spring.name,
      workspacePath: spring.path,
      workspaceId: spring.id,
    });
    const globalDir = `/home/user/.ccgui/project-map/${springKey}`;
    const projectDir = `/repo/springboot-demo/.ccgui/project-map/${springKey}`;
    vi.mocked(readProjectMapDataset).mockResolvedValue({
      dataset: null,
      response: emptyReadResponse(springKey, globalDir),
    });
    vi.mocked(writeProjectMapDataset).mockResolvedValue(undefined);

    const { result } = renderHook(() => useProjectMapDataset(spring));

    await waitFor(() => expect(result.current.status).toBe("empty"));

    act(() => {
      result.current.openGlobalCollection();
    });

    const request = result.current.pendingRequest;
    expect(request).not.toBeNull();

    await act(async () => {
      await result.current.confirmGenerationRequest({
        ...request!,
        storageLocation: "project",
        writePath: projectDir,
      });
    });

    expect(writeProjectMapDataset).toHaveBeenCalledWith(
      expect.objectContaining({ storageLocation: "project" }),
    );
    expect(result.current.activeReadLocation).toBe("global");
  });

  it("keeps persisted project data isolated from the default global read location", async () => {
    const spring = workspace({
      id: "ws-spring",
      name: "springboot-demo",
      path: "/repo/springboot-demo",
    });
    const springKey = deriveProjectMapStorageKey({
      projectName: spring.name,
      workspacePath: spring.path,
      workspaceId: spring.id,
    });
    const globalDir = `/home/user/.ccgui/project-map/${springKey}`;
    const projectDir = `/repo/springboot-demo/.ccgui/project-map/${springKey}`;
    const projectDataset = createEmptyProjectMapDataset({
      identity: {
        projectName: spring.name,
        workspacePath: spring.path,
        workspaceId: spring.id,
      },
      storageKey: springKey,
    });

    vi.mocked(readProjectMapDataset).mockImplementation(({ storageMode }) =>
      Promise.resolve({
        dataset: storageMode === "project" ? projectDataset : null,
        response: {
          ...emptyReadResponse(springKey, storageMode === "project" ? projectDir : globalDir),
          exists: storageMode === "project",
        },
      }),
    );

    const { result } = renderHook(() => useProjectMapDataset(spring));

    await waitFor(() => {
      expect(result.current.status).toBe("empty");
      expect(result.current.activeReadLocation).toBe("global");
      expect(result.current.storageDir).toBe(globalDir);
    });

    act(() => {
      result.current.switchReadLocation("project");
    });

    await waitFor(() => {
      expect(result.current.status).toBe("persisted");
      expect(result.current.activeReadLocation).toBe("project");
      expect(result.current.storageDir).toBe(projectDir);
    });
  });

  it("normalizes Windows-style project paths and still defaults to global write location", async () => {
    const spring = workspace({
      id: "ws-spring-win",
      name: "springboot-demo",
      path: "C:\\repo\\springboot-demo",
    });
    const springKey = deriveProjectMapStorageKey({
      projectName: spring.name,
      workspacePath: spring.path,
      workspaceId: spring.id,
    });
    vi.mocked(readProjectMapDataset).mockResolvedValue({
      dataset: null,
      response: emptyReadResponse(
        springKey,
        `C:\\repo\\springboot-demo\\.ccgui\\project-map\\${springKey}`,
      ),
    });

    const { result } = renderHook(() => useProjectMapDataset(spring));

    await waitFor(() => expect(result.current.status).toBe("empty"));

    act(() => {
      result.current.openGlobalCollection();
    });

    expect(result.current.pendingRequest).toMatchObject({
      storageLocation: "global",
      writePath: `.ccgui/project-map/${springKey}`,
    });
  });

  it("keeps a confirmed generation request visible until the queued run is persisted", async () => {
    const spring = workspace({
      id: "ws-spring",
      name: "springboot-demo",
      path: "/repo/springboot-demo",
    });
    const springKey = deriveProjectMapStorageKey({
      projectName: spring.name,
      workspacePath: spring.path,
      workspaceId: spring.id,
    });
    vi.mocked(readProjectMapDataset).mockResolvedValue({
      dataset: null,
      response: emptyReadResponse(springKey, `/repo/springboot-demo/.ccgui/project-map/${springKey}`),
    });
    vi.mocked(writeProjectMapDataset).mockImplementationOnce(() => new Promise(() => {}));

    const { result } = renderHook(() => useProjectMapDataset(spring));

    await waitFor(() => expect(result.current.status).toBe("empty"));

    act(() => {
      result.current.openGlobalCollection();
    });

    const request = result.current.pendingRequest;
    expect(request).not.toBeNull();

    act(() => {
      void result.current.confirmGenerationRequest({
        ...request!,
        engine: "codex",
        model: "gpt-5.3-codex-spark",
      });
    });

    expect(result.current.pendingRequest).toMatchObject({ id: request!.id });
    expect(result.current.dataset.runs).toEqual([]);
    expect(writeProjectMapDataset).toHaveBeenCalledTimes(1);
    expect(runProjectMapGenerationWorker).not.toHaveBeenCalled();
  });

  it("keeps the pending request when the initial queued run cannot be persisted", async () => {
    const spring = workspace({
      id: "ws-spring",
      name: "springboot-demo",
      path: "/repo/springboot-demo",
    });
    const springKey = deriveProjectMapStorageKey({
      projectName: spring.name,
      workspacePath: spring.path,
      workspaceId: spring.id,
    });
    vi.mocked(readProjectMapDataset).mockResolvedValue({
      dataset: null,
      response: emptyReadResponse(springKey, `/repo/springboot-demo/.ccgui/project-map/${springKey}`),
    });
    vi.mocked(writeProjectMapDataset).mockRejectedValueOnce(new Error("write failed"));

    const { result } = renderHook(() => useProjectMapDataset(spring));

    await waitFor(() => expect(result.current.status).toBe("empty"));

    act(() => {
      result.current.openGlobalCollection();
    });

    const request = result.current.pendingRequest;
    expect(request).not.toBeNull();

    act(() => {
      void result.current.confirmGenerationRequest(request!);
    });

    await waitFor(() => {
      expect(result.current.pendingRequest).toMatchObject({ id: request!.id });
      expect(result.current.error).toBe("write failed");
    });
    expect(result.current.dataset.runs).toEqual([]);
    expect(runProjectMapGenerationWorker).not.toHaveBeenCalled();
  });

  it("marks a generation run failed when the worker cannot persist its claimed slot", async () => {
    const spring = workspace({
      id: "ws-spring",
      name: "springboot-demo",
      path: "/repo/springboot-demo",
    });
    const springKey = deriveProjectMapStorageKey({
      projectName: spring.name,
      workspacePath: spring.path,
      workspaceId: spring.id,
    });
    vi.mocked(readProjectMapDataset).mockResolvedValue({
      dataset: null,
      response: emptyReadResponse(springKey, `/repo/springboot-demo/.ccgui/project-map/${springKey}`),
    });
    vi.mocked(writeProjectMapDataset)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("claim failed"))
      .mockResolvedValue(undefined);

    const { result } = renderHook(() => useProjectMapDataset(spring));

    await waitFor(() => expect(result.current.status).toBe("empty"));

    act(() => {
      result.current.openGlobalCollection();
    });

    const request = result.current.pendingRequest;
    expect(request).not.toBeNull();

    await act(async () => {
      await result.current.confirmGenerationRequest(request!);
    });

    await waitFor(() => {
      expect(result.current.pendingRequest).toBeNull();
      expect(result.current.error).toBe("claim failed");
      expect(result.current.dataset.runs[0]).toMatchObject({
        id: request!.id,
        status: "failed",
        error: "claim failed",
      });
    });
  });

  it("claims a queued generation run under StrictMode and completes it", async () => {
    const spring = workspace({
      id: "ws-spring",
      name: "springboot-demo",
      path: "/repo/springboot-demo",
    });
    const springKey = deriveProjectMapStorageKey({
      projectName: spring.name,
      workspacePath: spring.path,
      workspaceId: spring.id,
    });
    vi.mocked(readProjectMapDataset).mockResolvedValue({
      dataset: null,
      response: emptyReadResponse(springKey, `/repo/springboot-demo/.ccgui/project-map/${springKey}`),
    });
    vi.mocked(writeProjectMapDataset).mockResolvedValue(undefined);

    const { result } = renderHook(() => useProjectMapDataset(spring), {
      wrapper: strictModeWrapper,
    });

    await waitFor(() => expect(result.current.status).toBe("empty"));

    act(() => {
      result.current.openGlobalCollection();
    });

    const request = result.current.pendingRequest;
    expect(request).not.toBeNull();

    await act(async () => {
      await result.current.confirmGenerationRequest({
        ...request!,
        engine: "codex",
        model: "gpt-5.3-codex-spark",
      });
    });

    await waitFor(() => {
      expect(runProjectMapGenerationWorker).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(result.current.dataset.runs[0]).toMatchObject({
        id: request!.id,
        status: "completed",
        phase: "completed",
      });
    });
    expect(writeProjectMapDataset).toHaveBeenCalledWith(
      expect.objectContaining({
        dataset: expect.objectContaining({
          runs: expect.arrayContaining([
            expect.objectContaining({
              id: request!.id,
              status: "running",
              phase: "preparingSources",
            }),
          ]),
        }),
      }),
    );
  });

  it("does not duplicate an in-flight generation run after remount", async () => {
    const spring = workspace({
      id: "ws-spring",
      name: "springboot-demo",
      path: "/repo/springboot-demo",
    });
    const springKey = deriveProjectMapStorageKey({
      projectName: spring.name,
      workspacePath: spring.path,
      workspaceId: spring.id,
    });
    const persistedDataset = createEmptyProjectMapDataset({
      identity: {
        projectName: spring.name,
        workspacePath: spring.path,
        workspaceId: spring.id,
      },
      storageKey: springKey,
    });
    const datasetWithRunningRun = {
      ...persistedDataset,
      runs: [
        {
          id: "active-run",
          kind: "global" as const,
          status: "running" as const,
          phase: "askingAi" as const,
          engine: "codex" as const,
          model: "gpt-5.3-codex-spark",
          startedAt: "2026-05-26T01:55:00.000Z",
          completedAt: null,
          scope: "global" as const,
        },
      ],
    };
    vi.mocked(readProjectMapDataset).mockResolvedValue({
      dataset: datasetWithRunningRun,
      response: {
        ...emptyReadResponse(springKey, `/repo/springboot-demo/.ccgui/project-map/${springKey}`),
        exists: true,
      },
    });
    vi.mocked(writeProjectMapDataset).mockResolvedValue(undefined);
    vi.mocked(runProjectMapGenerationWorker).mockImplementation(() => new Promise(() => {}));

    const firstRender = renderHook(() => useProjectMapDataset(spring));

    await waitFor(() => expect(runProjectMapGenerationWorker).toHaveBeenCalledTimes(1));
    firstRender.unmount();

    renderHook(() => useProjectMapDataset(spring));

    await waitFor(() => expect(readProjectMapDataset).toHaveBeenCalledTimes(2));
    expect(runProjectMapGenerationWorker).toHaveBeenCalledTimes(1);
  });

  it("cancels pending runs and clears finished run history", async () => {
    const spring = workspace({
      id: "ws-spring",
      name: "springboot-demo",
      path: "/repo/springboot-demo",
    });
    const springKey = deriveProjectMapStorageKey({
      projectName: spring.name,
      workspacePath: spring.path,
      workspaceId: spring.id,
    });
    vi.mocked(readProjectMapDataset).mockResolvedValue({
      dataset: null,
      response: emptyReadResponse(springKey, `/repo/springboot-demo/.ccgui/project-map/${springKey}`),
    });
    vi.mocked(writeProjectMapDataset).mockResolvedValue(undefined);
    vi.mocked(runProjectMapGenerationWorker).mockImplementation(() => new Promise(() => {}));

    const { result } = renderHook(() => useProjectMapDataset(spring));

    await waitFor(() => expect(result.current.status).toBe("empty"));

    await act(async () => {
      await result.current.updateDataset((current) => ({
        ...current,
        runs: [
          {
            id: "active-run",
            kind: "global",
            status: "running",
            phase: "askingAi",
            engine: "codex",
            model: "gpt-5.3-codex-spark",
            startedAt: "2026-05-26T01:55:00.000Z",
            completedAt: null,
            scope: "global",
          },
          {
            id: "queued-run",
            kind: "global",
            status: "pending",
            engine: "codex",
            model: "gpt-5.3-codex-spark",
            startedAt: "2026-05-26T02:00:00.000Z",
            completedAt: null,
            scope: "global",
          },
          {
            id: "done-run",
            kind: "global",
            status: "completed",
            engine: "codex",
            model: "gpt-5.3-codex-spark",
            startedAt: "2026-05-26T01:00:00.000Z",
            completedAt: "2026-05-26T01:01:00.000Z",
            scope: "global",
          },
        ],
      }));
    });

    await act(async () => {
      await result.current.cancelGenerationRun("queued-run");
    });

    expect(result.current.dataset.runs.find((run) => run.id === "queued-run")).toMatchObject({
      status: "cancelled",
    });

    await act(async () => {
      await result.current.clearFinishedRuns();
    });

    expect(result.current.dataset.runs.map((run) => run.id)).toEqual(["active-run"]);
  });

  it("cancels a running generation run from the active slot", async () => {
    const spring = workspace({
      id: "ws-spring",
      name: "springboot-demo",
      path: "/repo/springboot-demo",
    });
    const springKey = deriveProjectMapStorageKey({
      projectName: spring.name,
      workspacePath: spring.path,
      workspaceId: spring.id,
    });
    vi.mocked(readProjectMapDataset).mockResolvedValue({
      dataset: null,
      response: emptyReadResponse(springKey, `/repo/springboot-demo/.ccgui/project-map/${springKey}`),
    });
    vi.mocked(writeProjectMapDataset).mockResolvedValue(undefined);
    let resolveWorker: (() => void) | null = null;
    vi.mocked(runProjectMapGenerationWorker).mockImplementation(
      ({ dataset }) =>
        new Promise((resolve) => {
          resolveWorker = () => resolve(dataset);
        }),
    );

    const { result } = renderHook(() => useProjectMapDataset(spring));

    await waitFor(() => expect(result.current.status).toBe("empty"));

    await act(async () => {
      await result.current.updateDataset((current) => ({
        ...current,
        runs: [
          {
            id: "active-run",
            kind: "global",
            status: "running",
            phase: "askingAi",
            engine: "codex",
            model: "gpt-5.3-codex-spark",
            startedAt: "2026-05-26T01:55:00.000Z",
            completedAt: null,
            scope: "global",
          },
        ],
      }));
    });

    await act(async () => {
      await result.current.cancelGenerationRun("active-run");
    });

    expect(result.current.dataset.runs.find((run) => run.id === "active-run")).toMatchObject({
      status: "cancelled",
      phase: "cancelled",
      progress: 100,
    });

    await waitFor(() => expect(runProjectMapGenerationWorker).toHaveBeenCalledTimes(1));

    await act(async () => {
      resolveWorker?.();
      await Promise.resolve();
    });

    expect(result.current.dataset.runs.find((run) => run.id === "active-run")).toMatchObject({
      status: "cancelled",
      phase: "cancelled",
    });
  });
});
