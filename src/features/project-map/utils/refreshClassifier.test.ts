import { describe, expect, it } from "vitest";

import {
  PROJECT_MAP_FIXTURE_NOW,
  createProjectMapDatasetFixture,
  createProjectMapNodeFixture,
  createProjectMapSourceFixture,
} from "../testUtils/fixtures";
import {
  classifyProjectMapRefresh,
  getProjectMapNodeStaleReasons,
} from "./refreshClassifier";

describe("project map refresh classifier", () => {
  it("classifies fresh fingerprints, changed sources, specs, architecture, and cosmetic files", () => {
    const dataset = createProjectMapDatasetFixture({
      nodes: [
        createProjectMapNodeFixture({
          id: "api-controller",
          sources: [
            createProjectMapSourceFixture({
              label: "controller.ts",
              path: "src/api/controller.ts",
              hash: "hash-api",
            }),
          ],
        }),
      ],
    });

    const summary = classifyProjectMapRefresh({
      dataset,
      changedFiles: [
        { path: "src/api/controller.ts", currentHash: "hash-api" },
        "src/api/service.ts",
        "openspec/changes/demo/specs/project-xray-panel/spec.md",
        "package.json",
        "src/styles/project-map.css",
      ],
      now: PROJECT_MAP_FIXTURE_NOW,
    });

    expect(summary.classification).toBe("architecture-refresh");
    expect(summary.staleReasons.map((reason) => reason.kind)).toEqual([
      "fingerprint-matched",
      "source-changed",
      "spec-changed",
      "architecture-changed",
      "cosmetic",
    ]);
    expect(summary.staleReasons.find((reason) => reason.kind === "fingerprint-matched")).toMatchObject({
      recommendation: "skip",
      currentHash: "hash-api",
    });
  });

  it("combines persisted stale reasons with changed source evidence for a node", () => {
    const dataset = createProjectMapDatasetFixture({
      nodes: [
        createProjectMapNodeFixture({
          id: "api-controller",
          staleReasons: [
            {
              id: "persisted-stale",
              kind: "unknown",
              label: "Persisted stale signal",
              nodeId: "api-controller",
              recommendation: "partial-refresh",
            },
          ],
          sources: [
            createProjectMapSourceFixture({
              label: "controller.ts",
              path: "src/api/controller.ts",
            }),
          ],
        }),
      ],
    });
    const summary = classifyProjectMapRefresh({
      dataset,
      changedFiles: ["src/api/controller.ts"],
      now: PROJECT_MAP_FIXTURE_NOW,
    });

    const reasons = getProjectMapNodeStaleReasons({
      nodeId: "api-controller",
      dataset,
      refreshSummary: summary,
    });

    expect(reasons.map((reason) => reason.id)).toEqual([
      "persisted-stale",
      "refresh:src/api/controller.ts:source-changed",
    ]);
  });
});
