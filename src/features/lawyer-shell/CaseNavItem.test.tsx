/** @vitest-environment jsdom */
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CaseNavItem } from "./CaseNavItem";
import { getClientStoreSync } from "../../services/clientStorage";

vi.mock("../../services/tauri/workspaceRuntime", () => ({
  ensureWorkspacePathDir: vi.fn(),
}));
vi.mock("../../services/clientStorage", () => ({
  getClientStoreSync: vi.fn(),
  writeClientStoreValue: vi.fn(),
}));
vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(),
}));

beforeEach(() => {
  vi.mocked(getClientStoreSync).mockReturnValue(undefined);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("CaseNavItem", () => {
  it("renders the nav entry without the overlay", () => {
    render(<CaseNavItem />);
    expect(screen.getByRole("button", { name: "我的案件" })).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("opens the case home overlay on click and closes it", () => {
    render(<CaseNavItem />);
    fireEvent.click(screen.getByRole("button", { name: "我的案件" }));
    expect(screen.getByRole("dialog", { name: "我的案件" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "我的案件" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "关闭" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
