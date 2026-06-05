import { describe, expect, it } from "vitest";

import type { GitFileStatus } from "../../../types";
import {
  createProjectMapDatasetFixture,
  createProjectMapRelationFixture,
} from "../testUtils/fixtures";
import { buildProjectMapImpactAnalysis } from "./impactAnalysis";
import {
  buildExplicitProjectMapImpactInput,
  buildGitStatusProjectMapImpactInput,
} from "./impactSources";

describe("project map impact utilities", () => {
  it("normalizes git status paths and maps changed files to graph impact", () => {
    const gitFiles: GitFileStatus[] = [
      { path: "src/api/controller.ts", status: "modified", additions: 3, deletions: 1 },
      { path: "src/api/controller.ts", status: "modified", additions: 1, deletions: 0 },
    ];
    const input = buildGitStatusProjectMapImpactInput(gitFiles);
    const dataset = createProjectMapDatasetFixture({
      relations: [createProjectMapRelationFixture()],
    });

    const impact = buildProjectMapImpactAnalysis({
      dataset,
      changedFilePaths: input.filePaths,
      source: input.source,
    });

    expect(input).toEqual({
      filePaths: ["src/api/controller.ts"],
      source: {
        kind: "git-status",
        label: "Git status",
        fileCount: 1,
      },
    });
    expect(impact.changedNodes.map((item) => item.node.id)).toEqual(["api-controller"]);
    expect(impact.affectedNodes.map((item) => item.node.id)).toEqual(
      expect.arrayContaining(["project-core", "data-store"]),
    );
    expect(impact.riskSummary).toMatchObject({
      changedCount: 1,
      affectedCount: 2,
      unmappedCount: 0,
    });
  });

  it("reports no-impact fallback for unmapped explicit files", () => {
    const input = buildExplicitProjectMapImpactInput(["docs/unmapped.md"]);
    const impact = buildProjectMapImpactAnalysis({
      dataset: createProjectMapDatasetFixture(),
      changedFilePaths: input.filePaths,
      source: input.source,
    });

    expect(impact.changedNodes).toEqual([]);
    expect(impact.affectedNodes).toEqual([]);
    expect(impact.unmappedFiles).toEqual(["docs/unmapped.md"]);
    expect(impact.riskSummary).toMatchObject({
      changedCount: 0,
      affectedCount: 0,
      unmappedCount: 1,
    });
  });
});
