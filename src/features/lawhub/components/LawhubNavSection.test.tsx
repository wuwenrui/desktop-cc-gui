/** @vitest-environment jsdom */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { invoke } from "@tauri-apps/api/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LawhubNavSection } from "./LawhubNavSection";
import { PPT_SKILL_NAME, SELECT_SKILL_EVENT } from "../pptSkill";
import { getWorkspaceFiles, readWorkspaceFile } from "../../../services/tauri";
import { openWorkspaceIn } from "../../../services/tauri/workspaceRuntime";
import { SKILL_INSTALLED_EVENT } from "../../skill-market/installedSkills";
import { OPEN_SKILL_MARKET_EVENT } from "../../skill-market/skillMarketDialog";
import { publishScheme, setLawhubToken } from "../../scheme-publish/api";

const BASE = "https://hub.example.com";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("../../../services/tauri", () => ({
  getWorkspaceFiles: vi.fn(),
  readWorkspaceFile: vi.fn(),
}));
vi.mock("../../../services/tauri/workspaceRuntime", () => ({
  openWorkspaceIn: vi.fn(),
}));
vi.mock("../../skill-market/platformConfig", () => ({
  getPlatformBaseUrl: () => BASE,
}));
vi.mock("../../scheme-publish/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../scheme-publish/api")>();
  return { ...actual, loginLawhub: vi.fn(), publishScheme: vi.fn() };
});

const props = {
  activeWorkspaceId: "ws1",
};

beforeEach(() => {
  window.localStorage.clear();
  vi.mocked(getWorkspaceFiles).mockResolvedValue({
    files: ["deck.html", "notes.md"],
    directories: [],
    gitignored_files: [],
    gitignored_directories: [],
  });
  vi.mocked(readWorkspaceFile).mockResolvedValue({
    content: "<html>deck</html>",
    truncated: false,
  });
  vi.mocked(publishScheme).mockResolvedValue({ id: 42, title: "deck.html" });
  vi.mocked(invoke).mockImplementation(async (cmd: string) => {
    if (cmd === "market_list_installed") return {};
    if (cmd === "market_skill_tree") return [];
    return undefined;
  });
});

afterEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
});

