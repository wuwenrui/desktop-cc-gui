/** @vitest-environment jsdom */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LawhubNavSection } from "./LawhubNavSection";
import { PPT_SKILL_NAME, SELECT_SKILL_EVENT } from "../pptSkill";
import { getWorkspaceFiles, readWorkspaceFile } from "../../../services/tauri";
import { openWorkspaceIn } from "../../../services/tauri/workspaceRuntime";
import { publishScheme, setLawhubToken } from "../../scheme-publish/api";

const BASE = "https://hub.example.com";

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
  workspacePath: "/ws",
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

  it("clicking a file name previews it in the system browser", async () => {
    render(<LawhubNavSection {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "lawhub" }));
    fireEvent.click(await screen.findByText("deck.html"));
    await waitFor(() =>
      expect(openWorkspaceIn).toHaveBeenCalledWith("/ws/deck.html", {}),
    );
  });

  it("发布 with a token publishes and opens the viewer url", async () => {
    setLawhubToken("tok-1");
    render(<LawhubNavSection {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "lawhub" }));
    await screen.findByText("deck.html");
    fireEvent.click(screen.getByTitle("发布到 lawhub 协作批注"));
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

  it("发布 without a token reveals an inline login form and does not publish", async () => {
    render(<LawhubNavSection {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "lawhub" }));
    await screen.findByText("deck.html");
    fireEvent.click(screen.getByTitle("发布到 lawhub 协作批注"));
    expect(await screen.findByLabelText("lawhub 用户名")).toBeTruthy();
    expect(publishScheme).not.toHaveBeenCalled();
  });
});
