import { StrictMode, type ReactNode } from "react";

import type { WorkspaceInfo } from "../../../types";
import type { ProjectMemoryItem } from "../../../services/tauri/projectMemory";
import type { ProjectMapReadResponse } from "../services/projectMapPersistence";
import { createEmptyProjectMapDataset } from "../services/projectMapPersistence";
import type { ProjectMapCandidate, ProjectMapDataset } from "../types";

export function workspace(overrides: Pick<WorkspaceInfo, "id" | "name" | "path">): WorkspaceInfo {
  return {
    ...overrides,
    connected: true,
    settings: {} as WorkspaceInfo["settings"],
  };
}

export function emptyReadResponse(storageKey: string, storageDir: string): ProjectMapReadResponse {
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

export function strictModeWrapper({ children }: { children: ReactNode }) {
  return <StrictMode>{children}</StrictMode>;
}

export function datasetWithPromptNodes(input: {
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

export function datasetWithAutoIngestion(input: {
  workspace: WorkspaceInfo;
  storageKey: string;
  threshold?: number;
  interval?: number;
  lastCheckedAt?: string;
  engine?: string;
  model?: string;
}): ProjectMapDataset {
  const dataset = datasetWithPromptNodes(input);
  return {
    ...dataset,
    autoIngestionSettings: {
      ...dataset.autoIngestionSettings,
      enabled: true,
      engine: input.engine ?? dataset.autoIngestionSettings.engine,
      model: input.model ?? dataset.autoIngestionSettings.model,
      newSessionThreshold: input.threshold ?? 1,
      checkIntervalMinutes: input.interval ?? 5,
      applyMode: "createCandidate",
    },
    memoryCursor: {
      ...dataset.memoryCursor,
      lastCheckedAt: input.lastCheckedAt ?? "1970-01-01T00:00:00.000Z",
    },
  };
}

export function datasetWithUnassignedDiscovery(input: {
  workspace: WorkspaceInfo;
  storageKey: string;
}): ProjectMapDataset {
  const dataset = datasetWithPromptNodes(input);
  const generatedBy = {
    engine: "codex",
    model: "gpt-5.3-codex-spark",
    runId: "seed",
  };
  return {
    ...dataset,
    nodes: [
      ...dataset.nodes,
      {
        id: "unassigned-discoveries",
        lensId: "overview",
        nodeKind: "cross-cutting",
        title: "Unassigned Discoveries",
        summary: "Needs triage",
        detail: {
          coreDescription: "Needs triage",
          keyFacts: [],
          keyLogic: [],
          riskSignals: [],
          relatedArtifacts: [],
        },
        parentId: "project-core",
        children: ["risk-taxonomy-drift"],
        sources: [],
        confidence: "unknown",
        stale: false,
        candidate: false,
        lastGeneratedAt: "2026-05-26T01:00:00.000Z",
        generatedBy,
      },
      {
        id: "risk-taxonomy-drift",
        lensId: "overview",
        nodeKind: "risk",
        title: "Risk taxonomy drift",
        summary: "Risk node needs a structural parent",
        detail: {
          coreDescription: "Risk node needs a structural parent",
          keyFacts: [],
          keyLogic: [],
          riskSignals: [],
          relatedArtifacts: [],
        },
        parentId: "unassigned-discoveries",
        children: [],
        sources: [{ type: "file", label: "risk", path: "src/risk.ts" }],
        confidence: "low",
        stale: false,
        candidate: false,
        lastGeneratedAt: "2026-05-26T01:00:00.000Z",
        generatedBy,
      },
    ],
  };
}

export function projectMemory(overrides: Partial<ProjectMemoryItem> = {}): ProjectMemoryItem {
  return {
    id: "memory-1",
    workspaceId: "ws-spring",
    kind: "fact",
    title: "Project map memory",
    summary: "Project Map references src/features/project-map/types.ts",
    cleanText: "Project Map references src/features/project-map/types.ts",
    tags: [],
    importance: "medium",
    source: "conversation",
    fingerprint: "fp-1",
    createdAt: 1,
    updatedAt: 2,
    threadId: "session-1",
    ...overrides,
  };
}

export function reviewCandidate(overrides: Partial<ProjectMapCandidate> = {}): ProjectMapCandidate {
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
