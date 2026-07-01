// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FileChangeRow, type FileChangeDiffPreview } from "./FileChangeRow";

afterEach(() => {
  cleanup();
});

describe("FileChangeRow", () => {
  it("shows file name and stats collapsed, and defers diff parsing until expanded", () => {
    const loadDiff = vi.fn(
      (): FileChangeDiffPreview => ({
        lines: [
          { kind: "del", text: "old" },
          { kind: "add", text: "new" },
        ],
      }),
    );
    const view = render(
      <FileChangeRow
        filePath="src/App.tsx"
        additions={1}
        deletions={1}
        status="completed"
        canExpand
        loadDiff={loadDiff}
      />,
    );

    expect(screen.getByText("App.tsx")).toBeTruthy();
    expect(screen.getByText("+1")).toBeTruthy();
    expect(screen.getByText("-1")).toBeTruthy();
    // 折叠态不解析 diff
    expect(loadDiff).not.toHaveBeenCalled();
    expect(view.container.querySelector(".tool-change-inline-diff")).toBeNull();

    fireEvent.click(screen.getByText("tools.editFile"));
    expect(loadDiff).toHaveBeenCalledTimes(1);
    expect(view.container.querySelector(".tool-change-inline-diff")).toBeTruthy();
    expect(screen.getByText("old")).toBeTruthy();
    expect(screen.getByText("new")).toBeTruthy();
  });

  it("renders fallback body when expanded without diff lines", () => {
    render(
      <FileChangeRow
        filePath="src/App.tsx"
        additions={0}
        deletions={0}
        status="completed"
        canExpand
        loadDiff={() => ({ lines: [] })}
        fallbackBody={<pre>raw output</pre>}
      />,
    );

    fireEvent.click(screen.getByText("tools.editFile"));
    expect(screen.getByText("raw output")).toBeTruthy();
  });

  it("renders the file name as plain text, never a diff-link button", () => {
    const onOpenDiffPath = vi.fn();
    render(
      <FileChangeRow
        filePath="src/App.tsx"
        additions={1}
        deletions={0}
        status="completed"
        canExpand
        loadDiff={() => ({ lines: [{ kind: "add", text: "x" }] })}
        onOpenDiffPath={onOpenDiffPath}
      />,
    );

    // 文件名统一为纯文本：无可点链接按钮，onOpenDiffPath 不再被文件名触发
    expect(screen.queryByRole("button", { name: "App.tsx" })).toBeNull();
    expect(screen.getByText("App.tsx")).toBeTruthy();
    expect(onOpenDiffPath).not.toHaveBeenCalled();
  });

  it("renders a non-expandable display row when canExpand is false", () => {
    const view = render(
      <FileChangeRow
        filePath="src/App.tsx"
        additions={2}
        deletions={0}
        status="completed"
      />,
    );

    expect(screen.getByText("App.tsx")).toBeTruthy();
    expect(screen.getByText("+2")).toBeTruthy();
    expect(screen.queryByText("-0")).toBeNull();
    // 不可展开：点击行头不产生展开体
    fireEvent.click(screen.getByText("tools.editFile"));
    expect(view.container.querySelector(".tool-change-inline-diff")).toBeNull();
  });
});
