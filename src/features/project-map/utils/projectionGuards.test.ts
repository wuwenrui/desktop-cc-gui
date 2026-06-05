import { describe, expect, it } from "vitest";

import {
  buildProjectMapBoundedPreview,
  capProjectMapProjectionItems,
  normalizeProjectMapProjectionPath,
  projectMapPathMatches,
} from "./projectionGuards";

describe("project map projection guards", () => {
  it("normalizes Windows and POSIX paths while preserving display path and line", () => {
    const normalized = normalizeProjectMapProjectionPath({
      path: "src\\api\\controller.ts:42",
    });

    expect(normalized).toMatchObject({
      displayPath: "src\\api\\controller.ts:42",
      comparisonKey: "src/api/controller.ts",
      workspaceRelativePath: "src/api/controller.ts",
      line: 42,
      degraded: false,
    });
    expect(projectMapPathMatches("src/api/controller.ts", "src\\api\\controller.ts")).toBe(true);
  });

  it("marks absolute and unsupported paths as degraded instead of dropping display context", () => {
    const normalized = normalizeProjectMapProjectionPath({
      path: "C:\\Users\\demo\\repo\\src\\api\\controller.ts",
      line: 7,
    });

    expect(normalized.degraded).toBe(true);
    expect(normalized.reason).toBe("outside-workspace");
    expect(normalized.line).toBe(7);
    expect(normalized.displayPath).toContain("controller.ts");
  });

  it("does not match degraded absolute paths against portable workspace paths", () => {
    expect(projectMapPathMatches(
      "C:\\Users\\demo\\repo\\src\\api\\controller.ts",
      "src/api/controller.ts",
    )).toBe(false);
    expect(projectMapPathMatches(
      "/Users/demo/repo/src/api/controller.ts",
      "src/api/controller.ts",
    )).toBe(false);
    expect(projectMapPathMatches(
      "src/api/controller.ts",
      "src\\api\\controller.ts",
    )).toBe(true);
  });

  it("caps large result groups and builds bounded previews", () => {
    const capped = capProjectMapProjectionItems([1, 2, 3, 4], 2);

    expect(capped).toEqual({ items: [1, 2], capped: true, totalCount: 4 });
    expect(buildProjectMapBoundedPreview("a ".repeat(50), 10)).toBe("a a a a a…");
  });

  it("sanitizes extreme limits and invalid explicit line numbers", () => {
    expect(capProjectMapProjectionItems([1, 2], Number.POSITIVE_INFINITY)).toEqual({
      items: [],
      capped: true,
      totalCount: 2,
    });
    expect(capProjectMapProjectionItems([1, 2], Number.NaN)).toEqual({
      items: [],
      capped: true,
      totalCount: 2,
    });
    expect(buildProjectMapBoundedPreview("large preview", 0)).toBe("");
    expect(buildProjectMapBoundedPreview("large preview", Number.POSITIVE_INFINITY)).toBe("");
    expect(normalizeProjectMapProjectionPath({
      path: "src/api/controller.ts:12",
      line: Number.POSITIVE_INFINITY,
    }).line).toBe(12);
  });
});
