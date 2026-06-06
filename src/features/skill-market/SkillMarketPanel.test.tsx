/** @vitest-environment jsdom */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { invoke } from "@tauri-apps/api/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SkillListResp } from "./api";
import { fetchPublicSkills } from "./api";
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
        baseUrl: "http://47.239.143.243",
        skillId: 1,
        version: 3,
        name: "labor-helper",
      });
    });
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
