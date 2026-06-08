import { describe, expect, it } from "vitest";

import {
  createProjectMapDatasetFixture,
  createProjectMapNodeFixture,
  createProjectMapSourceFixture,
} from "../../project-map/testUtils/fixtures";
import {
  buildProjectMapRelationshipContextTaskDraft,
  buildProjectMapOrchestrationTaskDraft,
  readProjectMapOrchestrationCandidates,
  resolveProjectMapOrchestrationSourceNode,
} from "./projectMapProvider";

describe("project map orchestration provider", () => {
  it("creates a Project Map task draft with node source refs and evidence refs", () => {
    const dataset = createProjectMapDatasetFixture({
      manifest: {
        ...createProjectMapDatasetFixture().manifest,
        workspacePath: "/Users/demo/workspace",
      },
      nodes: [
        createProjectMapNodeFixture({
          id: "api-node",
          title: "API Node",
          summary: "Review API shape.",
          sources: [
            createProjectMapSourceFixture({
              label: "Controller",
              path: "/Users/demo/workspace/src/api/controller.ts",
              line: 12,
            }),
          ],
        }),
      ],
    });

    const task = buildProjectMapOrchestrationTaskDraft({
      workspaceId: "workspace-a",
      dataset,
      nodeId: "api-node",
      now: "2026-06-03T00:00:00.000Z",
    });

    expect(task).toMatchObject({
      taskId: "project-map-api-node",
      title: "Review API Node",
      status: "planned",
      sourceRefs: [expect.objectContaining({ providerId: "project-map", kind: "project_map_node", id: "api-node" })],
      evidenceRefs: [expect.objectContaining({ path: "src/api/controller.ts", workspaceRelativePath: "src/api/controller.ts" })],
      riskMarkers: [],
    });
  });

  it("risk-marks stale, candidate, low-confidence, and no-evidence nodes", () => {
    const dataset = createProjectMapDatasetFixture({
      nodes: [
        createProjectMapNodeFixture({
          id: "risky-node",
          title: "Risky Node",
          sources: [],
          stale: true,
          candidate: true,
          confidence: "low",
        }),
      ],
    });

    const task = buildProjectMapOrchestrationTaskDraft({
      workspaceId: "workspace-a",
      dataset,
      nodeId: "risky-node",
    });

    expect(task?.status).toBe("candidate");
    expect(task?.riskMarkers.map((marker) => marker.kind)).toEqual([
      "stale_source",
      "candidate_source",
      "low_confidence",
      "missing_evidence",
    ]);
  });

  it("reads candidates and resolves back-navigation to source node", () => {
    const dataset = createProjectMapDatasetFixture();
    const [task] = readProjectMapOrchestrationCandidates({
      workspaceId: "workspace-a",
      dataset,
    });

    expect(task).toBeTruthy();
    expect(resolveProjectMapOrchestrationSourceNode({ dataset, task: task! })).toMatchObject({
      status: "found",
      node: expect.objectContaining({ id: "project-core" }),
    });
    expect(resolveProjectMapOrchestrationSourceNode({
      dataset: { ...dataset, nodes: [] },
      task: task!,
    })).toEqual({ status: "missing", nodeId: "project-core" });
  });

  it("creates a resource discovery candidate from relationship context-pack", () => {
    const task = buildProjectMapRelationshipContextTaskDraft({
      workspaceId: "workspace-a",
      workspacePath: "/Users/demo/workspace",
      contextPack: {
        schemaVersion: 1,
        generatedAt: "2026-06-05T00:00:00.000Z",
        mustReadFiles: ["src/api/controller.ts"],
        relatedFiles: ["src/api/service.ts"],
        testTargets: ["src/api/controller.test.ts"],
        contracts: ["openspec/changes/demo/spec.md"],
        riskFlags: [],
        provenance: {
          scanRunId: "relationship-scan-test",
          relationIds: ["rel-a"],
          fileIds: ["file-a"],
        },
      },
    });

    expect(task).toMatchObject({
      taskId: "project-map-relationship-context-relationship-scan-test",
      title: "Review Project Map relationship context",
      status: "planned",
      sourceRefs: [expect.objectContaining({ kind: "project_map_context_pack" })],
      evidenceRefs: [
        expect.objectContaining({ workspaceRelativePath: "src/api/controller.ts" }),
        expect.objectContaining({ workspaceRelativePath: "src/api/service.ts" }),
        expect.objectContaining({ workspaceRelativePath: "src/api/controller.test.ts" }),
        expect.objectContaining({ workspaceRelativePath: "openspec/changes/demo/spec.md" }),
      ],
    });
  });
});
