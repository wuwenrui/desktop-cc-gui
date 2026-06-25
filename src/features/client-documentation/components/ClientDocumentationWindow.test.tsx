/** @vitest-environment jsdom */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const setTitleMock = vi.fn(async () => undefined);
const startDraggingMock = vi.fn(async () => undefined);
const isFullscreenMock = vi.fn(async () => false);
const useCodeCssVarsMock = vi.fn();

vi.mock("../../app/hooks/useAppSettingsController", () => ({
  useAppSettingsController: () => ({
    appSettings: {
      uiFontFamily: "Test UI Font",
      codeFontFamily: "Test Code Font",
      codeFontSize: 15,
    },
    reduceTransparency: true,
  }),
}));

vi.mock("../../app/hooks/useCodeCssVars", () => ({
  useCodeCssVars: (...args: any[]) => (useCodeCssVarsMock as any)(...args),
}));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: vi.fn(() => ({
    setTitle: setTitleMock,
    startDragging: startDraggingMock,
    isFullscreen: isFullscreenMock,
  })),
}));

vi.mock("../../../utils/platform", () => ({
  isWindowsPlatform: () => false,
  isMacPlatform: () => true,
}));

import { ClientDocumentationWindow } from "./ClientDocumentationWindow";
import { ClientDocumentationDetail } from "./ClientDocumentationDetail";

function getDocumentationTreeNode(container: HTMLElement, title: string) {
  const treeNode = Array.from(
    container.querySelectorAll<HTMLButtonElement>(".client-documentation-tree-node"),
  ).find((button) => button.textContent?.includes(title));
  if (!treeNode) {
    throw new Error(`Expected documentation tree node "${title}" to be rendered.`);
  }
  return treeNode;
}

describe("ClientDocumentationWindow", () => {
  beforeEach(() => {
    setTitleMock.mockClear();
    startDraggingMock.mockClear();
    isFullscreenMock.mockClear();
    useCodeCssVarsMock.mockClear();
  });

  it("renders tree and detail panes with complete module content", async () => {
    const { container } = render(<ClientDocumentationWindow />);

    expect(screen.getByText("客户端说明文档")).not.toBeNull();
    expect(container.querySelector(".client-documentation-detail h1")?.textContent).toBe(
      "界面工具栏与显示控制",
    );
    expect(screen.getByText("模块定位")).not.toBeNull();
    expect(screen.getByText("入口位置")).not.toBeNull();
    expect(screen.getByText("核心功能点")).not.toBeNull();
    expect(screen.getByText("模块使用说明")).not.toBeNull();
    expect(screen.getByText("08")).not.toBeNull();
    expect(getDocumentationTreeNode(container, "终端快捷入口")).not.toBeNull();
    expect(getDocumentationTreeNode(container, "文件入口")).not.toBeNull();
    expect(getDocumentationTreeNode(container, "搜索入口")).not.toBeNull();
    expect(screen.getByText("关联模块")).not.toBeNull();
    expect(container.querySelector(".client-documentation-hero-icon svg")).not.toBeNull();
    expect(container.querySelector(".client-documentation-tree-icon svg")).not.toBeNull();
    expect(container.querySelector(".client-documentation-sidebar")).not.toBeNull();
    expect(container.querySelector(".client-documentation-content")).not.toBeNull();
    expect(container.firstElementChild?.className).toContain("macos-desktop");
    expect(container.firstElementChild?.className).toContain("reduced-transparency");
    expect(useCodeCssVarsMock).toHaveBeenCalled();
    await waitFor(() => {
      expect(setTitleMock).toHaveBeenCalledWith("Client Documentation");
    });
  }, 15_000);

  it("updates details when selecting a tree node", () => {
    const { container } = render(<ClientDocumentationWindow />);

    const gitTreeNode = getDocumentationTreeNode(container, "Git 与版本协作");
    fireEvent.click(gitTreeNode);

    expect(container.querySelector(".client-documentation-detail h1")?.textContent).toBe(
      "Git 与版本协作",
    );
    expect(screen.getAllByText("查看 diff、提交、历史和分支。").length).toBeGreaterThan(0);
  }, 15_000);

  it("renders a recoverable fallback when the selected node is missing", () => {
    const onResetSelection = vi.fn();

    render(
      <ClientDocumentationDetail
        node={null}
        missingNodeId="missing-node"
        onResetSelection={onResetSelection}
      />,
    );

    expect(screen.getByText("暂无可展示的说明文档")).not.toBeNull();
    expect(screen.getByText("missing-node")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "返回默认模块" }));
    expect(onResetSelection).toHaveBeenCalledTimes(1);
  });

  it("starts dragging from menubar text on macOS but not from interactive controls", async () => {
    const { container } = render(<ClientDocumentationWindow />);
    const title = container.querySelector(".client-documentation-menubar-title");
    const textNode = title?.firstChild;
    expect(textNode).not.toBeNull();

    textNode?.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, button: 0, detail: 1 }));

    await waitFor(() => {
      expect(startDraggingMock).toHaveBeenCalledTimes(1);
    });

    fireEvent.mouseDown(getDocumentationTreeNode(container, "工作区与首页"), {
      button: 0,
      detail: 1,
    });

    expect(startDraggingMock).toHaveBeenCalledTimes(1);
  }, 15_000);
});
