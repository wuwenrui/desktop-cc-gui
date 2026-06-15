import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const currentDir = dirname(fileURLToPath(import.meta.url));
const srcDir = join(currentDir, "..");

const lazyFeatureImports = [
  "../features/kanban/components/KanbanView",
  "../features/git-history/components/GitHistoryPanel",
  "../features/workspaces/components/WorkspaceHome",
  "../features/spec/components/SpecHub",
  "../features/search/components/SearchPalette",
  "../features/update/components/ReleaseNotesModal",
  "../../project-map/components/ProjectMapPanel",
  "../../intent-canvas/components/IntentCanvasManager",
] as const;

const shellStaticImportFiles = [
  join(srcDir, "app-shell.tsx"),
  join(currentDir, "renderAppShell.tsx"),
  join(currentDir, "useAppShellLayoutNodesSection.tsx"),
  join(srcDir, "features/layout/hooks/useLayoutNodes.tsx"),
] as const;

const releaseNotesControllerPath = join(
  srcDir,
  "features/update/hooks/useReleaseNotes.ts",
);

function readSource(path: string): string {
  return readFileSync(path, "utf8");
}

describe("AppShell lazy feature boundaries", () => {
  it("keeps inactive feature views out of AppShell static imports", () => {
    for (const sourcePath of shellStaticImportFiles) {
      const source = readSource(sourcePath);

      for (const importPath of lazyFeatureImports) {
        expect(source).not.toContain(`from "${importPath}"`);
        expect(source).not.toContain(`from '${importPath}'`);
      }
    }
  });

  it("loads inactive feature views through statically analyzable dynamic imports", () => {
    const lazyViewsSource = readSource(join(currentDir, "lazyViews.tsx"));
    const layoutNodesSource = readSource(join(srcDir, "features/layout/hooks/useLayoutNodes.tsx"));

    for (const importPath of lazyFeatureImports.slice(0, 6)) {
      expect(lazyViewsSource).toContain(`import("${importPath}")`);
    }
    for (const importPath of lazyFeatureImports.slice(6)) {
      expect(layoutNodesSource).toContain(`import("${importPath}")`);
    }
  });

  it("keeps release notes changelog data out of startup static imports", () => {
    const source = readSource(releaseNotesControllerPath);

    expect(source).not.toContain(`from "../../../../CHANGELOG.md?raw"`);
    expect(source).toContain(`import("../../../../CHANGELOG.md?raw")`);
  });
});
