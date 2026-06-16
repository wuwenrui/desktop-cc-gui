/** @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildLocation,
  buildWindowsLocation,
  mermaidInitialize,
  mermaidRender,
  mockCodeMirrorDispatch,
  mockOpenNewDetachedFileExplorerWindow,
} from "./FileViewPanel.test-utils";
import { FileViewPanel, resolveEditorAnnotationWidgetOrder } from "./FileViewPanel";
import { clearFileDocumentSessionCacheForTests } from "../hooks/useFileDocumentState";
import {
  getCodeIntelDefinition,
  getCodeIntelReferences,
  getGitFileFullDiff,
  readLocalImageDataUrl,
  readExternalAbsoluteFile,
  readExternalSpecFile,
  readWorkspaceFile,
  writeExternalSpecFile,
  writeWorkspaceFile,
} from "../../../services/tauri";
import { loadKatexAssets } from "../../markdown/markdownMath";
import { useFilePreviewPayload } from "../hooks/useFilePreviewPayload";

describe("editor annotation widget ordering", () => {
  it("keeps draft and existing markers sorted for CodeMirror ranges", () => {
    const targets = resolveEditorAnnotationWidgetOrder({
      maxLine: 50,
      annotations: [
        {
          id: "later-marker",
          path: "src/App.tsx",
          lineRange: { startLine: 38, endLine: 38 },
          body: "later",
          source: "file-edit-mode",
        },
        {
          id: "same-line-marker",
          path: "src/App.tsx",
          lineRange: { startLine: 12, endLine: 12 },
          body: "same line",
          source: "file-edit-mode",
        },
      ],
      draft: {
        lineRange: { startLine: 10, endLine: 12 },
        source: "file-edit-mode",
        body: "",
      },
    });

    expect(
      targets.map((target) =>
        target.kind === "marker"
          ? `${target.kind}:${target.annotation.id}:${target.targetLine}:${target.side}`
          : `${target.kind}:draft:${target.targetLine}:${target.side}`,
      ),
    ).toEqual([
      "marker:same-line-marker:12:1",
      "draft:draft:12:2",
      "marker:later-marker:38:1",
    ]);
  });
});

describe("FileViewPanel navigation", () => {
  afterEach(() => {
    cleanup();
    clearFileDocumentSessionCacheForTests();
    vi.clearAllMocks();
    mockCodeMirrorDispatch.mockReset();
    mockOpenNewDetachedFileExplorerWindow.mockClear();
  });

  it("navigates directly when definition has a single target", async () => {
    vi.mocked(readWorkspaceFile).mockResolvedValue({
      content: "class Main {}",
      truncated: false,
    });
    vi.mocked(getCodeIntelDefinition).mockResolvedValue({
      result: [buildLocation("src/Foo.java", 9, 2)],
    } as any);
    const onNavigateToLocation = vi.fn();

    render(
      <FileViewPanel
        workspaceId="ws-1"
        workspacePath="/repo"
        filePath="src/Main.java"
        openTargets={[]}
        openAppIconById={{}}
        selectedOpenAppId=""
        onSelectOpenAppId={vi.fn()}
        onNavigateToLocation={onNavigateToLocation}
        onClose={vi.fn()}
      />,
    );

    await screen.findByTestId("mock-codemirror");
    fireEvent.click(screen.getByTitle(/gotoDefinition/i));

    await waitFor(() => {
      expect(getCodeIntelDefinition).toHaveBeenCalled();
      expect(onNavigateToLocation).toHaveBeenCalledWith("src/Foo.java", {
        line: 10,
        column: 3,
      });
    });
  });

  it("shows definition candidates when multiple targets are returned", async () => {
    vi.mocked(readWorkspaceFile).mockResolvedValue({
      content: "class Main {}",
      truncated: false,
    });
    vi.mocked(getCodeIntelDefinition).mockResolvedValue({
      result: [
        buildLocation("src/Foo.java", 3, 1),
        buildLocation("src/Bar.java", 12, 6),
      ],
    } as any);
    const onNavigateToLocation = vi.fn();

    render(
      <FileViewPanel
        workspaceId="ws-2"
        workspacePath="/repo"
        filePath="src/Main.java"
        openTargets={[]}
        openAppIconById={{}}
        selectedOpenAppId=""
        onSelectOpenAppId={vi.fn()}
        onNavigateToLocation={onNavigateToLocation}
        onClose={vi.fn()}
      />,
    );

    await screen.findByTestId("mock-codemirror");
    fireEvent.click(screen.getByTitle(/gotoDefinition/i));

    await waitFor(() => {
      expect(screen.getByText("src/Foo.java")).toBeTruthy();
      expect(screen.getByText("src/Bar.java")).toBeTruthy();
    });

    fireEvent.click(screen.getByText("src/Bar.java"));

    expect(onNavigateToLocation).toHaveBeenCalledWith("src/Bar.java", {
      line: 13,
      column: 7,
    });
  });

  it("normalizes Windows absolute code-intel paths back to workspace-relative navigation targets", async () => {
    vi.mocked(readWorkspaceFile).mockResolvedValue({
      content: "const main = 1;",
      truncated: false,
    });
    vi.mocked(getCodeIntelDefinition).mockResolvedValue({
      result: [buildWindowsLocation("src/Foo.ts", 2, 5)],
    } as any);
    const onNavigateToLocation = vi.fn();

    render(
      <FileViewPanel
        workspaceId="ws-nav-win"
        workspacePath="C:/Repo"
        filePath="src/Main.ts"
        openTargets={[]}
        openAppIconById={{}}
        selectedOpenAppId=""
        onSelectOpenAppId={vi.fn()}
        onNavigateToLocation={onNavigateToLocation}
        onClose={vi.fn()}
      />,
    );

    await screen.findByTestId("mock-codemirror");
    fireEvent.click(screen.getByTitle(/gotoDefinition/i));

    await waitFor(() => {
      expect(onNavigateToLocation).toHaveBeenCalledWith("src/Foo.ts", {
        line: 3,
        column: 6,
      });
    });
  });

  it("renders reference list and allows click-through navigation", async () => {
    vi.mocked(readWorkspaceFile).mockResolvedValue({
      content: "class Main {}",
      truncated: false,
    });
    vi.mocked(getCodeIntelReferences).mockResolvedValue({
      result: [
        buildLocation("src/Foo.java", 5, 4),
        buildLocation("src/Baz.java", 17, 8),
      ],
    } as any);
    const onNavigateToLocation = vi.fn();

    render(
      <FileViewPanel
        workspaceId="ws-3"
        workspacePath="/repo"
        filePath="src/Main.java"
        openTargets={[]}
        openAppIconById={{}}
        selectedOpenAppId=""
        onSelectOpenAppId={vi.fn()}
        onNavigateToLocation={onNavigateToLocation}
        onClose={vi.fn()}
      />,
    );

    await screen.findByTestId("mock-codemirror");
    fireEvent.click(screen.getByTitle(/findReferences/i));

    await waitFor(() => {
      expect(getCodeIntelReferences).toHaveBeenCalled();
      expect(screen.getByText("src/Foo.java")).toBeTruthy();
      expect(screen.getByText("src/Baz.java")).toBeTruthy();
    });

    fireEvent.click(screen.getByText("src/Baz.java"));

    expect(onNavigateToLocation).toHaveBeenCalledWith("src/Baz.java", {
      line: 18,
      column: 9,
    });
  });

  it("renders maximize toggle and triggers callback", async () => {
    vi.mocked(readWorkspaceFile).mockResolvedValue({
      content: "class Main {}",
      truncated: false,
    });
    const onToggleEditorFileMaximized = vi.fn();

    render(
      <FileViewPanel
        workspaceId="ws-4"
        workspacePath="/repo"
        filePath="src/Main.java"
        openTargets={[]}
        openAppIconById={{}}
        selectedOpenAppId=""
        onSelectOpenAppId={vi.fn()}
        onToggleEditorFileMaximized={onToggleEditorFileMaximized}
        onClose={vi.fn()}
      />,
    );

    await screen.findByTestId("mock-codemirror");
    const maximizeButton = screen.getByRole("button", {
      name: /Maximize|menu\.maximize/i,
    });
    fireEvent.click(maximizeButton);
    expect(onToggleEditorFileMaximized).toHaveBeenCalledTimes(1);
  });

  it("double-clicking a file tab toggles maximize callback", async () => {
    vi.mocked(readWorkspaceFile).mockResolvedValue({
      content: "class Main {}",
      truncated: false,
    });
    const onToggleEditorFileMaximized = vi.fn();

    render(
      <FileViewPanel
        workspaceId="ws-tab-max"
        workspacePath="/repo"
        filePath="src/Main.java"
        openTabs={["src/Main.java"]}
        activeTabPath="src/Main.java"
        onToggleEditorFileMaximized={onToggleEditorFileMaximized}
        openTargets={[]}
        openAppIconById={{}}
        selectedOpenAppId=""
        onSelectOpenAppId={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    await screen.findByTestId("mock-codemirror");
    const fileTab = screen.getByRole("tab", { name: "Main.java" });
    fireEvent.doubleClick(fileTab);
    expect(onToggleEditorFileMaximized).toHaveBeenCalledTimes(1);
  });

  it("renders tabs and action buttons in a single header row when requested", async () => {
    vi.mocked(readWorkspaceFile).mockResolvedValue({
      content: "class Main {}",
      truncated: false,
    });

    const { container } = render(
      <FileViewPanel
        workspaceId="ws-single-row-header"
        workspacePath="/repo"
        filePath="src/Main.java"
        openTabs={["src/Main.java", "src/Foo.java"]}
        activeTabPath="src/Main.java"
        openTargets={[]}
        openAppIconById={{}}
        selectedOpenAppId=""
        onSelectOpenAppId={vi.fn()}
        onClose={vi.fn()}
        headerLayout="single-row"
      />,
    );

    await screen.findByTestId("mock-codemirror");
    expect(container.querySelector(".fvp-header-row")).toBeTruthy();
    expect(container.querySelector(".fvp-header-row")?.hasAttribute("data-tauri-drag-region")).toBe(
      false,
    );
    expect(
      container.querySelector(".fvp-header-row-tabs")?.hasAttribute("data-tauri-drag-region"),
    ).toBe(false);
    expect(
      container.querySelector(".fvp-tabs-inline")?.hasAttribute("data-tauri-drag-region"),
    ).toBe(false);
    expect(
      container.querySelector(".fvp-tabs-inline .fvp-tabs-track")?.hasAttribute(
        "data-tauri-drag-region",
      ),
    ).toBe(false);
    expect(container.querySelector(".fvp-topbar")).toBeNull();
    expect(screen.getByRole("tablist", { name: "Open files" })).toBeTruthy();
    expect(screen.getByTitle(/gotoDefinition/i)).toBeTruthy();
  });

  it("opens a specific file tab in the detached explorer without activating or closing it", async () => {
    vi.mocked(readWorkspaceFile).mockResolvedValue({
      content: "class Main {}",
      truncated: false,
    });
    const onActivateTab = vi.fn();
    const onCloseTab = vi.fn();

    render(
      <FileViewPanel
        workspaceId="ws-tab-detached"
        workspaceName="mossx"
        workspacePath="/repo"
        gitRoot="/repo"
        filePath="src/Main.java"
        openTabs={["src/Main.java", "src/Foo.java"]}
        activeTabPath="src/Main.java"
        onActivateTab={onActivateTab}
        onCloseTab={onCloseTab}
        openTargets={[]}
        openAppIconById={{}}
        selectedOpenAppId=""
        onSelectOpenAppId={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    await screen.findByTestId("mock-codemirror");
    const detachedButtons = screen.getAllByRole("button", {
      name: "files.openDetachedTabFor",
    });
    fireEvent.click(detachedButtons[1]);

    await waitFor(() => {
      expect(mockOpenNewDetachedFileExplorerWindow).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: "ws-tab-detached",
          workspaceName: "mossx",
          workspacePath: "/repo",
          gitRoot: "/repo",
          initialFilePath: "src/Foo.java",
          defaultSidebarCollapsed: true,
        }),
      );
    });
    expect(onActivateTab).not.toHaveBeenCalled();
    expect(onCloseTab).not.toHaveBeenCalled();
  });

  it("prefers provided highlight markers over workspace git diff fetch", async () => {
    vi.mocked(readWorkspaceFile).mockResolvedValue({
      content: "line 1\nline 2\nline 3",
      truncated: false,
    });

    render(
      <FileViewPanel
        workspaceId="ws-highlight"
        workspacePath="/repo"
        filePath="src/Main.java"
        gitStatusFiles={[
          { path: "src/Main.java", status: "M", additions: 1, deletions: 1 },
        ]}
        highlightMarkers={{ added: [2], modified: [3] }}
        openTargets={[]}
        openAppIconById={{}}
        selectedOpenAppId=""
        onSelectOpenAppId={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    await screen.findByTestId("mock-codemirror");
    await waitFor(() => {
      expect(getGitFileFullDiff).not.toHaveBeenCalled();
      expect(mockCodeMirrorDispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          effects: expect.anything(),
        }),
      );
    });
  });

  it("falls back to workspace git diff fetch when provided highlight markers are empty", async () => {
    vi.mocked(readWorkspaceFile).mockResolvedValue({
      content: "line 1\nline 2\nline 3",
      truncated: false,
    });
    vi.mocked(getGitFileFullDiff).mockResolvedValue("@@ -1,0 +1,3 @@\n+line 1\n+line 2\n+line 3");

    render(
      <FileViewPanel
        workspaceId="ws-highlight-empty"
        workspacePath="/repo"
        filePath="src/Main.java"
        gitStatusFiles={[
          { path: "src/Main.java", status: "M", additions: 3, deletions: 0 },
        ]}
        highlightMarkers={{ added: [], modified: [] }}
        openTargets={[]}
        openAppIconById={{}}
        selectedOpenAppId=""
        onSelectOpenAppId={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    await screen.findByTestId("mock-codemirror");
    expect(getGitFileFullDiff).toHaveBeenCalledWith("ws-highlight-empty", "src/Main.java");
  });

  it("mounts the editor before slow git markers resolve", async () => {
    vi.mocked(readWorkspaceFile).mockResolvedValue({
      content: "const value = 1;",
      truncated: false,
    });
    vi.mocked(getGitFileFullDiff).mockReturnValue(new Promise(() => undefined));

    render(
      <FileViewPanel
        workspaceId="ws-slow-git-marker"
        workspacePath="/repo"
        filePath="src/value.ts"
        gitStatusFiles={[
          { path: "src/value.ts", status: "M", additions: 1, deletions: 0 },
        ]}
        highlightMarkers={{ added: [], modified: [] }}
        openTargets={[]}
        openAppIconById={{}}
        selectedOpenAppId=""
        onSelectOpenAppId={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(
        (screen.getByTestId("mock-codemirror") as HTMLTextAreaElement).value,
      ).toBe("const value = 1;");
    });
    expect(getGitFileFullDiff).toHaveBeenCalledWith(
      "ws-slow-git-marker",
      "src/value.ts",
    );
  });

  it("drops stale git marker results after switching files", async () => {
    let resolveDiff: (diff: string) => void = () => {};
    const pendingDiff = new Promise<string>((resolve) => {
      resolveDiff = resolve;
    });
    vi.mocked(readWorkspaceFile).mockImplementation(async (_workspaceId, path) => ({
      content: path === "src/A.ts" ? "const a = 1;\n" : "const b = 1;\n",
      truncated: false,
    }));
    vi.mocked(getGitFileFullDiff).mockReturnValue(pendingDiff);

    const { rerender } = render(
      <FileViewPanel
        workspaceId="ws-stale-git-marker"
        workspacePath="/repo"
        filePath="src/A.ts"
        gitStatusFiles={[{ path: "src/A.ts", status: "M", additions: 1, deletions: 0 }]}
        highlightMarkers={{ added: [], modified: [] }}
        openTargets={[]}
        openAppIconById={{}}
        selectedOpenAppId=""
        onSelectOpenAppId={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    await screen.findByTestId("mock-codemirror");

    rerender(
      <FileViewPanel
        workspaceId="ws-stale-git-marker"
        workspacePath="/repo"
        filePath="src/B.ts"
        gitStatusFiles={[]}
        highlightMarkers={{ added: [], modified: [] }}
        openTargets={[]}
        openAppIconById={{}}
        selectedOpenAppId=""
        onSelectOpenAppId={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(readWorkspaceFile).toHaveBeenCalledWith("ws-stale-git-marker", "src/B.ts");
    });
    mockCodeMirrorDispatch.mockClear();

    await act(async () => {
      resolveDiff("@@ -1,1 +1,2 @@\n const a = 1;\n+const stale = true;");
      await pendingDiff;
    });

    expect(mockCodeMirrorDispatch).not.toHaveBeenCalled();
  });

  it("normalizes absolute file paths before reading and fetching git diff", async () => {
    vi.mocked(readWorkspaceFile).mockResolvedValue({
      content: "class Main {}\n",
      truncated: false,
    });
    vi.mocked(getGitFileFullDiff).mockResolvedValue("@@ -1,1 +1,2 @@\n class Main {}\n+// changed");

    render(
      <FileViewPanel
        workspaceId="ws-absolute-path"
        workspacePath="/repo"
        filePath="/repo/src/Main.java"
        gitStatusFiles={[
          { path: "src/Main.java", status: "M", additions: 1, deletions: 0 },
        ]}
        highlightMarkers={{ added: [], modified: [] }}
        openTargets={[]}
        openAppIconById={{}}
        selectedOpenAppId=""
        onSelectOpenAppId={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    await screen.findByTestId("mock-codemirror");
    expect(readWorkspaceFile).toHaveBeenCalledWith("ws-absolute-path", "src/Main.java");
    expect(getGitFileFullDiff).toHaveBeenCalledWith("ws-absolute-path", "src/Main.java");
  });

  it("normalizes Windows absolute file paths case-insensitively before reading and fetching git diff", async () => {
    vi.mocked(readWorkspaceFile).mockResolvedValue({
      content: "class Main {}\n",
      truncated: false,
    });
    vi.mocked(getGitFileFullDiff).mockResolvedValue("@@ -1,1 +1,2 @@\n class Main {}\n+// changed");

    render(
      <FileViewPanel
        workspaceId="ws-windows-absolute-path"
        workspacePath="C:/Users/Chen/Project"
        filePath="c:/users/chen/project/src/Main.java"
        gitStatusFiles={[
          { path: "src/Main.java", status: "M", additions: 1, deletions: 0 },
        ]}
        highlightMarkers={{ added: [], modified: [] }}
        openTargets={[]}
        openAppIconById={{}}
        selectedOpenAppId=""
        onSelectOpenAppId={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    await screen.findByTestId("mock-codemirror");
    expect(readWorkspaceFile).toHaveBeenCalledWith(
      "ws-windows-absolute-path",
      "src/Main.java",
    );
    expect(getGitFileFullDiff).toHaveBeenCalledWith(
      "ws-windows-absolute-path",
      "src/Main.java",
    );
  });

  it("uses repo-relative git path for diff when git root is a workspace subdirectory", async () => {
    vi.mocked(readWorkspaceFile).mockResolvedValue({
      content: "APP_HOST=0.0.0.0\n",
      truncated: false,
    });
    vi.mocked(getGitFileFullDiff).mockResolvedValue("@@ -1,1 +1,2 @@\n-APP_HOST=0.0.0.0\n+APP_HOST=127.0.0.1");

    const { container } = render(
      <FileViewPanel
        workspaceId="ws-subrepo"
        workspacePath="/tmp/JinSen"
        gitRoot="kmllm-search-showcar-py"
        filePath="kmllm-search-showcar-py/.env.example"
        gitStatusFiles={[
          { path: ".env.example", status: "M", additions: 1, deletions: 1 },
        ]}
        highlightMarkers={{ added: [], modified: [] }}
        openTargets={[]}
        openAppIconById={{}}
        selectedOpenAppId=""
        onSelectOpenAppId={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    await screen.findByTestId("mock-codemirror");
    expect(getGitFileFullDiff).toHaveBeenCalledWith("ws-subrepo", ".env.example");
    expect(container.querySelector(".fvp-filepath")?.className).toContain("git-m");
  });

  it("does not apply subrepo repo-relative git status to workspace root file with same relative path", async () => {
    vi.mocked(readWorkspaceFile).mockResolvedValue({
      content: "# workspace root readme\n",
      truncated: false,
    });
    vi.mocked(getGitFileFullDiff).mockResolvedValue("");

    const { container } = render(
      <FileViewPanel
        workspaceId="ws-subrepo-root"
        workspacePath="/tmp/JinSen"
        gitRoot="kmllm-search-showcar-py"
        filePath="README.md"
        gitStatusFiles={[
          { path: "README.md", status: "M", additions: 1, deletions: 1 },
        ]}
        highlightMarkers={{ added: [], modified: [] }}
        openTargets={[]}
        openAppIconById={{}}
        selectedOpenAppId=""
        onSelectOpenAppId={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    await screen.findByTestId("file-markdown-preview");
    expect(getGitFileFullDiff).not.toHaveBeenCalled();
    expect(container.querySelector(".fvp-filepath")?.className).not.toContain("git-m");
  });

  it("reads file content via external spec route when path is under custom spec root", async () => {
    vi.mocked(readExternalSpecFile).mockResolvedValue({
      exists: true,
      content: "# External tasks",
      truncated: false,
    });

    render(
      <FileViewPanel
        workspaceId="ws-external-read"
        workspacePath="/repo"
        customSpecRoot="/spec-root"
        filePath="/spec-root/changes/fix/tasks.md"
        openTargets={[]}
        openAppIconById={{}}
        selectedOpenAppId=""
        onSelectOpenAppId={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    await screen.findByTestId("file-markdown-preview");
    expect(readExternalSpecFile).toHaveBeenCalledWith(
      "ws-external-read",
      "/spec-root",
      "openspec/changes/fix/tasks.md",
    );
    expect(readWorkspaceFile).not.toHaveBeenCalled();
  });

  it("writes file content via external spec route when editing file under custom spec root", async () => {
    vi.mocked(readExternalSpecFile).mockResolvedValue({
      exists: true,
      content: "line 1",
      truncated: false,
    });
    vi.mocked(writeExternalSpecFile).mockResolvedValue();

    render(
      <FileViewPanel
        workspaceId="ws-external-write"
        workspacePath="/repo"
        customSpecRoot="/spec-root"
        filePath="/spec-root/changes/fix/tasks.ts"
        openTargets={[]}
        openAppIconById={{}}
        selectedOpenAppId=""
        onSelectOpenAppId={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    const editor = (await screen.findByTestId("mock-codemirror")) as HTMLTextAreaElement;
    fireEvent.change(editor, { target: { value: "line 2" } });
    fireEvent.click(screen.getByRole("button", { name: /save|files\.save/i }));

    await waitFor(() => {
      expect(writeExternalSpecFile).toHaveBeenCalledWith(
        "ws-external-write",
        "/spec-root",
        "openspec/changes/fix/tasks.ts",
        "line 2",
      );
    });
    expect(writeWorkspaceFile).not.toHaveBeenCalled();
  });

  it("reads file content via external absolute route when path is outside workspace and spec root", async () => {
    vi.mocked(readExternalAbsoluteFile).mockResolvedValue({
      content: "export const external = true;",
      truncated: false,
    });

    render(
      <FileViewPanel
        workspaceId="ws-external-absolute"
        workspacePath="/repo"
        customSpecRoot="/spec-root"
        filePath="/another-project/src/App.tsx"
        openTargets={[]}
        openAppIconById={{}}
        selectedOpenAppId=""
        onSelectOpenAppId={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    await screen.findByTestId("mock-codemirror");
    expect(readExternalAbsoluteFile).toHaveBeenCalledWith(
      "ws-external-absolute",
      "/another-project/src/App.tsx",
    );
    expect(readWorkspaceFile).not.toHaveBeenCalled();
    expect(readExternalSpecFile).not.toHaveBeenCalled();
  });

  it("keeps external absolute files read-only on save", async () => {
    vi.mocked(readExternalAbsoluteFile).mockResolvedValue({
      content: "const a = 1;",
      truncated: false,
    });

    render(
      <FileViewPanel
        workspaceId="ws-external-absolute-save"
        workspacePath="/repo"
        customSpecRoot="/spec-root"
        filePath="/another-project/src/App.tsx"
        openTargets={[]}
        openAppIconById={{}}
        selectedOpenAppId=""
        onSelectOpenAppId={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    const editor = (await screen.findByTestId("mock-codemirror")) as HTMLTextAreaElement;
    fireEvent.change(editor, { target: { value: "const a = 2;" } });
    fireEvent.click(screen.getByRole("button", { name: /save|files\.save/i }));

    await waitFor(() => {
      expect(writeWorkspaceFile).not.toHaveBeenCalled();
      expect(writeExternalSpecFile).not.toHaveBeenCalled();
    });
  });
});

describe("FileViewPanel image preview", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    mockCodeMirrorDispatch.mockReset();
  });

  it("prefers backend data URLs for local image preview", async () => {
    vi.mocked(readLocalImageDataUrl).mockResolvedValue("data:image/png;base64,abc123");
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      blob: async () => new Blob(["image-bytes"], { type: "image/png" }),
    })));

    render(
      <FileViewPanel
        workspaceId="ws-image"
        workspacePath="/repo"
        filePath=".moss-x-gemini-inline-images/shot.png"
        openTargets={[]}
        openAppIconById={{}}
        selectedOpenAppId=""
        onSelectOpenAppId={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    const image = await screen.findByRole("img", {
      name: ".moss-x-gemini-inline-images/shot.png",
    });

    expect(vi.mocked(readLocalImageDataUrl)).toHaveBeenCalledWith(
      "ws-image",
      "/repo/.moss-x-gemini-inline-images/shot.png",
    );
    expect(image.getAttribute("src")).toBe("data:image/png;base64,abc123");
  });

  it("falls back to asset URLs when backend image data URL is unavailable", async () => {
    vi.mocked(readLocalImageDataUrl).mockResolvedValue(null);
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      blob: async () => new Blob(["image-bytes"], { type: "image/png" }),
    })));

    render(
      <FileViewPanel
        workspaceId="ws-image-fallback"
        workspacePath="/repo"
        filePath="assets/shot.png"
        openTargets={[]}
        openAppIconById={{}}
        selectedOpenAppId=""
        onSelectOpenAppId={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    const image = await screen.findByRole("img", { name: "assets/shot.png" });

    expect(image.getAttribute("src")).toBe("asset://localhost//repo/assets/shot.png");
  });
});

describe("FileViewPanel markdown modes", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("opens markdown in preview mode by default", async () => {
    vi.mocked(readWorkspaceFile).mockResolvedValue({
      content: "# Hello",
      truncated: false,
    });

    const { container } = render(
      <FileViewPanel
        workspaceId="ws-md-1"
        workspacePath="/repo"
        filePath="README.md"
        openTargets={[]}
        openAppIconById={{}}
        selectedOpenAppId=""
        onSelectOpenAppId={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(container.querySelector(".fvp-preview-scroll")).toBeTruthy();
      expect(screen.getByTestId("file-markdown-preview")).toBeTruthy();
      expect(screen.queryByTestId("mock-codemirror")).toBeNull();
    });
  });

  it("falls back to low-cost code preview for truncated markdown files", async () => {
    vi.mocked(readWorkspaceFile).mockResolvedValue({
      content: "# Hello\n" + "body\n".repeat(32),
      truncated: true,
    });

    const { container } = render(
      <FileViewPanel
        workspaceId="ws-md-low-cost"
        workspacePath="/repo"
        filePath="README.md"
        openTargets={[]}
        openAppIconById={{}}
        selectedOpenAppId=""
        onSelectOpenAppId={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(container.querySelector(".fvp-code-preview")).toBeTruthy();
    });
    expect(screen.queryByTestId("file-markdown-preview")).toBeNull();
  });

  it("keeps large markdown on the low-cost preview path across preview edit switches", async () => {
    const oversizedMarkdown = [
      "# Oversized README",
      ...Array.from({ length: 220 }, (_, index) => `- ${index}: ${"x".repeat(900)}`),
    ].join("\n");
    vi.mocked(readWorkspaceFile).mockResolvedValue({
      content: oversizedMarkdown,
      truncated: false,
    });

    const { container } = render(
      <FileViewPanel
        workspaceId="ws-md-budget"
        workspacePath="/repo"
        filePath="README.md"
        openTargets={[]}
        openAppIconById={{}}
        selectedOpenAppId=""
        onSelectOpenAppId={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(container.querySelector(".fvp-code-preview")).toBeTruthy();
    });
    expect(screen.queryByTestId("file-markdown-preview")).toBeNull();
    expect(vi.mocked(readWorkspaceFile)).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: /edit/i }));
    expect((await screen.findByTestId("mock-codemirror") as HTMLTextAreaElement).value)
      .toContain("# Oversized README");

    fireEvent.click(screen.getByRole("button", { name: /preview/i }));
    await waitFor(() => {
      expect(container.querySelector(".fvp-code-preview")).toBeTruthy();
    });
    expect(vi.mocked(readWorkspaceFile)).toHaveBeenCalledTimes(1);
  });

  it("toggles markdown preview and preserves edits", async () => {
    vi.mocked(readWorkspaceFile).mockResolvedValue({
      content: "# Start",
      truncated: false,
    });

    const { container } = render(
      <FileViewPanel
        workspaceId="ws-md-2"
        workspacePath="/repo"
        filePath="README.md"
        openTargets={[]}
        openAppIconById={{}}
        selectedOpenAppId=""
        onSelectOpenAppId={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /edit/i }));

    const editor = (await screen.findByTestId("mock-codemirror")) as HTMLTextAreaElement;
    fireEvent.change(editor, { target: { value: "# Updated" } });

    fireEvent.click(screen.getByRole("button", { name: /preview/i }));

    await waitFor(() => {
      expect(container.querySelector(".fvp-preview-scroll")).toBeTruthy();
      expect(screen.getByTestId("file-markdown-preview")).toBeTruthy();
      expect(screen.getByText("Updated")).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: /edit/i }));

    const updatedEditor = (await screen.findByTestId("mock-codemirror")) as HTMLTextAreaElement;
    expect(updatedEditor.value).toBe("# Updated");
  });

  it("creates markdown preview annotations as logical composer context without writing the file", async () => {
    vi.mocked(readWorkspaceFile).mockResolvedValue({
      content: ["# Title", "", "body", "tail"].join("\n"),
      truncated: false,
    });
    const onCreateCodeAnnotation = vi.fn();

    render(
      <FileViewPanel
        workspaceId="ws-md-annotation-preview"
        workspacePath="/repo"
        filePath="docs/guide.md"
        openTargets={[]}
        openAppIconById={{}}
        selectedOpenAppId=""
        onSelectOpenAppId={vi.fn()}
        onClose={vi.fn()}
        onCreateCodeAnnotation={onCreateCodeAnnotation}
      />,
    );

    const preview = await screen.findByTestId("file-markdown-preview");
    expect(preview.querySelector(".fvp-markdown-source-annotation-list")).toBeNull();
    expect(screen.getByRole("heading", { name: "Title" })).toBeTruthy();
    await screen.findByRole("button", { name: "Show outline" });

    fireEvent.click(screen.getByRole("button", { name: /files\.annotateForAi L3/i }));
    fireEvent.change(screen.getByPlaceholderText(/files\.annotationPlaceholder/i), {
      target: { value: "请检查标题和正文是否一致" },
    });
    fireEvent.click(screen.getByRole("button", { name: /files\.annotationSubmit/i }));

    expect(onCreateCodeAnnotation).toHaveBeenCalledWith({
      path: "docs/guide.md",
      lineRange: { startLine: 3, endLine: 4 },
      body: "请检查标题和正文是否一致",
      source: "file-preview-mode",
    });
    expect(writeWorkspaceFile).not.toHaveBeenCalled();
    expect(writeExternalSpecFile).not.toHaveBeenCalled();
  });

  it("keeps markdown annotation source lines stable after math normalization", async () => {
    vi.mocked(readWorkspaceFile).mockResolvedValue({
      content: [
        "# Math",
        "",
        "$$\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}$$",
        "",
        "target paragraph",
      ].join("\n"),
      truncated: false,
    });
    const onCreateCodeAnnotation = vi.fn();

    render(
      <FileViewPanel
        workspaceId="ws-md-annotation-math-lines"
        workspacePath="/repo"
        filePath="docs/math.md"
        openTargets={[]}
        openAppIconById={{}}
        selectedOpenAppId=""
        onSelectOpenAppId={vi.fn()}
        onClose={vi.fn()}
        onCreateCodeAnnotation={onCreateCodeAnnotation}
      />,
    );

    await screen.findByTestId("file-markdown-preview");
    fireEvent.click(screen.getByRole("button", { name: /files\.annotateForAi L5/i }));
    fireEvent.change(screen.getByPlaceholderText(/files\.annotationPlaceholder/i), {
      target: { value: "check target" },
    });
    fireEvent.click(screen.getByRole("button", { name: /files\.annotationSubmit/i }));

    expect(onCreateCodeAnnotation).toHaveBeenCalledWith({
      path: "docs/math.md",
      lineRange: { startLine: 5, endLine: 5 },
      body: "check target",
      source: "file-preview-mode",
    });
  });

  it("keeps markdown annotation typing local until submit to avoid sticky repeated input", async () => {
    vi.mocked(readWorkspaceFile).mockResolvedValue({
      content: ["# Title", "", "body", "tail"].join("\n"),
      truncated: false,
    });
    const onCreateCodeAnnotation = vi.fn();

    const { rerender } = render(
      <FileViewPanel
        workspaceId="ws-md-annotation-local-draft"
        workspacePath="/repo"
        filePath="docs/guide.md"
        openTargets={[]}
        openAppIconById={{}}
        selectedOpenAppId=""
        onSelectOpenAppId={vi.fn()}
        onClose={vi.fn()}
        onCreateCodeAnnotation={onCreateCodeAnnotation}
      />,
    );

    await screen.findByTestId("file-markdown-preview");
    fireEvent.click(screen.getByRole("button", { name: /files\.annotateForAi L3/i }));

    const input = screen.getByPlaceholderText(/files\.annotationPlaceholder/i);
    fireEvent.change(input, { target: { value: "hao" } });
    fireEvent.change(input, { target: { value: "haoni" } });
    fireEvent.change(input, { target: { value: "haoni abc" } });

    expect((input as HTMLTextAreaElement).value).toBe("haoni abc");
    expect(onCreateCodeAnnotation).not.toHaveBeenCalled();

    rerender(
      <FileViewPanel
        workspaceId="ws-md-annotation-local-draft"
        workspacePath="/repo"
        filePath="docs/guide.md"
        openTargets={[]}
        openAppIconById={{}}
        selectedOpenAppId=""
        onSelectOpenAppId={vi.fn()}
        onClose={vi.fn()}
        onCreateCodeAnnotation={onCreateCodeAnnotation}
      />,
    );
    const inputAfterRerender = screen.getByPlaceholderText(/files\.annotationPlaceholder/i);
    expect((inputAfterRerender as HTMLTextAreaElement).value).toBe("haoni abc");
    expect(screen.getAllByPlaceholderText(/files\.annotationPlaceholder/i)).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: /files\.annotationSubmit/i }));

    expect(onCreateCodeAnnotation).toHaveBeenCalledWith({
      path: "docs/guide.md",
      lineRange: { startLine: 3, endLine: 4 },
      body: "haoni abc",
      source: "file-preview-mode",
    });
  });

  it("isolates markdown annotation input from composition and file shortcuts", async () => {
    vi.mocked(readWorkspaceFile).mockResolvedValue({
      content: ["# Title", "", "body", "tail"].join("\n"),
      truncated: false,
    });
    vi.mocked(writeWorkspaceFile).mockResolvedValue();
    const onCreateCodeAnnotation = vi.fn();

    render(
      <FileViewPanel
        workspaceId="ws-md-annotation-input-island"
        workspacePath="/repo"
        filePath="docs/guide.md"
        openTargets={[]}
        openAppIconById={{}}
        selectedOpenAppId=""
        onSelectOpenAppId={vi.fn()}
        onClose={vi.fn()}
        onCreateCodeAnnotation={onCreateCodeAnnotation}
      />,
    );

    await screen.findByTestId("file-markdown-preview");
    fireEvent.click(screen.getByRole("button", { name: /files\.annotateForAi L3/i }));

    const input = screen.getByPlaceholderText(
      /files\.annotationPlaceholder/i,
    ) as HTMLTextAreaElement;
    fireEvent.compositionStart(input);
    fireEvent.change(input, { target: { value: "zhe" } });
    fireEvent.change(input, { target: { value: "这个" } });
    fireEvent.compositionEnd(input, { data: "这个" });
    fireEvent.change(input, { target: { value: "这个公式不对" } });
    input.focus();
    input.setSelectionRange(6, 6);
    fireEvent.keyDown(input, { key: "s", metaKey: true });
    fireEvent.keyDown(input, { key: "f", metaKey: true });

    expect(input.value).toBe("这个公式不对");
    expect(input.selectionStart).toBe(6);
    expect(writeWorkspaceFile).not.toHaveBeenCalled();
    expect(screen.queryByTestId("mock-codemirror")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /files\.annotationSubmit/i }));

    expect(screen.queryByPlaceholderText(/files\.annotationPlaceholder/i)).toBeNull();
    expect(onCreateCodeAnnotation).toHaveBeenCalledWith({
      path: "docs/guide.md",
      lineRange: { startLine: 3, endLine: 4 },
      body: "这个公式不对",
      source: "file-preview-mode",
    });
  });

  it("renders markdown list annotation draft only once for nested blocks", async () => {
    vi.mocked(readWorkspaceFile).mockResolvedValue({
      content: [
        "## STEP4: 综合计算",
        "",
        "- 用各竞品历史份额乘以本品相对竞争力系数，推导本品份额。",
        "- 再乘以竞争价格带市场规模。",
        "- 再乘以上市爬坡因子，得到首年销量预测。",
      ].join("\n"),
      truncated: false,
    });

    render(
      <FileViewPanel
        workspaceId="ws-md-annotation-nested-list-draft"
        workspacePath="/repo"
        filePath="docs/guide.md"
        openTargets={[]}
        openAppIconById={{}}
        selectedOpenAppId=""
        onSelectOpenAppId={vi.fn()}
        onClose={vi.fn()}
        onCreateCodeAnnotation={vi.fn()}
      />,
    );

    await screen.findByTestId("file-markdown-preview");
    fireEvent.click(screen.getByRole("button", { name: /files\.annotateForAi L3-L5/i }));

    expect(screen.getAllByPlaceholderText(/files\.annotationPlaceholder/i)).toHaveLength(1);
    expect(document.querySelectorAll(".fvp-annotation-draft")).toHaveLength(1);
  });

  it("renders markdown list annotation marker only once for nested blocks", async () => {
    vi.mocked(readWorkspaceFile).mockResolvedValue({
      content: [
        "## STEP4: 综合计算",
        "",
        "- 用各竞品历史份额乘以本品相对竞争力系数，推导本品份额。",
        "- 再乘以竞争价格带市场规模。",
        "- 再乘以上市爬坡因子，得到首年销量预测。",
      ].join("\n"),
      truncated: false,
    });

    render(
      <FileViewPanel
        workspaceId="ws-md-annotation-nested-list-marker"
        workspacePath="/repo"
        filePath="docs/guide.md"
        openTargets={[]}
        openAppIconById={{}}
        selectedOpenAppId=""
        onSelectOpenAppId={vi.fn()}
        onClose={vi.fn()}
        codeAnnotations={[
          {
            id: "annotation-list",
            path: "docs/guide.md",
            lineRange: { startLine: 3, endLine: 5 },
            body: "列表只渲染一次",
            source: "file-preview-mode",
          },
        ]}
      />,
    );

    await screen.findByTestId("file-markdown-preview");

    expect(document.querySelectorAll(".fvp-annotation-marker")).toHaveLength(1);
    expect(screen.getByText("列表只渲染一次")).toBeTruthy();
  });

  it("does not duplicate markdown annotations at the parent preview block", async () => {
    vi.mocked(readWorkspaceFile).mockResolvedValue({
      content: [
        "## STEP1: 市场规模拆解",
        "",
        "- 整体市场未来规模预测。",
        "- 紧凑型 SUV 未来规模预测。",
        "",
        "## STEP2: 竞品选择与竞争力系数",
        "",
        "- 基于配置相似度、价格重叠度，选取三个核心竞品。",
        "- 对比本品与三个核心竞品的核心竞争力系数，主要对比配置功能。",
        "",
        "## STEP3: 上市爬坡因子",
        "",
        "- 使用多年车型上市后的真实数据，拟合新车上市后的销量爬坡速度。",
        "",
        "## STEP4: 综合计算",
        "",
        "- 用各竞品历史份额乘以本品相对竞争力系数，推导本品份额。",
      ].join("\n"),
      truncated: false,
    });

    render(
      <FileViewPanel
        workspaceId="ws-md-annotation-parent-duplicate"
        workspacePath="/repo"
        filePath="docs/guide.md"
        openTargets={[]}
        openAppIconById={{}}
        selectedOpenAppId=""
        onSelectOpenAppId={vi.fn()}
        onClose={vi.fn()}
        codeAnnotations={[
          {
            id: "annotation-step2",
            path: "docs/guide.md",
            lineRange: { startLine: 8, endLine: 8 },
            body: "1212",
            source: "file-preview-mode",
          },
          {
            id: "annotation-step3",
            path: "docs/guide.md",
            lineRange: { startLine: 13, endLine: 13 },
            body: "22222",
            source: "file-preview-mode",
          },
        ]}
      />,
    );

    await screen.findByTestId("file-markdown-preview");

    expect(document.querySelectorAll(".fvp-annotation-marker")).toHaveLength(2);
    expect(screen.getAllByText("1212")).toHaveLength(1);
    expect(screen.getAllByText("22222")).toHaveLength(1);
  });

  it("keeps annotation draft focus and cursor position after rerender", async () => {
    vi.mocked(readWorkspaceFile).mockResolvedValue({
      content: ["# Title", "", "body", "tail"].join("\n"),
      truncated: false,
    });

    const { rerender } = render(
      <FileViewPanel
        workspaceId="ws-md-annotation-focus"
        workspacePath="/repo"
        filePath="docs/guide.md"
        openTargets={[]}
        openAppIconById={{}}
        selectedOpenAppId=""
        onSelectOpenAppId={vi.fn()}
        onClose={vi.fn()}
        onCreateCodeAnnotation={vi.fn()}
      />,
    );

    await screen.findByTestId("file-markdown-preview");
    fireEvent.click(screen.getByRole("button", { name: /files\.annotateForAi L3/i }));

    const input = screen.getByPlaceholderText(/files\.annotationPlaceholder/i) as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: "abcdef" } });
    input.focus();
    input.setSelectionRange(4, 4);
    fireEvent.keyUp(input, { key: "ArrowLeft" });

    rerender(
      <FileViewPanel
        workspaceId="ws-md-annotation-focus"
        workspacePath="/repo"
        filePath="docs/guide.md"
        openTargets={[]}
        openAppIconById={{}}
        selectedOpenAppId=""
        onSelectOpenAppId={vi.fn()}
        onClose={vi.fn()}
        onCreateCodeAnnotation={vi.fn()}
      />,
    );

    const inputAfterRerender = screen.getByPlaceholderText(
      /files\.annotationPlaceholder/i,
    ) as HTMLTextAreaElement;
    expect(document.activeElement).toBe(inputAfterRerender);
    expect(inputAfterRerender.value).toBe("abcdef");
    expect(inputAfterRerender.selectionStart).toBe(4);
    expect(inputAfterRerender.selectionEnd).toBe(4);
  });

  it("does not steal focus back from the composer after annotation draft rerender", async () => {
    vi.mocked(readWorkspaceFile).mockResolvedValue({
      content: ["# Title", "", "body", "tail"].join("\n"),
      truncated: false,
    });

    const { rerender } = render(
      <>
        <FileViewPanel
          workspaceId="ws-md-annotation-no-focus-steal"
          workspacePath="/repo"
          filePath="docs/guide.md"
          openTargets={[]}
          openAppIconById={{}}
          selectedOpenAppId=""
          onSelectOpenAppId={vi.fn()}
          onClose={vi.fn()}
          onCreateCodeAnnotation={vi.fn()}
        />
        <textarea aria-label="composer input" />
      </>,
    );

    await screen.findByTestId("file-markdown-preview");
    fireEvent.click(screen.getByRole("button", { name: /files\.annotateForAi L3/i }));

    const annotationInput = screen.getByPlaceholderText(
      /files\.annotationPlaceholder/i,
    ) as HTMLTextAreaElement;
    fireEvent.change(annotationInput, { target: { value: "abcdef" } });
    annotationInput.focus();
    annotationInput.setSelectionRange(4, 4);
    fireEvent.keyUp(annotationInput, { key: "ArrowLeft" });

    const composerInput = screen.getByLabelText("composer input");
    composerInput.focus();

    rerender(
      <>
        <FileViewPanel
          workspaceId="ws-md-annotation-no-focus-steal"
          workspacePath="/repo"
          filePath="docs/guide.md"
          openTargets={[]}
          openAppIconById={{}}
          selectedOpenAppId=""
          onSelectOpenAppId={vi.fn()}
          onClose={vi.fn()}
          onCreateCodeAnnotation={vi.fn()}
        />
        <textarea aria-label="composer input" />
      </>,
    );

    expect(document.activeElement).toBe(screen.getByLabelText("composer input"));
    expect(
      (screen.getByPlaceholderText(
        /files\.annotationPlaceholder/i,
      ) as HTMLTextAreaElement).value,
    ).toBe("abcdef");
  });

  it("renders confirmed preview annotations back near the marked lines", async () => {
    vi.mocked(readWorkspaceFile).mockResolvedValue({
      content: ["export const value = 1;", "export const next = 2;"].join("\n"),
      truncated: false,
    });

    const { container } = render(
      <FileViewPanel
        workspaceId="ws-code-preview-marker"
        workspacePath="/repo"
        filePath="src/value.ts"
        initialMode="preview"
        openTargets={[]}
        openAppIconById={{}}
        selectedOpenAppId=""
        onSelectOpenAppId={vi.fn()}
        onClose={vi.fn()}
        codeAnnotations={[
          {
            id: "annotation-1",
            path: "src/value.ts",
            lineRange: { startLine: 2, endLine: 2 },
            body: "这里已经标记过",
            source: "file-preview-mode",
          },
        ]}
      />,
    );

    await waitFor(() => {
      expect(container.querySelector(".fvp-code-preview")).toBeTruthy();
    });
    const lines = container.querySelectorAll<HTMLElement>(".fvp-code-line");
    expect(lines[1]?.querySelector(".fvp-annotation-marker")?.textContent).toContain(
      "这里已经标记过",
    );
    expect(lines[0]?.querySelector(".fvp-annotation-marker")).toBeNull();
  });

  it("matches preview annotations with Windows path separators", async () => {
    vi.mocked(readWorkspaceFile).mockResolvedValue({
      content: ["# Title", "", "body"].join("\n"),
      truncated: false,
    });

    render(
      <FileViewPanel
        workspaceId="ws-md-annotation-windows-path"
        workspacePath="/repo"
        filePath="docs/guide.md"
        openTargets={[]}
        openAppIconById={{}}
        selectedOpenAppId=""
        onSelectOpenAppId={vi.fn()}
        onClose={vi.fn()}
        codeAnnotations={[
          {
            id: "annotation-windows-path",
            path: "docs\\guide.md",
            lineRange: { startLine: 3, endLine: 3 },
            body: "跨平台路径标注",
            source: "file-preview-mode",
          },
        ]}
      />,
    );

    await screen.findByTestId("file-markdown-preview");

    expect(document.querySelectorAll(".fvp-annotation-marker")).toHaveLength(1);
    expect(screen.getByText("跨平台路径标注")).toBeTruthy();
  });

  it("creates markdown edit annotations without requiring save", async () => {
    vi.mocked(readWorkspaceFile).mockResolvedValue({
      content: ["# Title", "", "body"].join("\n"),
      truncated: false,
    });
    const onCreateCodeAnnotation = vi.fn();
    const onActiveFileLineRangeChange = vi.fn();

    const { container, rerender } = render(
      <FileViewPanel
        workspaceId="ws-md-annotation-edit"
        workspacePath="/repo"
        filePath="docs/guide.md"
        activeFileLineRange={null}
        onActiveFileLineRangeChange={onActiveFileLineRangeChange}
        openTargets={[]}
        openAppIconById={{}}
        selectedOpenAppId=""
        onSelectOpenAppId={vi.fn()}
        onClose={vi.fn()}
        onCreateCodeAnnotation={onCreateCodeAnnotation}
      />,
    );

    await screen.findByTestId("file-markdown-preview");
    fireEvent.click(screen.getByRole("button", { name: /edit/i }));
    await screen.findByTestId("mock-codemirror");

    rerender(
      <FileViewPanel
        workspaceId="ws-md-annotation-edit"
        workspacePath="/repo"
        filePath="docs/guide.md"
        activeFileLineRange={{ startLine: 2, endLine: 3 }}
        onActiveFileLineRangeChange={onActiveFileLineRangeChange}
        openTargets={[]}
        openAppIconById={{}}
        selectedOpenAppId=""
        onSelectOpenAppId={vi.fn()}
        onClose={vi.fn()}
        onCreateCodeAnnotation={onCreateCodeAnnotation}
      />,
    );

    expect(container.querySelector(".fvp-annotation-toolbar")).toBeNull();
    const footerAnnotationButton = container.querySelector(
      ".fvp-footer .fvp-file-reference-annotation",
    );
    expect(footerAnnotationButton).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /files\.annotateForAi/i }));
    expect(screen.getAllByText("L2-L3").length).toBeGreaterThan(0);
    expect(screen.queryByPlaceholderText(/files\.annotationPlaceholder/i)).toBeNull();
    expect(onCreateCodeAnnotation).not.toHaveBeenCalled();
    expect(writeWorkspaceFile).not.toHaveBeenCalled();
    expect(writeExternalSpecFile).not.toHaveBeenCalled();
  });

  it("keeps editor line clicks local before publishing the composer file range", async () => {
    vi.mocked(readWorkspaceFile).mockResolvedValue({
      content: ["one", "two", "three"].join("\n"),
      truncated: false,
    });
    const onActiveFileLineRangeChange = vi.fn();

    render(
      <FileViewPanel
        workspaceId="ws-md-line-click"
        workspacePath="/repo"
        filePath="docs/guide.md"
        activeFileLineRange={null}
        onActiveFileLineRangeChange={onActiveFileLineRangeChange}
        openTargets={[]}
        openAppIconById={{}}
        selectedOpenAppId=""
        onSelectOpenAppId={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    await screen.findByTestId("file-markdown-preview");
    fireEvent.click(screen.getByRole("button", { name: /edit/i }));
    const editor = (await screen.findByTestId("mock-codemirror")) as HTMLTextAreaElement;
    onActiveFileLineRangeChange.mockClear();

    vi.useFakeTimers();
    try {
      editor.setSelectionRange(4, 4);
      fireEvent.select(editor);

      expect(screen.queryByText("L2")).toBeNull();
      expect(onActiveFileLineRangeChange).not.toHaveBeenCalled();

      act(() => {
        vi.advanceTimersByTime(89);
      });
      expect(screen.queryByText("L2")).toBeNull();
      expect(onActiveFileLineRangeChange).not.toHaveBeenCalled();

      act(() => {
        vi.advanceTimersByTime(1);
      });
      expect(screen.getAllByText("L2").length).toBeGreaterThan(0);
      expect(onActiveFileLineRangeChange).toHaveBeenCalledWith({
        startLine: 2,
        endLine: 2,
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("drops pending editor line range publication after switching files", async () => {
    vi.mocked(readWorkspaceFile).mockImplementation(async (_workspaceId, path) => ({
      content: path === "docs/guide.md"
        ? ["one", "two", "three"].join("\n")
        : ["alpha", "beta"].join("\n"),
      truncated: false,
    }));
    const onActiveFileLineRangeChange = vi.fn();
    const baseProps = {
      workspaceId: "ws-md-line-stale",
      workspacePath: "/repo",
      activeFileLineRange: null,
      onActiveFileLineRangeChange,
      openTargets: [],
      openAppIconById: {},
      selectedOpenAppId: "",
      onSelectOpenAppId: vi.fn(),
      onClose: vi.fn(),
      openTabs: ["docs/guide.md", "docs/other.md"],
      activeTabPath: "docs/guide.md",
      onActivateTab: vi.fn(),
      onCloseTab: vi.fn(),
      onCloseAllTabs: vi.fn(),
    };
    const { rerender } = render(
      <FileViewPanel
        {...baseProps}
        filePath="docs/guide.md"
      />,
    );

    await screen.findByTestId("file-markdown-preview");
    fireEvent.click(screen.getByRole("button", { name: /edit/i }));
    const editor = (await screen.findByTestId("mock-codemirror")) as HTMLTextAreaElement;
    onActiveFileLineRangeChange.mockClear();

    vi.useFakeTimers();
    try {
      act(() => {
        editor.setSelectionRange(4, 4);
        fireEvent.select(editor);
      });

      act(() => {
        rerender(
          <FileViewPanel
            {...baseProps}
            filePath="docs/other.md"
            activeTabPath="docs/other.md"
          />,
        );
      });

      await act(async () => {
        vi.advanceTimersByTime(91);
        await Promise.resolve();
      });

      expect(onActiveFileLineRangeChange).toHaveBeenCalledWith(null);
      expect(onActiveFileLineRangeChange).not.toHaveBeenCalledWith({
        startLine: 2,
        endLine: 2,
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not run code intelligence requests for cursor movement alone", async () => {
    vi.mocked(readWorkspaceFile).mockResolvedValue({
      content: ["function alpha() {", "  return 1;", "}"].join("\n"),
      truncated: false,
    });

    render(
      <FileViewPanel
        workspaceId="ws-code-intel-cursor"
        workspacePath="/repo"
        filePath="src/value.ts"
        activeFileLineRange={null}
        onActiveFileLineRangeChange={vi.fn()}
        openTargets={[]}
        openAppIconById={{}}
        selectedOpenAppId=""
        onSelectOpenAppId={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    const editor = (await screen.findByTestId("mock-codemirror")) as HTMLTextAreaElement;
    fireEvent.select(editor, {
      target: {
        selectionStart: editor.value.indexOf("return"),
        selectionEnd: editor.value.indexOf("return"),
      },
    });

    expect(getCodeIntelDefinition).not.toHaveBeenCalled();
    expect(getCodeIntelReferences).not.toHaveBeenCalled();
  });

  it("renders mermaid blocks lazily with per-block tabs", async () => {
    vi.mocked(readWorkspaceFile).mockResolvedValue({
      content: "```mermaid\ngraph TD\nA-->B\n```",
      truncated: false,
    });
    mermaidInitialize.mockClear();
    mermaidRender.mockClear();

    render(
      <FileViewPanel
        workspaceId="ws-md-4"
        workspacePath="/repo"
        filePath="README.md"
        openTargets={[]}
        openAppIconById={{}}
        selectedOpenAppId=""
        onSelectOpenAppId={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    await screen.findByTestId("file-markdown-preview");
    expect(screen.getByRole("tab", { name: "Source" }).getAttribute("aria-selected")).toBe("true");
    expect(mermaidRender).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("tab", { name: "Render" }));

    await waitFor(() => {
      expect(screen.getByTestId("file-markdown-mermaid-preview")).toBeTruthy();
      expect(mermaidRender).toHaveBeenCalledTimes(1);
    });
  });

  it("keeps mermaid rendered view after the same markdown preview remounts", async () => {
    vi.mocked(readWorkspaceFile).mockResolvedValue({
      content: "```mermaid\ngraph TD\nA-->B\n```",
      truncated: false,
    });
    mermaidInitialize.mockClear();
    mermaidRender.mockClear();

    const panelProps = {
      workspaceId: "ws-md-mermaid-stable",
      workspacePath: "/repo",
      filePath: "README.md",
      openTargets: [] as Parameters<typeof FileViewPanel>[0]["openTargets"],
      openAppIconById: {},
      selectedOpenAppId: "",
      onSelectOpenAppId: vi.fn(),
      onClose: vi.fn(),
    };

    const { rerender } = render(
      <FileViewPanel
        key="stable-mermaid-before"
        {...panelProps}
      />,
    );

    await screen.findByTestId("file-markdown-preview");
    fireEvent.click(screen.getByRole("tab", { name: "Render" }));
    await screen.findByTestId("file-markdown-mermaid-preview");
    expect(screen.getByRole("tab", { name: "Render" }).getAttribute("aria-selected")).toBe("true");

    rerender(
      <FileViewPanel
        key="stable-mermaid-after"
        {...panelProps}
      />,
    );

    await screen.findByTestId("file-markdown-mermaid-preview");
    expect(screen.getByRole("tab", { name: "Render" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("tab", { name: "Source" }).getAttribute("aria-selected")).toBe("false");
    expect(mermaidRender).toHaveBeenCalledTimes(1);
  });

  it("renders markdown math formulas while keeping mermaid blocks lazy", async () => {
    await loadKatexAssets();
    vi.mocked(readWorkspaceFile).mockResolvedValue({
      content: [
        "行内公式：$E=mc^2$。",
        "",
        "块级公式：",
        "",
        "$$\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}$$",
        "",
        "```mermaid",
        "graph TD",
        "A-->B",
        "```",
      ].join("\n"),
      truncated: false,
    });
    mermaidInitialize.mockClear();
    mermaidRender.mockClear();

    const { container } = render(
      <FileViewPanel
        workspaceId="ws-md-math"
        workspacePath="/repo"
        filePath="docs/math.md"
        openTargets={[]}
        openAppIconById={{}}
        selectedOpenAppId=""
        onSelectOpenAppId={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    await screen.findByTestId("file-markdown-preview");
    await waitFor(() => {
      expect(container.querySelector(".fvp-file-markdown .katex")).toBeTruthy();
      expect(container.querySelector(".fvp-file-markdown .katex-display")).toBeTruthy();
      expect(container.querySelector(".fvp-file-markdown .katex-error")).toBeFalsy();
    });
    expect(mermaidRender).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("tab", { name: "Render" }));
    await screen.findByTestId("file-markdown-mermaid-preview");
    expect(mermaidRender).toHaveBeenCalledTimes(1);
  });

  it("renders fenced math blocks as katex display formulas", async () => {
    vi.mocked(readWorkspaceFile).mockResolvedValue({
      content: [
        "## 块级公式",
        "",
        "```math",
        "\\int_{-\\infty}^{+\\infty} e^{-x^2} dx = \\sqrt{\\pi}",
        "```",
        "",
        "```latex",
        "A = \\begin{bmatrix}",
        "1 & 2 & 3 \\\\",
        "4 & 5 & 6 \\\\",
        "7 & 8 & 9",
        "\\end{bmatrix}",
        "```",
      ].join("\n"),
      truncated: false,
    });

    const { container } = render(
      <FileViewPanel
        workspaceId="ws-md-fenced-math"
        workspacePath="/repo"
        filePath="docs/math.md"
        openTargets={[]}
        openAppIconById={{}}
        selectedOpenAppId=""
        onSelectOpenAppId={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    await screen.findByTestId("file-markdown-preview");
    await waitFor(() => {
      expect(container.querySelectorAll(".fvp-file-markdown .katex-display").length).toBe(2);
    });
    expect(screen.queryByText("math")).toBeNull();
    expect(screen.queryByText("latex")).toBeNull();
  });

  it("resets markdown renderer state when switching to another markdown file", async () => {
    vi.mocked(readWorkspaceFile).mockImplementation(async (_workspaceId, path) => ({
      content:
        path === "README.md"
          ? "```mermaid\ngraph TD\nA-->B\n```"
          : "# Guide\n\nFresh body",
      truncated: false,
    }));
    mermaidInitialize.mockClear();
    mermaidRender.mockClear();

    const baseProps = {
      workspaceId: "ws-md-switch",
      workspacePath: "/repo",
      openTargets: [] as Parameters<typeof FileViewPanel>[0]["openTargets"],
      openAppIconById: {},
      selectedOpenAppId: "",
      onSelectOpenAppId: vi.fn(),
      onClose: vi.fn(),
    };

    const { rerender } = render(
      <FileViewPanel
        {...baseProps}
        filePath="README.md"
      />,
    );

    await screen.findByTestId("file-markdown-preview");
    fireEvent.click(screen.getByRole("tab", { name: "Render" }));
    await screen.findByTestId("file-markdown-mermaid-preview");
    expect(mermaidRender).toHaveBeenCalledTimes(1);

    rerender(
      <FileViewPanel
        {...baseProps}
        filePath="docs/guide.md"
      />,
    );

    await screen.findByTestId("file-markdown-preview");
    expect(screen.getByText("Guide")).toBeTruthy();
    expect(screen.queryByTestId("file-markdown-mermaid-preview")).toBeNull();
    expect(screen.queryByRole("tab", { name: "Render" })).toBeNull();
    expect(screen.queryByText("A-->B")).toBeNull();
  });

  it("renders frontmatter metadata separately from markdown body", async () => {
    vi.mocked(readWorkspaceFile).mockResolvedValue({
      content: [
        "---",
        'name: "OpenSpec: New"',
        "calls_skill: openspec-new-change",
        "tags: [workflow, artifacts, experimental]",
        "---",
        "",
        "# Title",
        "",
        "正文内容",
      ].join("\n"),
      truncated: false,
    });

    render(
      <FileViewPanel
        workspaceId="ws-md-5"
        workspacePath="/repo"
        filePath="new.md"
        openTargets={[]}
        openAppIconById={{}}
        selectedOpenAppId=""
        onSelectOpenAppId={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    await screen.findByTestId("file-markdown-preview");
    expect(screen.getByTestId("file-markdown-frontmatter")).toBeTruthy();
    expect(screen.getByText("OpenSpec: New")).toBeTruthy();
    expect(screen.getByText("openspec-new-change")).toBeTruthy();
    expect(screen.getByText("workflow · artifacts · experimental")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Title" })).toBeTruthy();
    expect(screen.queryByText(/^name: "OpenSpec: New"/)).toBeNull();
  });

  it("keeps non-markdown preview on the existing code preview path", async () => {
    vi.mocked(readWorkspaceFile).mockResolvedValue({
      content: "export const value = 1;",
      truncated: false,
    });

    const { container } = render(
      <FileViewPanel
        workspaceId="ws-md-3"
        workspacePath="/repo"
        filePath="src/value.ts"
        initialMode="preview"
        openTargets={[]}
        openAppIconById={{}}
        selectedOpenAppId=""
        onSelectOpenAppId={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(container.querySelector(".fvp-code-preview")).toBeTruthy();
    });
    expect(screen.queryByTestId("file-markdown-preview")).toBeNull();
  });

  it("reveals annotation action after selecting code preview lines", async () => {
    vi.mocked(readWorkspaceFile).mockResolvedValue({
      content: ["export const value = 1;", "export const next = 2;"].join("\n"),
      truncated: false,
    });
    const onCreateCodeAnnotation = vi.fn();

    const { container } = render(
      <FileViewPanel
        workspaceId="ws-code-preview-annotation"
        workspacePath="/repo"
        filePath="src/value.ts"
        initialMode="preview"
        openTargets={[]}
        openAppIconById={{}}
        selectedOpenAppId=""
        onSelectOpenAppId={vi.fn()}
        onClose={vi.fn()}
        onCreateCodeAnnotation={onCreateCodeAnnotation}
      />,
    );

    await waitFor(() => {
      expect(container.querySelector(".fvp-code-preview")).toBeTruthy();
    });
    const lines = container.querySelectorAll<HTMLElement>(".fvp-code-line");
    fireEvent.click(lines[0]!);
    fireEvent.click(lines[1]!, { shiftKey: true });
    expect(screen.getByText("L1-L2")).toBeTruthy();

    const selectionToolbar = container.querySelector(".fvp-preview-selection-toolbar");
    expect(selectionToolbar).toBeTruthy();
    fireEvent.click(
      (selectionToolbar as HTMLElement).querySelector(".fvp-annotation-trigger") as HTMLElement,
    );
    fireEvent.change(screen.getByPlaceholderText(/files\.annotationPlaceholder/i), {
      target: { value: "检查两行导出的命名是否一致" },
    });
    fireEvent.click(screen.getByRole("button", { name: /files\.annotationSubmit/i }));

    expect(onCreateCodeAnnotation).toHaveBeenCalledWith({
      path: "src/value.ts",
      lineRange: { startLine: 1, endLine: 2 },
      body: "检查两行导出的命名是否一致",
      source: "file-preview-mode",
    });
    expect(writeWorkspaceFile).not.toHaveBeenCalled();
    expect(writeExternalSpecFile).not.toHaveBeenCalled();
  });

  it("opens shell files in edit mode by default", async () => {
    vi.mocked(readWorkspaceFile).mockResolvedValue({
      content: [
        "#!/usr/bin/env bash",
        "",
        "# build app",
        "# with cached dependencies",
        "pnpm install --frozen-lockfile",
        "pnpm build",
      ].join("\n"),
      truncated: false,
    });

    render(
      <FileViewPanel
        workspaceId="ws-shell-1"
        workspacePath="/repo"
        filePath="scripts/build.sh"
        openTargets={[]}
        openAppIconById={{}}
        selectedOpenAppId=""
        onSelectOpenAppId={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    const editor = await screen.findByTestId("mock-codemirror");
    expect(editor).toBeTruthy();
    expect(screen.queryByTestId("file-structured-preview")).toBeNull();
  });

  it("keeps shell-group compatibility for zsh and dotfile scripts", async () => {
    vi.mocked(readWorkspaceFile).mockResolvedValue({
      content: [
        "#!/usr/bin/env zsh",
        "",
        "# setup env",
        "export APP_ENV=dev",
      ].join("\n"),
      truncated: false,
    });

    render(
      <FileViewPanel
        workspaceId="ws-shell-2"
        workspacePath="/repo"
        filePath=".envrc"
        openTargets={[]}
        openAppIconById={{}}
        selectedOpenAppId=""
        onSelectOpenAppId={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    await screen.findByTestId("mock-codemirror");
    fireEvent.click(screen.getByRole("button", { name: /preview/i }));
    await screen.findByTestId("file-structured-preview");
    expect(screen.getByText("setup env")).toBeTruthy();
    expect(screen.getByText("Commands")).toBeTruthy();
  });

  it("opens Dockerfile in edit mode by default", async () => {
    vi.mocked(readWorkspaceFile).mockResolvedValue({
      content: [
        "# production image",
        "FROM node:20-alpine",
        "WORKDIR /app",
        "COPY package.json pnpm-lock.yaml ./",
        "RUN pnpm install --frozen-lockfile \\",
        "  && pnpm store prune",
      ].join("\n"),
      truncated: false,
    });

    render(
      <FileViewPanel
        workspaceId="ws-docker-1"
        workspacePath="/repo"
        filePath="Dockerfile"
        openTargets={[]}
        openAppIconById={{}}
        selectedOpenAppId=""
        onSelectOpenAppId={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    await screen.findByTestId("mock-codemirror");
    expect(screen.queryByTestId("file-structured-preview")).toBeNull();
  });

  it("switches file modes locally without extra workspace reads", async () => {
    vi.mocked(readWorkspaceFile).mockResolvedValue({
      content: [
        "# build image",
        "FROM node:20-alpine",
        "WORKDIR /app",
      ].join("\n"),
      truncated: false,
    });

    render(
      <FileViewPanel
        workspaceId="ws-docker-local"
        workspacePath="/repo"
        filePath="Dockerfile"
        openTargets={[]}
        openAppIconById={{}}
        selectedOpenAppId=""
        onSelectOpenAppId={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    await screen.findByTestId("mock-codemirror");
    expect(vi.mocked(readWorkspaceFile)).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: /preview/i }));
    await screen.findByTestId("file-structured-preview");

    fireEvent.click(screen.getByRole("button", { name: /edit/i }));
    await screen.findByTestId("mock-codemirror");

    expect(vi.mocked(readWorkspaceFile)).toHaveBeenCalledTimes(1);
  });

  it("keeps the main-window fixed sample matrix on one render-profile-driven chain", async () => {
    const sampleContentByPath: Record<string, string> = {
      "README.md": ["# Workspace title", "", "- item"].join("\n"),
      "Dockerfile": [
        "# build image",
        "FROM node:20-alpine",
        "WORKDIR /app",
      ].join("\n"),
      "docker-compose.yml": [
        "services:",
        "  app:",
        "    image: mossx:dev",
      ].join("\n"),
      ".env.local": [
        "# local overrides",
        "APP_ENV=dev",
        "API_BASE=http://localhost:3000",
      ].join("\n"),
      "build.gradle.kts": [
        "// gradle setup",
        "plugins {",
        "  kotlin(\"jvm\") version \"1.9.24\"",
        "}",
      ].join("\n"),
    };

    vi.mocked(readWorkspaceFile).mockImplementation(async (_workspaceId, path) => ({
      content: sampleContentByPath[path] ?? `missing:${path}`,
      truncated: false,
    }));

    const openTabs = [
      "README.md",
      "Dockerfile",
      "docker-compose.yml",
      ".env.local",
      "build.gradle.kts",
    ];
    const baseProps = {
      workspaceId: "ws-main-matrix",
      workspacePath: "/repo",
      openTargets: [] as Parameters<typeof FileViewPanel>[0]["openTargets"],
      openAppIconById: {},
      selectedOpenAppId: "",
      onSelectOpenAppId: vi.fn(),
      onClose: vi.fn(),
      openTabs,
    };

    const { container, rerender } = render(
      <FileViewPanel
        {...baseProps}
        filePath="README.md"
        activeTabPath="README.md"
      />,
    );

    await screen.findByTestId("file-markdown-preview");
    expect(screen.queryByTestId("mock-codemirror")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /edit/i }));
    expect((await screen.findByTestId("mock-codemirror") as HTMLTextAreaElement).value).toBe(
      sampleContentByPath["README.md"],
    );

    rerender(
      <FileViewPanel
        {...baseProps}
        filePath="Dockerfile"
        activeTabPath="Dockerfile"
      />,
    );

    const dockerfileEditor = await screen.findByTestId("mock-codemirror");
    expect((dockerfileEditor as HTMLTextAreaElement).value).toContain("FROM node:20-alpine");
    expect(screen.queryByText("Workspace title")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /preview/i }));
    await screen.findByTestId("file-structured-preview");

    rerender(
      <FileViewPanel
        {...baseProps}
        filePath="docker-compose.yml"
        activeTabPath="docker-compose.yml"
      />,
    );

    const composeEditor = await screen.findByTestId("mock-codemirror");
    expect((composeEditor as HTMLTextAreaElement).value).toContain("services:");
    expect(screen.queryByTestId("file-structured-preview")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /preview/i }));
    await waitFor(() => {
      expect(container.querySelector(".fvp-code-preview")).toBeTruthy();
    });
    expect(screen.queryByTestId("file-markdown-preview")).toBeNull();

    rerender(
      <FileViewPanel
        {...baseProps}
        filePath=".env.local"
        activeTabPath=".env.local"
      />,
    );

    const envEditor = await screen.findByTestId("mock-codemirror");
    expect((envEditor as HTMLTextAreaElement).value).toContain("APP_ENV=dev");
    expect(screen.queryByText("services:")).toBeNull();

    rerender(
      <FileViewPanel
        {...baseProps}
        filePath="build.gradle.kts"
        activeTabPath="build.gradle.kts"
      />,
    );

    const gradleEditor = await screen.findByTestId("mock-codemirror");
    expect((gradleEditor as HTMLTextAreaElement).value).toContain("kotlin(\"jvm\")");
    fireEvent.click(screen.getByRole("button", { name: /preview/i }));
    await waitFor(() => {
      expect(container.querySelector(".fvp-code-preview")).toBeTruthy();
    });
    expect(screen.queryByTestId("file-markdown-preview")).toBeNull();
    expect(screen.queryByTestId("file-structured-preview")).toBeNull();
  });

  it("keeps structured preview only on the top-level preview path", async () => {
    vi.mocked(readWorkspaceFile).mockResolvedValue({
      content: [
        "# production image",
        "FROM node:20-alpine",
        "RUN pnpm install",
      ].join("\n"),
      truncated: false,
    });

    render(
      <FileViewPanel
        workspaceId="ws-docker-2"
        workspacePath="/repo"
        filePath="Dockerfile"
        openTargets={[]}
        openAppIconById={{}}
        selectedOpenAppId=""
        onSelectOpenAppId={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    await screen.findByTestId("mock-codemirror");
    fireEvent.click(screen.getByRole("button", { name: /preview/i }));

    await screen.findByTestId("file-structured-preview");
    expect(screen.getByText("FROM")).toBeTruthy();
    expect(screen.getByText("node:20-alpine")).toBeTruthy();
  });

  it("falls back to low-cost code preview for truncated structured files", async () => {
    vi.mocked(readWorkspaceFile).mockResolvedValue({
      content: [
        "# production image",
        "FROM node:20-alpine",
        "RUN pnpm install",
      ].join("\n"),
      truncated: true,
    });

    const { container } = render(
      <FileViewPanel
        workspaceId="ws-docker-low-cost"
        workspacePath="/repo"
        filePath="Dockerfile"
        openTargets={[]}
        openAppIconById={{}}
        selectedOpenAppId=""
        onSelectOpenAppId={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    await screen.findByTestId("mock-codemirror");
    fireEvent.click(screen.getByRole("button", { name: /preview/i }));

    await waitFor(() => {
      expect(container.querySelector(".fvp-code-preview")).toBeTruthy();
    });
    expect(screen.queryByTestId("file-structured-preview")).toBeNull();
  });

  it("does not add structured edit tabs for regular code files", async () => {
    vi.mocked(readWorkspaceFile).mockResolvedValue({
      content: "export const value = 1;",
      truncated: false,
    });

    render(
      <FileViewPanel
        workspaceId="ws-code-1"
        workspacePath="/repo"
        filePath="src/value.ts"
        openTargets={[]}
        openAppIconById={{}}
        selectedOpenAppId=""
        onSelectOpenAppId={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    await screen.findByTestId("mock-codemirror");
    expect(screen.queryByRole("tab", { name: "Code" })).toBeNull();
    expect(screen.queryByRole("tab", { name: "Render" })).toBeNull();
  });

  it("opens log-like files on the existing text preview path", async () => {
    vi.mocked(readWorkspaceFile).mockResolvedValue({
      content: "[INFO] started\n[ERROR] failed",
      truncated: false,
    });

    const { container, rerender } = render(
      <FileViewPanel
        workspaceId="ws-log-1"
        workspacePath="/repo"
        filePath="logs/app.log"
        initialMode="preview"
        openTargets={[]}
        openAppIconById={{}}
        selectedOpenAppId=""
        onSelectOpenAppId={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(container.querySelector(".fvp-code-preview")).toBeTruthy();
    });
    expect(screen.queryByText(/unsupportedFormat/i)).toBeNull();
    expect(screen.queryByTestId("file-markdown-preview")).toBeNull();

    rerender(
      <FileViewPanel
        workspaceId="ws-log-1"
        workspacePath="/repo"
        filePath="logs/worker.trace"
        initialMode="preview"
        openTargets={[]}
        openAppIconById={{}}
        selectedOpenAppId=""
        onSelectOpenAppId={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(container.querySelector(".fvp-code-preview")).toBeTruthy();
    });

    rerender(
      <FileViewPanel
        workspaceId="ws-log-1"
        workspacePath="/repo"
        filePath="logs/stderr.err"
        initialMode="preview"
        openTargets={[]}
        openAppIconById={{}}
        selectedOpenAppId=""
        onSelectOpenAppId={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(container.querySelector(".fvp-code-preview")).toBeTruthy();
    });

    rerender(
      <FileViewPanel
        workspaceId="ws-log-1"
        workspacePath="/repo"
        filePath="logs/server.out"
        initialMode="preview"
        openTargets={[]}
        openAppIconById={{}}
        selectedOpenAppId=""
        onSelectOpenAppId={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(container.querySelector(".fvp-code-preview")).toBeTruthy();
    });
  });
});

describe("FileViewPanel document preview modes", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("routes pdf files into the dedicated pdf preview surface", async () => {
    render(
      <FileViewPanel
        workspaceId="ws-pdf"
        workspacePath="/repo"
        filePath="docs/report.pdf"
        openTargets={[]}
        openAppIconById={{}}
        selectedOpenAppId=""
        onSelectOpenAppId={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("pdf-preview")).toBeTruthy();
    });
    expect(screen.queryByTestId("mock-codemirror")).toBeNull();
    expect(screen.queryByRole("button", { name: /edit/i })).toBeNull();
  });

  it("routes docx files into the dedicated document preview surface", async () => {
    render(
      <FileViewPanel
        workspaceId="ws-docx"
        workspacePath="/repo"
        filePath="docs/report.docx"
        openTargets={[]}
        openAppIconById={{}}
        selectedOpenAppId=""
        onSelectOpenAppId={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("document-preview")).toBeTruthy();
    });
    expect(screen.queryByRole("button", { name: /edit/i })).toBeNull();
  });

  it("normalizes workspace absolute paths before passing preview payloads on Windows", async () => {
    render(
      <FileViewPanel
        workspaceId="ws-docx-win"
        workspacePath={"C:\\Repo"}
        filePath="docs/report.docx"
        openTargets={[]}
        openAppIconById={{}}
        selectedOpenAppId=""
        onSelectOpenAppId={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("document-preview")).toBeTruthy();
    });

    expect(vi.mocked(useFilePreviewPayload)).toHaveBeenCalledWith(
      expect.objectContaining({
        absolutePath: "C:/Repo/docs/report.docx",
      }),
    );
  });

  it("keeps csv on table preview by default but still allows plain-text edit", async () => {
    vi.mocked(readWorkspaceFile).mockResolvedValue({
      content: "name,value\nalpha,1",
      truncated: false,
    });

    render(
      <FileViewPanel
        workspaceId="ws-csv"
        workspacePath="/repo"
        filePath="docs/report.csv"
        openTargets={[]}
        openAppIconById={{}}
        selectedOpenAppId=""
        onSelectOpenAppId={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("tabular-preview")).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: /edit/i }));
    expect(await screen.findByTestId("mock-codemirror")).not.toBeNull();
  });
});

describe("FileViewPanel code preview viewport pipeline", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("uses virtualized rows for large code preview instead of mounting every line", async () => {
    vi.mocked(readWorkspaceFile).mockResolvedValue({
      content: Array.from({ length: 1_500 }, (_, index) => `const value${index} = ${index};`).join("\n"),
      truncated: false,
    });

    const { container } = render(
      <FileViewPanel
        workspaceId="ws-code-virtual"
        workspacePath="/repo"
        filePath="src/large.ts"
        initialMode="preview"
        openTargets={[]}
        openAppIconById={{}}
        selectedOpenAppId=""
        onSelectOpenAppId={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(container.querySelector(".fvp-code-preview.is-virtualized")).toBeTruthy();
    });
    expect(container.querySelector(".fvp-code-preview")?.getAttribute("data-code-preview-line-count"))
      .toBe("1500");
    expect(container.querySelectorAll(".fvp-code-line").length).toBeLessThan(1_500);
  });
});

describe("FileViewPanel editor theme selection", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    delete document.documentElement.dataset.theme;
  });

  it("uses light theme when data-theme is light", async () => {
    document.documentElement.dataset.theme = "light";
    vi.mocked(readWorkspaceFile).mockResolvedValue({
      content: "console.log('hello');",
      truncated: false,
    });

    render(
      <FileViewPanel
        workspaceId="ws-theme-1"
        workspacePath="/repo"
        filePath="src/App.tsx"
        openTargets={[]}
        openAppIconById={{}}
        selectedOpenAppId=""
        onSelectOpenAppId={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    const editor = await screen.findByTestId("mock-codemirror");
    expect(editor.getAttribute("data-editor-theme")).toBe("light");
  });

  it("uses dark theme when data-theme is dark", async () => {
    document.documentElement.dataset.theme = "dark";
    vi.mocked(readWorkspaceFile).mockResolvedValue({
      content: "console.log('hello');",
      truncated: false,
    });

    render(
      <FileViewPanel
        workspaceId="ws-theme-2"
        workspacePath="/repo"
        filePath="src/App.tsx"
        openTargets={[]}
        openAppIconById={{}}
        selectedOpenAppId=""
        onSelectOpenAppId={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    const editor = await screen.findByTestId("mock-codemirror");
    expect(editor.getAttribute("data-editor-theme")).toBe("dark");
  });
});
