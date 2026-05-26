import { describe, expect, it } from "vitest";

import {
  extractProjectMapWorkspaceEvidencePaths,
  inferProjectMapWorkspaceFilePath,
  isProjectMapDiagramRelativePath,
  isProjectMapReadableWorkspacePath,
  isWindowsReservedProjectMapPathSegment,
  normalizeProjectMapPathSegment,
  normalizeWorkspaceEvidencePath,
} from "./evidencePaths";

describe("project map evidence paths", () => {
  it("normalizes Windows separators, wrappers, and line suffixes into repo-relative paths", () => {
    expect(normalizeWorkspaceEvidencePath(String.raw`(src\features\project-map\types.ts:42,)`)).toBe(
      "src/features/project-map/types.ts",
    );
    expect(normalizeWorkspaceEvidencePath("`./README.md:3`")).toBe("README.md");
  });

  it("rejects absolute, parent traversal, URL, and ignored workspace paths", () => {
    expect(normalizeWorkspaceEvidencePath(String.raw`C:\repo\mossx\src\types.ts`)).toBe("");
    expect(normalizeWorkspaceEvidencePath("/repo/mossx/src/types.ts")).toBe("");
    expect(normalizeWorkspaceEvidencePath("../src/types.ts")).toBe("");
    expect(normalizeWorkspaceEvidencePath("https://example.com/src/types.ts")).toBe("");
    expect(normalizeWorkspaceEvidencePath("node_modules/pkg/index.ts")).toBe("");
    expect(normalizeWorkspaceEvidencePath(".git/config")).toBe("");
  });

  it("extracts and deduplicates normalized evidence paths from noisy text", () => {
    expect(
      extractProjectMapWorkspaceEvidencePaths(
        String.raw`Touched src\features\project-map\types.ts:42 and src/features/project-map/types.ts.`,
      ),
    ).toEqual(["src/features/project-map/types.ts"]);
  });

  it("infers workspace evidence path from path-like label, path, or legacy ref", () => {
    expect(inferProjectMapWorkspaceFilePath({ label: String.raw`src\types.ts` })).toBe("src/types.ts");
    expect(inferProjectMapWorkspaceFilePath({ path: "package.json", label: "package" })).toBe(
      "package.json",
    );
    expect(inferProjectMapWorkspaceFilePath({ ref: "openspec/project.md" })).toBe(
      "openspec/project.md",
    );
    expect(inferProjectMapWorkspaceFilePath({ label: "RuntimeNode" })).toBe("");
  });

  it("guards Windows reserved device names including extension stems", () => {
    expect(isWindowsReservedProjectMapPathSegment("con.foo")).toBe(true);
    expect(isWindowsReservedProjectMapPathSegment("NUL.md")).toBe(true);
    expect(normalizeProjectMapPathSegment("con.foo", "lens", "lens")).toBe("lens-con.foo");
  });

  it("validates diagram paths against the persisted relative-path contract", () => {
    expect(isProjectMapDiagramRelativePath("diagrams/auth-service-flow.md")).toBe(true);
    expect(isProjectMapDiagramRelativePath(String.raw`diagrams\auth-service-flow.md`)).toBe(true);
    expect(isProjectMapDiagramRelativePath("diagrams/con.md")).toBe(false);
    expect(isProjectMapDiagramRelativePath("diagrams/auth/service.md")).toBe(false);
    expect(isProjectMapReadableWorkspacePath("diagrams/auth-service-flow.md")).toBe(true);
  });
});
