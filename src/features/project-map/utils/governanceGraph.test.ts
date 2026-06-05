import { describe, expect, it } from "vitest";

import {
  createProjectMapDatasetFixture,
  createProjectMapNodeFixture,
  createProjectMapRelationFixture,
  createProjectMapSourceFixture,
} from "../testUtils/fixtures";
import { buildProjectMapAgentTaskContextPack } from "./contextBuilder";
import {
  extractOpenSpecMetadata,
  extractTrellisTaskMetadata,
} from "./governanceGraph";

describe("project map governance graph utilities", () => {
  it("extracts OpenSpec requirement and scenario metadata", () => {
    const metadata = extractOpenSpecMetadata({
      path: "openspec/changes/add-project-map-focused-tests/specs/project-xray-panel/spec.md",
      content: [
        "## ADDED Requirements",
        "### Requirement: Project Map SHALL Keep Tests",
        "#### Scenario: focused tests cover derived behavior",
      ].join("\n"),
    });

    expect(metadata).toEqual([
      expect.objectContaining({
        capabilityId: "project-xray-panel",
        changeId: "add-project-map-focused-tests",
        requirementTitle: "Project Map SHALL Keep Tests",
        line: 2,
      }),
      expect.objectContaining({
        capabilityId: "project-xray-panel",
        changeId: "add-project-map-focused-tests",
        requirementTitle: "Project Map SHALL Keep Tests",
        scenarioTitle: "focused tests cover derived behavior",
        line: 3,
      }),
    ]);
  });

  it("extracts Trellis task metadata from JSON and markdown task files", () => {
    const jsonMetadata = extractTrellisTaskMetadata({
      path: ".trellis/tasks/project-map-focused-tests/task.json",
      content: JSON.stringify({
        title: "Project Map focused tests",
        status: "active",
        openspecChangeId: "add-project-map-focused-tests",
        summary: "Backfill regression coverage.",
      }),
    });
    const markdownMetadata = extractTrellisTaskMetadata({
      path: ".trellis/tasks/project-map-focused-tests/notes.md",
      content: "## Focused Tests\n\nRefers to openspec/changes/add-project-map-focused-tests/tasks.md",
    });

    expect(jsonMetadata).toMatchObject({
      taskId: "project-map-focused-tests",
      title: "Project Map focused tests",
      status: "active",
      openspecChangeId: "add-project-map-focused-tests",
    });
    expect(markdownMetadata).toMatchObject({
      taskId: "project-map-focused-tests",
      title: "Focused Tests",
      openspecChangeId: "add-project-map-focused-tests",
    });
  });

  it("builds Agent Task context refs from deterministic governance evidence", () => {
    const dataset = createProjectMapDatasetFixture({
      nodes: [
        createProjectMapNodeFixture({
          id: "api-controller",
          title: "API Controller",
          children: [],
          sources: [
            createProjectMapSourceFixture({
              type: "file",
              label: "controller.ts",
              path: "src/api/controller.ts",
            }),
            createProjectMapSourceFixture({
              type: "spec",
              label: "Project XRay spec",
              path: "openspec/specs/project-xray-panel/spec.md",
              line: 10,
            }),
          ],
          detail: {
            coreDescription: "API controller.",
            keyFacts: [],
            keyLogic: [],
            riskSignals: [],
            relatedArtifacts: [
              {
                type: "task",
                label: "Focused test task",
                path: ".trellis/tasks/project-map-focused-tests/task.json",
              },
            ],
          },
        }),
        createProjectMapNodeFixture({
          id: "data-store",
          title: "Data Store",
        }),
      ],
      relations: [
        createProjectMapRelationFixture({
          id: "relation-api-spec",
          sourceNodeId: "api-controller",
          targetNodeId: "data-store",
          type: "specified_by",
          sourceKind: "spec-link",
        }),
      ],
    });

    const context = buildProjectMapAgentTaskContextPack({
      dataset,
      selectedNodeId: "api-controller",
    });

    expect(context.selectedNodeId).toBe("api-controller");
    expect(context.nodeIds).toEqual(["api-controller", "data-store"]);
    expect(context.relationIds).toEqual(["relation-api-spec"]);
    expect(context.evidenceSources.map((source) => source.path)).toContain("src/api/controller.ts");
    expect(context.deterministicGovernanceEvidence.map((link) => link.sourceKind)).toEqual(
      expect.arrayContaining(["spec-link", "task-link"]),
    );
  });
});
