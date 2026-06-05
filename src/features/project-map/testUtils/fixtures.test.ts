import { describe, expect, it } from "vitest";

import {
  createProjectMapDatasetFixture,
  createProjectMapNodeFixture,
  createProjectMapRelationFixture,
  getProjectMapFixtureEvidencePaths,
} from "./fixtures";

describe("project map test fixtures", () => {
  it("creates compact fixtures with stable ids", () => {
    const dataset = createProjectMapDatasetFixture({
      relations: [createProjectMapRelationFixture()],
    });

    expect(createProjectMapNodeFixture().id).toBe("project-core");
    expect(dataset.nodes.map((node) => node.id)).toEqual([
      "project-core",
      "api-controller",
      "data-store",
    ]);
    expect(dataset.relations?.[0]?.id).toBe("relation-api-data");
  });

  it("keeps evidence paths workspace-relative and free of user-local roots", () => {
    const dataset = createProjectMapDatasetFixture({
      relations: [createProjectMapRelationFixture()],
    });
    const paths = getProjectMapFixtureEvidencePaths(dataset);

    expect(paths).toEqual(expect.arrayContaining([
      "README.md",
      "src/api/controller.ts",
      "src/db/store.ts",
    ]));
    expect(paths.every((path) => !path.startsWith("/") && !path.includes("\\"))).toBe(true);
    expect(paths.every((path) => !path.includes("/Users/") && !path.includes("/home/"))).toBe(true);
  });
});
