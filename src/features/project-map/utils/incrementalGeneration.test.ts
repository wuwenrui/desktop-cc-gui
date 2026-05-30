import { describe, expect, it } from "vitest";

import { mockProjectMapData } from "../mockProjectMapData";
import type { ProjectMapDataset, ProjectMapNode, ProjectMapProfile, ProjectMapRunMetadata } from "../types";
import {
  deriveProjectMapNodeRole,
  mergeProjectMapGenerationResult,
  PROJECT_MAP_UNASSIGNED_DISCOVERIES_NODE_ID,
  pruneProjectMapNode,
} from "./incrementalGeneration";

const generatedBy = {
  engine: "claude",
  model: "claude-sonnet",
  runId: "run-1",
};

function run(scope: ProjectMapRunMetadata["requestScope"]): ProjectMapRunMetadata {
  return {
    id: "run-1",
    kind: scope?.kind === "node" ? "node" : "global",
    status: "running",
    engine: "claude",
    model: "claude-sonnet",
    startedAt: "2026-05-26T10:00:00.000Z",
    completedAt: null,
    scope: scope?.kind ?? "global",
    requestScope: scope,
  };
}

function nodePatch(node: ProjectMapNode, patch: Partial<ProjectMapNode>): ProjectMapNode {
  return {
    ...node,
    ...patch,
    detail: {
      ...node.detail,
      ...(patch.detail ?? {}),
    },
    generatedBy,
    lastGeneratedAt: "2026-05-26T10:00:00.000Z",
  };
}

