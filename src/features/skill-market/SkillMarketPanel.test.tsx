/** @vitest-environment jsdom */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { invoke } from "@tauri-apps/api/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SkillListResp } from "./api";
import { fetchPublicSkills } from "./api";
import { SKILL_INSTALLED_EVENT } from "./installedSkills";
import { fetchSkillFileContent, fetchSkillFiles } from "./previewApi";
import { SkillMarketPanel } from "./SkillMarketPanel";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("./api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./api")>();
  return {
    ...actual,
    fetchPublicSkills: vi.fn(),
  };
});

vi.mock("./previewApi", () => ({
  fetchSkillFiles: vi.fn(),
  fetchSkillFileContent: vi.fn(),
}));

const publicList: SkillListResp = {
  total: 2,
  items: [
    {
      id: 1,
      name: "labor-helper",
      display_name: "劳动用工小助理",
      description: "处理劳动合同",
      visibility: "public",
      latest_version: 3,
      author: "武艳红",
    },
    {
      id: 2,
      name: "due-diligence",
      display_name: "尽职调查",
      description: "尽调清单",
      visibility: "public",
      latest_version: 1,
    },
  ],
};

describe("SkillMarketPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders public skills from the platform", async () => {
    vi.mocked(invoke).mockResolvedValue({}); // market_list_installed → empty
    vi.mocked(fetchPublicSkills).mockResolvedValue(publicList);

    render(<SkillMarketPanel />);

    await waitFor(() => {
      expect(screen.getByText("劳动用工小助理")).toBeTruthy();
      expect(screen.getByText("尽职调查")).toBeTruthy();
      expect(screen.getByText(/作者：武艳红/)).toBeTruthy();
    });
  });

  it("shows 添加 for not-installed skills and triggers market_add_skill", async () => {
    vi.mocked(invoke).mockImplementation(async (cmd: string) => {
      if (cmd === "market_list_installed") return {};
      return undefined;
    });
    vi.mocked(fetchPublicSkills).mockResolvedValue(publicList);

    render(<SkillMarketPanel />);

    const addButtons = await screen.findAllByText("添加");
    expect(addButtons.length).toBe(2);

    fireEvent.click(addButtons[0]);

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("market_add_skill", {
        baseUrl: "https://lawhub.codingrui.work",
        skillId: 1,
        version: 3,
        name: "labor-helper",
        displayName: "劳动用工小助理",
      });
    });
  });

  it("broadcasts the installed event after a successful add", async () => {
    vi.mocked(invoke).mockImplementation(async (cmd: string) => {
      if (cmd === "market_list_installed") return {};
      return undefined;
    });
    vi.mocked(fetchPublicSkills).mockResolvedValue(publicList);
    const onInstalled = vi.fn();
    window.addEventListener(SKILL_INSTALLED_EVENT, onInstalled as EventListener);

    try {
      render(<SkillMarketPanel />);
      const addButtons = await screen.findAllByText("添加");
      fireEvent.click(addButtons[0]);
      await waitFor(() => expect(onInstalled).toHaveBeenCalledTimes(1));
      const detail = (onInstalled.mock.calls[0][0] as CustomEvent).detail;
      expect(detail).toEqual({ name: "labor-helper" });
    } finally {
      window.removeEventListener(
        SKILL_INSTALLED_EVENT,
        onInstalled as EventListener,
      );
    }
  });

  it("shows pre-install preview (tree + SKILL.md) when an item is selected", async () => {
    vi.mocked(invoke).mockResolvedValue({});
    vi.mocked(fetchPublicSkills).mockResolvedValue(publicList);
    vi.mocked(fetchSkillFiles).mockResolvedValue({
      files: [
        { path: "SKILL.md", size: 10, is_dir: false },
        { path: "sub-skills/01_intake_SKILL.md", size: 5, is_dir: false },
      ],
    });
    vi.mocked(fetchSkillFileContent).mockResolvedValue({
      path: "SKILL.md",
      content: "# 劳动用工小助理主文档",
      size: 10,
      truncated: false,
    });

    render(<SkillMarketPanel />);
    fireEvent.click(await screen.findByText("劳动用工小助理"));

    await waitFor(() => {
      // 「SKILL.md」同时出现在树与内容头部路径，用 getAllByText。
      expect(screen.getAllByText("SKILL.md").length).toBeGreaterThan(0);
      expect(screen.getByText("01_intake_SKILL.md")).toBeTruthy();
      expect(screen.getByText("# 劳动用工小助理主文档")).toBeTruthy();
    });
    expect(fetchSkillFiles).toHaveBeenCalledWith(
      expect.objectContaining({ skillId: 1, version: 3 }),
    );
    expect(screen.getByText(/未写入本地/)).toBeTruthy();
  });

  it("shows an error notice when the preview API is unavailable", async () => {
    vi.mocked(invoke).mockResolvedValue({});
    vi.mocked(fetchPublicSkills).mockResolvedValue(publicList);
    vi.mocked(fetchSkillFiles).mockRejectedValue(new Error("HTTP 404"));

    render(<SkillMarketPanel />);
    fireEvent.click(await screen.findByText("尽职调查"));

    await waitFor(() => {
      expect(screen.getByText(/在线预览不可用：HTTP 404/)).toBeTruthy();
    });
    // 预览失败不影响安装入口。
    expect(screen.getAllByText("添加").length).toBeGreaterThan(0);
  });

  it("shows 有更新 when local version is behind latest", async () => {
    vi.mocked(invoke).mockImplementation(async (cmd: string) => {
      if (cmd === "market_list_installed") {
        return { "labor-helper": { skill_id: 1, version: 2 } };
      }
      return undefined;
    });
    vi.mocked(fetchPublicSkills).mockResolvedValue(publicList);

    render(<SkillMarketPanel />);

    await waitFor(() => {
      expect(screen.getByText("有更新")).toBeTruthy();
    });
  });

  it("shows 已是最新 when local version equals latest", async () => {
    vi.mocked(invoke).mockImplementation(async (cmd: string) => {
      if (cmd === "market_list_installed") {
        return { "due-diligence": { skill_id: 2, version: 1 } };
      }
      return undefined;
    });
    vi.mocked(fetchPublicSkills).mockResolvedValue(publicList);

    render(<SkillMarketPanel />);

    await waitFor(() => {
      expect(screen.getByText("已是最新")).toBeTruthy();
    });
  });

  it("renders an error message when the list fetch fails", async () => {
    vi.mocked(invoke).mockResolvedValue({});
    vi.mocked(fetchPublicSkills).mockRejectedValue(new Error("网络错误"));

    render(<SkillMarketPanel />);

    await waitFor(() => {
      expect(screen.getByText(/加载失败：网络错误/)).toBeTruthy();
    });
  });
});
