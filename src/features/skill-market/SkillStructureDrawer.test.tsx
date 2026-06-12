/** @vitest-environment jsdom */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { invoke } from "@tauri-apps/api/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SELECT_SKILL_EVENT } from "../lawhub/pptSkill";
import { SkillStructureDrawer } from "./SkillStructureDrawer";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

const TREE = [
  { path: "SKILL.md", size: 100, is_dir: false },
  { path: "sub-skills", size: 0, is_dir: true },
  { path: "sub-skills/05_证据目录_SKILL.md", size: 30, is_dir: false },
  { path: "references/请求权基础检索总表.md", size: 50, is_dir: false },
];

const SKILL_MD = `---
name: 民商事诉讼大师
description: >
  处理民商事纠纷案件时使用，触发场景包括："帮我写起诉状""整理证据目录"。
---

# 正文`;

function mockInvoke(overrides?: {
  tree?: unknown;
  file?: (relPath: string) => unknown;
}) {
  vi.mocked(invoke).mockImplementation(async (cmd: string, args?: unknown) => {
    if (cmd === "market_skill_tree") {
      if (overrides?.tree instanceof Error) throw overrides.tree;
      return overrides?.tree ?? TREE;
    }
    if (cmd === "market_skill_file") {
      const relPath = (args as { relPath: string }).relPath;
      if (overrides?.file) return overrides.file(relPath);
      if (relPath === "SKILL.md") {
        return { path: relPath, content: SKILL_MD, size: 100, truncated: false };
      }
      return {
        path: relPath,
        content: `内容：${relPath}`,
        size: 10,
        truncated: false,
      };
    }
    return undefined;
  });
}

describe("SkillStructureDrawer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows the user-language overview by default and hides the file tree", async () => {
    mockInvoke();
    render(
      <SkillStructureDrawer
        name="civil-litigation-master"
        displayName="民商事诉讼大师"
        onClose={vi.fn()}
      />,
    );

    // 简介（frontmatter description）
    expect(await screen.findByText(/处理民商事纠纷案件时使用/)).toBeTruthy();
    // 能力清单：sub-skills 文件名清洗后
    expect(screen.getByText("证据目录")).toBeTruthy();
    // 示例说法：description 引号内例句
    expect(screen.getByText("「帮我写起诉状」")).toBeTruthy();
    expect(screen.getByText("「整理证据目录」")).toBeTruthy();
    // 文件树默认隐藏
    expect(screen.queryByText("05_证据目录_SKILL.md")).toBeNull();
    expect(
      screen.getByText(/~\/\.claude\/skills\/civil-litigation-master\//),
    ).toBeTruthy();
    expect(invoke).toHaveBeenCalledWith("market_skill_tree", {
      name: "civil-litigation-master",
    });
  });

  it("never renders the file tree, even after overview loads", async () => {
    mockInvoke();
    render(
      <SkillStructureDrawer name="civil-litigation-master" onClose={vi.fn()} />,
    );
    await screen.findByText(/处理民商事纠纷案件时使用/);
    expect(screen.queryByText(/文件结构/)).toBeNull();
    expect(screen.queryByText("CHANGELOG.md")).toBeNull();
    expect(screen.queryByText("05_证据目录_SKILL.md")).toBeNull();
  });

  it("clicking a capability card loads and shows the sub-skill intro", async () => {
    mockInvoke({
      file: (relPath) => {
        if (relPath === "SKILL.md") {
          return { path: relPath, content: SKILL_MD, size: 100, truncated: false };
        }
        if (relPath === "sub-skills/05_证据目录_SKILL.md") {
          return {
            path: relPath,
            content:
              "---\nname: 05_证据目录\ndescription: 整理全案证据，输出三性分析的证据目录\n---\n# 正文",
            size: 30,
            truncated: false,
          };
        }
        return { path: relPath, content: "", size: 0, truncated: false };
      },
    });
    render(
      <SkillStructureDrawer name="civil-litigation-master" onClose={vi.fn()} />,
    );
    fireEvent.click(await screen.findByRole("button", { name: "证据目录" }));

    await waitFor(() => {
      expect(
        screen.getByText("整理全案证据，输出三性分析的证据目录"),
      ).toBeTruthy();
    });
    expect(invoke).toHaveBeenCalledWith("market_skill_file", {
      name: "civil-litigation-master",
      relPath: "sub-skills/05_证据目录_SKILL.md",
    });

    // 再点同一张卡收起介绍
    fireEvent.click(screen.getByRole("button", { name: "证据目录" }));
    expect(
      screen.queryByText("整理全案证据，输出三性分析的证据目录"),
    ).toBeNull();
  });

  it("「在对话框中使用」dispatches select-skill with the dir name and closes", async () => {
    mockInvoke();
    const onClose = vi.fn();
    const onEvent = vi.fn();
    window.addEventListener(SELECT_SKILL_EVENT, onEvent as EventListener);
    try {
      render(
        <SkillStructureDrawer
          name="civil-litigation-master"
          displayName="民商事诉讼大师"
          onClose={onClose}
        />,
      );
      // 等概览数据加载完成再交互，避免测试收尾时仍有未决的异步 effect。
      await screen.findByText(/处理民商事纠纷案件时使用/);
      fireEvent.click(screen.getByText("在对话框中使用"));
      expect(onEvent).toHaveBeenCalledTimes(1);
      expect((onEvent.mock.calls[0][0] as CustomEvent).detail).toEqual({
        name: "civil-litigation-master",
      });
      expect(onClose).toHaveBeenCalledTimes(1);
    } finally {
      window.removeEventListener(SELECT_SKILL_EVENT, onEvent as EventListener);
    }
  });

  it("shows an error notice when the local tree cannot be read", async () => {
    mockInvoke({ tree: new Error("目录不存在") });
    render(<SkillStructureDrawer name="missing-skill" onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText(/读取失败：目录不存在/)).toBeTruthy();
    });
  });

  it("closes on Escape", async () => {
    mockInvoke();
    const onClose = vi.fn();
    render(
      <SkillStructureDrawer name="civil-litigation-master" onClose={onClose} />,
    );
    await screen.findByText(/处理民商事纠纷案件时使用/);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