describe("LawhubNavSection", () => {
  it("renders collapsed: no 制作 PPT until expanded", () => {
    render(<LawhubNavSection {...props} />);
    expect(screen.getByRole("button", { name: "lawhub" })).toBeTruthy();
    expect(screen.queryByText("制作 PPT")).toBeNull();
  });

  it("expands inline to show 制作 PPT and lists only .html files", async () => {
    render(<LawhubNavSection {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "lawhub" }));
    expect(await screen.findByText("制作 PPT")).toBeTruthy();
    expect(screen.getByText("deck.html")).toBeTruthy();
    expect(screen.queryByText("notes.md")).toBeNull();
  });

  it("orders html files by created time desc via workspace_file_times", async () => {
    vi.mocked(getWorkspaceFiles).mockResolvedValue({
      files: ["old.html", "newest.html", "mid.html"],
      directories: [],
      gitignored_files: [],
      gitignored_directories: [],
    });
    vi.mocked(invoke).mockImplementation(async (cmd: string, args?: unknown) => {
      if (cmd === "market_list_installed") return {};
      if (cmd === "workspace_file_times") {
        const { paths } = args as { paths: string[] };
        const times: Record<string, number> = {
          "old.html": 100,
          "newest.html": 300,
          "mid.html": 200,
        };
        return paths.map((p) => times[p] ?? null);
      }
      return undefined;
    });

    render(<LawhubNavSection {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "lawhub" }));
    const newest = await screen.findByText("newest.html");
    const mid = screen.getByText("mid.html");
    const old = screen.getByText("old.html");
    expect(
      newest.compareDocumentPosition(mid) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      mid.compareDocumentPosition(old) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("caps the file list at 5 and expands via 显示全部 / 收起", async () => {
    vi.mocked(getWorkspaceFiles).mockResolvedValue({
      files: Array.from({ length: 7 }, (_, i) => `deck-${i}.html`),
      directories: [],
      gitignored_files: [],
      gitignored_directories: [],
    });

    render(<LawhubNavSection {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "lawhub" }));
    await screen.findByText("deck-0.html");
    expect(screen.queryByText("deck-5.html")).toBeNull();

    fireEvent.click(screen.getByText("显示全部 7 个"));
    expect(screen.getByText("deck-6.html")).toBeTruthy();

    fireEvent.click(screen.getByText("收起"));
    expect(screen.queryByText("deck-6.html")).toBeNull();
  });

  it("PPT group header collapses the file list and persists the state", async () => {
    render(<LawhubNavSection {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "lawhub" }));
    await screen.findByText("deck.html");

    fireEvent.click(screen.getByTitle("收起 PPT 列表"));
    expect(screen.queryByText("deck.html")).toBeNull();
    // 「制作 PPT」动作入口不参与折叠
    expect(screen.getByText("制作 PPT")).toBeTruthy();
    expect(window.localStorage.getItem("ccgui.lawhub.pptCollapsed")).toBe("1");

    fireEvent.click(screen.getByTitle("展开 PPT 列表"));
    expect(await screen.findByText("deck.html")).toBeTruthy();
  });

  it("制作 PPT dispatches the select-skill event (references skill, no prompt exposed)", async () => {
    const onEvent = vi.fn();
    window.addEventListener(SELECT_SKILL_EVENT, onEvent as EventListener);
    render(<LawhubNavSection {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "lawhub" }));
    fireEvent.click(await screen.findByText("制作 PPT"));
    expect(onEvent).toHaveBeenCalledTimes(1);
    const detail = (onEvent.mock.calls[0][0] as CustomEvent).detail;
    expect(detail).toEqual({ name: PPT_SKILL_NAME });
    window.removeEventListener(SELECT_SKILL_EVENT, onEvent as EventListener);
  });

  it("文件转 Markdown and 视觉 OCR dispatch select-skill events", async () => {
    const onEvent = vi.fn();
    window.addEventListener(SELECT_SKILL_EVENT, onEvent as EventListener);
    try {
      render(<LawhubNavSection {...props} />);
      fireEvent.click(screen.getByRole("button", { name: "lawhub" }));
      fireEvent.click(await screen.findByText("文件转 Markdown"));
      fireEvent.click(screen.getByText("视觉 OCR"));
      expect(onEvent).toHaveBeenCalledTimes(2);
      expect((onEvent.mock.calls[0][0] as CustomEvent).detail).toEqual({
        name: "文件转Markdown",
      });
      expect((onEvent.mock.calls[1][0] as CustomEvent).detail).toEqual({
        name: "视觉OCR",
      });
    } finally {
      window.removeEventListener(SELECT_SKILL_EVENT, onEvent as EventListener);
    }
  });

  it("制作技能 dispatches the select-skill event for the bundled skill", async () => {
    const onEvent = vi.fn();
    window.addEventListener(SELECT_SKILL_EVENT, onEvent as EventListener);
    try {
      render(<LawhubNavSection {...props} />);
      fireEvent.click(screen.getByRole("button", { name: "lawhub" }));
      fireEvent.click(await screen.findByText("制作技能"));
      expect(onEvent).toHaveBeenCalledTimes(1);
      expect((onEvent.mock.calls[0][0] as CustomEvent).detail).toEqual({
        name: "制作技能",
      });
    } finally {
      window.removeEventListener(SELECT_SKILL_EVENT, onEvent as EventListener);
    }
  });

  it("clicking a file name opens it via the workspace-scoped default-open command", async () => {
    render(<LawhubNavSection {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "lawhub" }));
    fireEvent.click(await screen.findByText("deck.html"));
    await waitFor(() =>
      expect(invoke).toHaveBeenCalledWith("open_workspace_path_default", {
        workspaceId: "ws1",
        path: "deck.html",
      }),
    );
    expect(openWorkspaceIn).not.toHaveBeenCalled();
  });

  it("lawhub 打开 with a token publishes and opens the viewer url", async () => {
    setLawhubToken("tok-1");
    render(<LawhubNavSection {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "lawhub" }));
    await screen.findByText("deck.html");
    fireEvent.click(screen.getByTitle("在 lawhub 打开"));
    await waitFor(() =>
      expect(publishScheme).toHaveBeenCalledWith(BASE, "tok-1", {
        title: "deck.html",
        html: "<html>deck</html>",
      }),
    );
    await waitFor(() =>
      expect(openWorkspaceIn).toHaveBeenCalledWith(`${BASE}/schemes/42`, {}),
    );
  });

  it("lawhub 打开 without a token reveals an inline login form and does not publish", async () => {
    render(<LawhubNavSection {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "lawhub" }));
    await screen.findByText("deck.html");
    fireEvent.click(screen.getByTitle("在 lawhub 打开"));
    expect(await screen.findByLabelText("lawhub 用户名")).toBeTruthy();
    expect(publishScheme).not.toHaveBeenCalled();
  });

  it("renders PPT and 技能 group labels when expanded", async () => {
    render(<LawhubNavSection {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "lawhub" }));
    expect(await screen.findByText("PPT")).toBeTruthy();
    expect(screen.getByText("技能")).toBeTruthy();
    expect(screen.getByText("添加技能")).toBeTruthy();
  });

  it("lists installed market skills by install order with display names", async () => {
    vi.mocked(invoke).mockImplementation(async (cmd: string) => {
      if (cmd === "market_list_installed") {
        return {
          "criminal-defense-workflow": {
            skill_id: 2,
            version: 1,
            installed_at: 200,
            display_name: "刑事辩护全流程",
          },
          "civil-litigation-master": {
            skill_id: 1,
            version: 3,
            installed_at: 100,
            display_name: "民商事诉讼大师",
          },
        };
      }
      return undefined;
    });

    render(<LawhubNavSection {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "lawhub" }));

    const civil = await screen.findByText("民商事诉讼大师");
    const criminal = screen.getByText("刑事辩护全流程");
    // 先装的在前（DOM 顺序）。
    expect(
      civil.compareDocumentPosition(criminal) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("clicking an installed skill name dispatches select-skill with the dir name", async () => {
    vi.mocked(invoke).mockImplementation(async (cmd: string) => {
      if (cmd === "market_list_installed") {
        return {
          "civil-litigation-master": {
            skill_id: 1,
            version: 3,
            installed_at: 100,
            display_name: "民商事诉讼大师",
          },
        };
      }
      return undefined;
    });
    const onEvent = vi.fn();
    window.addEventListener(SELECT_SKILL_EVENT, onEvent as EventListener);
    try {
      render(<LawhubNavSection {...props} />);
      fireEvent.click(screen.getByRole("button", { name: "lawhub" }));
      fireEvent.click(await screen.findByText("民商事诉讼大师"));
      expect(onEvent).toHaveBeenCalledTimes(1);
      expect((onEvent.mock.calls[0][0] as CustomEvent).detail).toEqual({
        name: "civil-litigation-master",
      });
    } finally {
      window.removeEventListener(SELECT_SKILL_EVENT, onEvent as EventListener);
    }
  });

  it("查看 opens the local structure drawer for the skill", async () => {
    vi.mocked(invoke).mockImplementation(async (cmd: string) => {
      if (cmd === "market_list_installed") {
        return {
          "civil-litigation-master": {
            skill_id: 1,
            version: 3,
            installed_at: 100,
            display_name: "民商事诉讼大师",
          },
        };
      }
      if (cmd === "market_skill_tree") {
        return [{ path: "SKILL.md", size: 10, is_dir: false }];
      }
      if (cmd === "market_skill_file") {
        return { path: "SKILL.md", content: "# 主文档", size: 10, truncated: false };
      }
      return undefined;
    });

    render(<LawhubNavSection {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "lawhub" }));
    fireEvent.click(
      await screen.findByLabelText("查看 民商事诉讼大师 的结构"),
    );

    expect(
      await screen.findByRole("dialog", { name: "技能结构：民商事诉讼大师" }),
    ).toBeTruthy();
    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("market_skill_tree", {
        name: "civil-litigation-master",
      });
    });
  });

  it("添加技能 opens the shared skill market dialog", async () => {
    const onOpen = vi.fn();
    window.addEventListener(OPEN_SKILL_MARKET_EVENT, onOpen as EventListener);
    try {
      render(<LawhubNavSection {...props} />);
      fireEvent.click(screen.getByRole("button", { name: "lawhub" }));
      fireEvent.click(await screen.findByText("添加技能"));
      expect(onOpen).toHaveBeenCalledTimes(1);
    } finally {
      window.removeEventListener(
        OPEN_SKILL_MARKET_EVENT,
        onOpen as EventListener,
      );
    }
  });

  it("refreshes the installed list when a market install completes", async () => {
    let installed: Record<string, unknown> = {};
    vi.mocked(invoke).mockImplementation(async (cmd: string) => {
      if (cmd === "market_list_installed") return installed;
      return undefined;
    });

    render(<LawhubNavSection {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "lawhub" }));
    await screen.findByText("技能");
    expect(screen.queryByText("民商事诉讼大师")).toBeNull();

    installed = {
      "civil-litigation-master": {
        skill_id: 1,
        version: 3,
        installed_at: 100,
        display_name: "民商事诉讼大师",
      },
    };
    fireEvent(
      window,
      new CustomEvent(SKILL_INSTALLED_EVENT, {
        detail: { name: "civil-litigation-master" },
      }),
    );

    expect(await screen.findByText("民商事诉讼大师")).toBeTruthy();
  });
});
