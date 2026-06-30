import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const currentDir = dirname(fileURLToPath(import.meta.url));
const srcDir = join(currentDir, "..");

const releaseNotesControllerPath = join(
  srcDir,
  "features/update/hooks/useReleaseNotes.ts",
);

function readSource(path: string): string {
  return readFileSync(path, "utf8");
}

describe("AppShell lazy feature boundaries", () => {
  it("keeps release notes changelog data out of startup static imports", () => {
    const source = readSource(releaseNotesControllerPath);

    expect(source).not.toContain(`from "../../../../CHANGELOG.md?raw"`);
    expect(source).toContain(`import("../../../../CHANGELOG.md?raw")`);
  });

  it("mounts heavy canvas surfaces only when their surface is active", () => {
    const layoutNodesSource = readSource(join(srcDir, "features/layout/hooks/useLayoutNodes.tsx"));
    const shellSectionSource = readSource(join(currentDir, "useAppShellLayoutNodesSection.tsx"));

    expect(layoutNodesSource).toContain(
      "const shouldMountProjectMapPanel =",
    );
    expect(layoutNodesSource).toContain(
      "const projectMapPanelNode = shouldMountProjectMapPanel ?",
    );
    expect(layoutNodesSource).toContain(
      "const intentCanvasPanelNode = isIntentCanvasSurfaceActive ?",
    );
    expect(shellSectionSource).toContain("enabled: isProjectMapDatasetEnabled");
  });

  it("keeps sidebar props on a shell summary instead of the full realtime item stream", () => {
    const layoutNodesSource = readSource(join(srcDir, "features/layout/hooks/useLayoutNodes.tsx"));
    const sidebarSource = readSource(join(srcDir, "features/app/components/Sidebar.tsx"));

    expect(layoutNodesSource).toContain("buildShellRuntimeSummary");
    expect(layoutNodesSource).toContain("activeItems={sidebarActiveItems}");
    expect(sidebarSource).toContain("export const Sidebar = memo(SidebarImpl)");
  });

  it("keeps conversation canvas rendering behind a dedicated node builder", () => {
    const layoutNodesSource = readSource(join(srcDir, "features/layout/hooks/useLayoutNodes.tsx"));
    const canvasNodeSource = readSource(join(srcDir, "features/layout/hooks/conversationCanvasNode.tsx"));

    expect(layoutNodesSource).toContain("buildConversationCanvasNode");
    expect(layoutNodesSource).not.toContain(
      `from "../../messages/components/Messages"`,
    );
    expect(canvasNodeSource).toContain("function ActiveCanvasMessages");
    expect(canvasNodeSource).toContain("useActiveCanvasSelector");
    expect(canvasNodeSource).toContain(
      "<Messages {...messagesProps} {...activeCanvasMessagesProps} />",
    );
    expect(canvasNodeSource).toContain(
      "<MessageForkConfirmDialog {...forkConfirmDialogProps} />",
    );
  });
});
