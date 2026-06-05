import { describe, expect, it } from "vitest";

import { createOrchestrationSourceRef, normalizeOrchestrationWorkspacePath } from "./sourceRefs";

describe("orchestration source refs", () => {
  it("normalizes macOS and Windows workspace paths without persisting user-local roots", () => {
    expect(normalizeOrchestrationWorkspacePath({
      workspacePath: "/Users/demo/project",
      path: "/Users/demo/project/src/app.ts",
    })).toBe("src/app.ts");
    expect(normalizeOrchestrationWorkspacePath({
      workspacePath: String.raw`C:\repo\project`,
      path: String.raw`C:\repo\project\src\app.ts`,
    })).toBe("src/app.ts");
    expect(normalizeOrchestrationWorkspacePath({
      workspacePath: "/Users/demo/project",
      path: "/Users/other/secret.ts",
    })).toBeNull();
  });

  it("creates provider-neutral source refs with bounded capabilities", () => {
    const ref = createOrchestrationSourceRef({
      providerId: "project-map",
      kind: "project_map_node",
      id: "node-1",
      label: "Node",
      path: "src/app.ts",
      confidence: "low",
      stale: true,
      capabilities: ["open_source", "create_task"],
    });

    expect(ref).toMatchObject({
      providerId: "project-map",
      kind: "project_map_node",
      id: "node-1",
      path: "src/app.ts",
      workspaceRelativePath: "src/app.ts",
      confidence: "low",
      stale: true,
      capabilities: ["open_source", "create_task"],
    });
  });
});
