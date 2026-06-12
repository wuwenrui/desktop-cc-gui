/** @vitest-environment jsdom */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SessionWorkspaceTree } from "./SessionWorkspaceTree";

const FILES = [
  "案件卷宗/股权转让协议.docx",
  "案件卷宗/风险清单.md",
  "工作底稿/客户沟通纪要.md",
  "README.md",
];
const DIRECTORIES = ["案件卷宗", "工作底稿", "资料收集"];
// 活动路径是引擎工具调用里的绝对路径；树是工作区相对路径，按后缀匹配。
const ACTIVITIES = [
  { path: "/ws/案件卷宗/风险清单.md", reads: 1, edits: 2 },
  { path: "/ws/工作底稿/客户沟通纪要.md", reads: 3, edits: 0 },
];

describe("SessionWorkspaceTree", () => {
  it("renders the tree and expands hot-file ancestors by default", () => {
    render(
      <SessionWorkspaceTree files={FILES} directories={DIRECTORIES} activities={ACTIVITIES} />,
    );
    expect(screen.getByText("案件卷宗")).toBeTruthy();
    expect(screen.getByText("资料收集")).toBeTruthy();
    // 热度文件的祖先目录默认展开 → 文件行可见
    expect(screen.getByText("风险清单.md")).toBeTruthy();
    expect(screen.getByText("客户沟通纪要.md")).toBeTruthy();
  });

  it("marks touched files with heat badges via path-suffix match", () => {
    const { container } = render(
      <SessionWorkspaceTree files={FILES} directories={DIRECTORIES} activities={ACTIVITIES} />,
    );
    expect(container.querySelectorAll(".session-ws-badge.is-edit").length).toBe(1);
    expect(container.querySelectorAll(".session-ws-badge.is-read").length).toBe(1);
    // 未被碰过的文件无标记
    const untouched = screen.getByText("股权转让协议.docx").closest("button");
    expect(untouched?.querySelector(".session-ws-badge")).toBeNull();
  });

  it("collapse-all hides files and expand-all restores them", () => {
    render(
      <SessionWorkspaceTree files={FILES} directories={DIRECTORIES} activities={ACTIVITIES} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "fanbox.casebar.collapseAll" }));
    expect(screen.queryByText("风险清单.md")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "fanbox.casebar.expandAll" }));
    expect(screen.getByText("风险清单.md")).toBeTruthy();
  });

  it("toggles a single folder open and closed", () => {
    render(
      <SessionWorkspaceTree files={FILES} directories={DIRECTORIES} activities={ACTIVITIES} />,
    );
    // 案件卷宗 因热度默认展开，点一下收起
    fireEvent.click(screen.getByText("案件卷宗"));
    expect(screen.queryByText("风险清单.md")).toBeNull();
    fireEvent.click(screen.getByText("案件卷宗"));
    expect(screen.getByText("风险清单.md")).toBeTruthy();
  });

  it("filters files by search query keeping ancestors expanded", () => {
    render(
      <SessionWorkspaceTree files={FILES} directories={DIRECTORIES} activities={[]} />,
    );
    fireEvent.change(
      screen.getByPlaceholderText("fanbox.casebar.searchPlaceholder"),
      { target: { value: "readme" } },
    );
    expect(screen.getByText("README.md")).toBeTruthy();
    expect(screen.queryByText("案件卷宗")).toBeNull();
    fireEvent.change(
      screen.getByPlaceholderText("fanbox.casebar.searchPlaceholder"),
      { target: { value: "风险" } },
    );
    expect(screen.getByText("风险清单.md")).toBeTruthy();
    expect(screen.getByText("案件卷宗")).toBeTruthy();
    expect(screen.queryByText("README.md")).toBeNull();
  });

  it("opens a file through onOpenFile with the relative path", () => {
    const onOpenFile = vi.fn();
    render(
      <SessionWorkspaceTree
        files={FILES}
        directories={DIRECTORIES}
        activities={ACTIVITIES}
        onOpenFile={onOpenFile}
      />,
    );
    fireEvent.click(screen.getByText("风险清单.md"));
    expect(onOpenFile).toHaveBeenCalledWith("案件卷宗/风险清单.md");
  });

  it("shows the workspace empty state without files", () => {
    render(<SessionWorkspaceTree files={[]} directories={[]} activities={[]} />);
    expect(screen.getByText("fanbox.casebar.workspaceEmpty")).toBeTruthy();
  });
});