describe("project map incremental generation", () => {
  it("derives structural roles from generic project architecture language", () => {
    const baseNode = mockProjectMapData.nodes[0]!;
    const cases: Array<[Partial<ProjectMapNode>, ReturnType<typeof deriveProjectMapNodeRole>]> = [
      [
        {
          id: "workspace-overview",
          nodeKind: "project",
          title: "Inventory Service",
          summary: "Backend API service workspace overview.",
        },
        "root",
      ],
      [
        {
          id: "frontend-app",
          nodeKind: "module",
          title: "Frontend Application Layer",
          summary: "React app module that owns user-facing features.",
          children: ["messages-module"],
        },
        "structural",
      ],
      [
        {
          id: "engine-system",
          nodeKind: "module",
          title: "AI Engine System",
          summary: "Provider orchestration subsystem.",
          children: ["provider-adapter"],
        },
        "structural",
      ],
      [
        {
          id: "login-controller",
          nodeKind: "controller module",
          title: "LoginController",
          summary: "Concrete Spring controller class.",
        },
        "artifact",
      ],
      [
        {
          id: "parser-test",
          nodeKind: "test module",
          title: "Parser Unit Tests",
          summary: "Unit test coverage for parser edge cases.",
        },
        "task",
      ],
    ];

    for (const [patch, expectedRole] of cases) {
      expect(deriveProjectMapNodeRole(nodePatch(baseNode, patch))).toBe(expectedRole);
    }
  });

  it("preserves existing nodes omitted from repeated global generation", () => {
    const riskNode = mockProjectMapData.nodes.find((node) => node.id === "hub-risk")!;
    const generatedRoot = nodePatch(mockProjectMapData.nodes[0]!, {
      summary: "Updated root summary",
      sources: [{ type: "file", label: "README", path: "README.md" }],
    });
    const generatedNewNode = nodePatch(riskNode, {
      id: "new-auth-node",
      title: "Auth Node",
      parentId: "project-core",
      children: [],
      sources: [{ type: "file", label: "auth", path: "src/auth.ts" }],
    });
    const scope: ProjectMapRunMetadata["requestScope"] = { kind: "global", lensIds: [] };

    const merged = mergeProjectMapGenerationResult({
      dataset: mockProjectMapData,
      profile: {
        ...mockProjectMapData.profile,
        primaryLanguage: "typescript",
        buildSystems: ["vite"],
      },
      lenses: [],
      nodes: [generatedRoot, generatedNewNode],
      scope,
      run: run(scope),
    });

    expect(merged.nodes.some((node) => node.id === "hub-risk")).toBe(true);
    expect(merged.nodes.some((node) => node.id === "new-auth-node")).toBe(true);
    expect(merged.nodes.find((node) => node.id === "project-core")?.summary).toBe("Updated root summary");
    expect(merged.profile.buildSystems).toContain("vite");
  });

  it("groups auto-ingestion task-like orphans under unassigned discoveries", () => {
    const generatedAutoNode = nodePatch(mockProjectMapData.nodes[0]!, {
      id: "auto-memory-claim",
      title: "Auto Memory Claim",
      nodeKind: "bugfix",
      parentId: undefined,
      children: [],
      candidate: true,
      sources: [{ type: "conversation", label: "memory", path: "src/memory.ts" }],
    });
    const scope: ProjectMapRunMetadata["requestScope"] = {
      kind: "auto",
      messageHashes: ["hash-1"],
    };

    const merged = mergeProjectMapGenerationResult({
      dataset: mockProjectMapData,
      profile: mockProjectMapData.profile,
      lenses: mockProjectMapData.lenses,
      nodes: [generatedAutoNode],
      scope,
      run: run(scope),
    });

    expect(merged.nodes.find((node) => node.id === "auto-memory-claim")).toMatchObject({
      parentId: PROJECT_MAP_UNASSIGNED_DISCOVERIES_NODE_ID,
    });
    expect(merged.nodes.find((node) => node.id === "project-core")?.children).not.toContain(
      "auto-memory-claim",
    );
    expect(merged.nodes.find((node) => node.id === PROJECT_MAP_UNASSIGNED_DISCOVERIES_NODE_ID)).toMatchObject({
      parentId: "project-core",
    });
    expect(merged.nodes.find((node) => node.id === PROJECT_MAP_UNASSIGNED_DISCOVERIES_NODE_ID)?.children).toContain(
      "auto-memory-claim",
    );
  });

  it("keeps auto-ingestion structural orphans reachable from the project root", () => {
    const generatedAutoNode = nodePatch(mockProjectMapData.nodes[0]!, {
      id: "auto-runtime-module",
      title: "Runtime Subsystem Module",
      nodeKind: "module",
      summary: "Runtime subsystem for launch and process orchestration.",
      parentId: undefined,
      children: [],
      candidate: true,
      sources: [{ type: "file", label: "runtime", path: "src/runtime.ts" }],
    });
    const scope: ProjectMapRunMetadata["requestScope"] = {
      kind: "auto",
      messageHashes: ["hash-1"],
    };

    const merged = mergeProjectMapGenerationResult({
      dataset: mockProjectMapData,
      profile: mockProjectMapData.profile,
      lenses: mockProjectMapData.lenses,
      nodes: [generatedAutoNode],
      scope,
      run: run(scope),
    });

    expect(merged.nodes.find((node) => node.id === "auto-runtime-module")).toMatchObject({
      parentId: "project-core",
    });
    expect(merged.nodes.find((node) => node.id === "project-core")?.children).toContain(
      "auto-runtime-module",
    );
  });

  it("groups concrete generated Java module leaves under unassigned discoveries", () => {
    const generatedControllerNode = nodePatch(mockProjectMapData.nodes[0]!, {
      id: "app-login-controller",
      title: "AppLoginController",
      nodeKind: "控制器 MODULE",
      summary: "Concrete Spring controller class.",
      parentId: "project-core",
      children: [],
      candidate: true,
      sources: [{ type: "file", label: "AppLoginController.java", path: "src/main/java/AppLoginController.java" }],
    });
    const scope: ProjectMapRunMetadata["requestScope"] = {
      kind: "auto",
      messageHashes: ["hash-1"],
    };

    const merged = mergeProjectMapGenerationResult({
      dataset: mockProjectMapData,
      profile: mockProjectMapData.profile,
      lenses: mockProjectMapData.lenses,
      nodes: [generatedControllerNode],
      scope,
      run: run(scope),
    });

    expect(merged.nodes.find((node) => node.id === "app-login-controller")).toMatchObject({
      parentId: PROJECT_MAP_UNASSIGNED_DISCOVERIES_NODE_ID,
    });
    expect(merged.nodes.find((node) => node.id === "project-core")?.children).not.toContain(
      "app-login-controller",
    );
  });

  it("deduplicates historical repeated node ids while preserving connected topology", () => {
    const connectedNode = mockProjectMapData.nodes.find((node) => node.id === "module-frontend")!;
    const duplicateNode = nodePatch(connectedNode, {
      lensId: "overview",
      parentId: undefined,
      children: [],
      detail: {
        ...connectedNode.detail,
        keyFacts: ["Duplicate copy has additional source-backed detail."],
        relatedArtifacts: [
          {
            type: "file",
            label: "duplicate",
            path: "src/features/project-map/duplicate.ts",
          },
        ],
      },
      sources: [
        {
          type: "file",
          label: "duplicate",
          path: "src/features/project-map/duplicate.ts",
        },
      ],
    });
    const dataset: ProjectMapDataset = {
      ...mockProjectMapData,
      nodes: [...mockProjectMapData.nodes, duplicateNode],
    };
    const scope: ProjectMapRunMetadata["requestScope"] = { kind: "global", lensIds: [] };

    const merged = mergeProjectMapGenerationResult({
      dataset,
      profile: dataset.profile,
      lenses: dataset.lenses,
      nodes: [],
      scope,
      run: run(scope),
    });

    const frontendNodes = merged.nodes.filter((node) => node.id === "module-frontend");
    const mergedNode = frontendNodes[0];

    expect(frontendNodes).toHaveLength(1);
    expect(mergedNode).toMatchObject({
      parentId: "hub-modules",
      generatedBy: {
        runId: "run-1",
      },
    });
    expect(mergedNode?.detail.keyFacts).toContain(
      "Duplicate copy has additional source-backed detail.",
    );
    expect(merged.nodes.find((node) => node.id === "hub-modules")?.children).toContain(
      "module-frontend",
    );
  });

  it("scopes node completion to the selected node and source-backed children", () => {
    const target = mockProjectMapData.nodes.find((node) => node.id === "hub-api")!;
    const unrelatedBefore = mockProjectMapData.nodes.find((node) => node.id === "hub-risk")!;
    const generatedTarget = nodePatch(target, {
      summary: "API surface enriched.",
      sources: [{ type: "file", label: "controller", path: "src/controller.ts" }],
    });
    const generatedChild = nodePatch(target, {
      id: "api-login-endpoint",
      title: "Login endpoint",
      parentId: "hub-api",
      children: [],
      sources: [{ type: "file", label: "controller", path: "src/controller.ts" }],
    });
    const generatedUnrelated = nodePatch(unrelatedBefore, {
      summary: "Should be ignored",
      sources: [{ type: "file", label: "risk", path: "src/risk.ts" }],
    });
    const scope = { kind: "node", nodeId: "hub-api", includeDescendants: true } as const;

    const merged = mergeProjectMapGenerationResult({
      dataset: mockProjectMapData,
      profile: mockProjectMapData.profile,
      lenses: mockProjectMapData.lenses,
      nodes: [generatedTarget, generatedChild, generatedUnrelated],
      scope,
      run: run(scope),
    });

    expect(merged.nodes.find((node) => node.id === "hub-api")?.summary).toBe("API surface enriched.");
    expect(merged.nodes.some((node) => node.id === "api-login-endpoint")).toBe(true);
    expect(merged.nodes.find((node) => node.id === "hub-risk")?.summary).toBe(unrelatedBefore.summary);
  });

  it("dedupes malformed historical artifacts without assuming labels exist", () => {
    const target = mockProjectMapData.nodes.find((node) => node.id === "hub-api")!;
    const artifactWithoutLabel = JSON.parse(
      '{"type":"file","path":"src/runtime.ts"}',
    ) as ProjectMapNode["detail"]["relatedArtifacts"][number];
    const legacyStringArtifact = JSON.parse(
      '"org.springframework.cloud:spring-cloud-starter-gateway"',
    ) as ProjectMapNode["detail"]["relatedArtifacts"][number];
    const dataset: ProjectMapDataset = {
      ...mockProjectMapData,
      nodes: mockProjectMapData.nodes.map((node) =>
        node.id === target.id
          ? {
              ...node,
              detail: {
                ...node.detail,
                relatedArtifacts: [artifactWithoutLabel, legacyStringArtifact],
              },
            }
          : node,
      ),
    };
    const scope = { kind: "node", nodeId: "hub-api", includeDescendants: false } as const;

    const merged = mergeProjectMapGenerationResult({
      dataset,
      profile: dataset.profile,
      lenses: dataset.lenses,
      nodes: [
        nodePatch(target, {
          detail: {
            ...target.detail,
            relatedArtifacts: [artifactWithoutLabel, legacyStringArtifact],
          },
          sources: [{ type: "file", label: "runtime", path: "src/runtime.ts" }],
        }),
      ],
      scope,
      run: run(scope),
    });

    expect(merged.nodes.find((node) => node.id === "hub-api")?.detail.relatedArtifacts).toEqual([
      { type: "file", label: "runtime.ts", path: "src/runtime.ts" },
      {
        type: "symbol",
        label: "org.springframework.cloud:spring-cloud-starter-gateway",
      },
    ]);
  });

  it("merges malformed framework profiles without assuming framework names exist", () => {
    const malformedProfile = JSON.parse(
      JSON.stringify({
        ...mockProjectMapData.profile,
        frameworks: [
          {},
          "Spring Cloud Gateway",
          {
            name: "Nacos",
            confidence: "high",
            evidence: [{ type: "file", label: "pom.xml", path: "pom.xml" }],
          },
        ],
      }),
    ) as ProjectMapProfile;
    const merged = mergeProjectMapGenerationResult({
      dataset: {
        ...mockProjectMapData,
        profile: malformedProfile,
      },
      profile: malformedProfile,
      lenses: mockProjectMapData.lenses,
      nodes: [],
      scope: { kind: "global", lensIds: [] },
      run: run({ kind: "global", lensIds: [] }),
    });

    expect(merged.profile.frameworks).toEqual(
      expect.arrayContaining([
        { name: "Spring Cloud Gateway", confidence: "unknown", evidence: [] },
        {
          name: "Nacos",
          confidence: "high",
          evidence: [{ type: "file", label: "pom.xml", path: "pom.xml" }],
        },
      ]),
    );
    expect(merged.profile.frameworks.some((framework) => !framework.name)).toBe(false);
  });

  it("blocks unsupported high confidence upgrades while allowing calibration downgrade", () => {
    const target = mockProjectMapData.nodes.find((node) => node.id === "hub-api")!;
    const scope = { kind: "node", nodeId: "hub-api", includeDescendants: false } as const;

    const unsupportedHigh = mergeProjectMapGenerationResult({
      dataset: mockProjectMapData,
      profile: mockProjectMapData.profile,
      lenses: mockProjectMapData.lenses,
      nodes: [nodePatch(target, { confidence: "high", sources: [] })],
      scope,
      run: run(scope),
    });

    expect(unsupportedHigh.nodes.find((node) => node.id === "hub-api")?.confidence).toBe(target.confidence);

    const downgraded = mergeProjectMapGenerationResult({
      dataset: mockProjectMapData,
      profile: mockProjectMapData.profile,
      lenses: mockProjectMapData.lenses,
      nodes: [nodePatch(target, { confidence: "low", stale: true, sources: [] })],
      scope,
      run: run(scope),
    });

    expect(downgraded.nodes.find((node) => node.id === "hub-api")).toMatchObject({
      confidence: "low",
      stale: true,
    });
  });

  it("prunes a non-root node subtree and rejects candidates targeting deleted nodes", () => {
    const dataset: ProjectMapDataset = {
      ...mockProjectMapData,
      candidates: [
        {
          id: "candidate-api",
          status: "pending",
          createdAt: "2026-05-26T09:00:00.000Z",
          updatedAt: "2026-05-26T09:00:00.000Z",
          source: "node",
          targetLensId: "api",
          targetNodeId: "hub-api",
          patch: { nodeId: "hub-api", summary: "candidate" },
          evidence: [],
        },
      ],
    };

    const result = pruneProjectMapNode({
      dataset,
      nodeId: "hub-api",
      prunedAt: "2026-05-26T10:00:00.000Z",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.dataset.nodes.some((node) => node.id === "hub-api")).toBe(false);
    expect(result.dataset.nodes.some((node) => node.parentId === "hub-api")).toBe(false);
    expect(result.dataset.nodes.find((node) => node.id === "project-core")?.children).not.toContain("hub-api");
    expect(result.dataset.candidates?.[0]).toMatchObject({ status: "rejected" });
  });

  it("physically prunes the root node subtree", () => {
    const result = pruneProjectMapNode({
      dataset: mockProjectMapData,
      nodeId: "project-core",
      prunedAt: "2026-05-26T10:00:00.000Z",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.dataset.nodes).toHaveLength(0);
    expect(result.dataset.manifest.lensStats.every((stats) => stats.nodeCount === 0)).toBe(true);
  });
});
