/** @vitest-environment jsdom */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { DependencyGate } from "../DependencyGate";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

describe("DependencyGate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders children when the CLI is already installed", async () => {
    vi.mocked(invoke).mockResolvedValue({ installed: true, version: "1.2.3" });
    render(
      <DependencyGate>
        <div>CHILD</div>
      </DependencyGate>,
    );

    await waitFor(() => expect(screen.getByText("CHILD")).toBeTruthy());
  });

  it("shows the auto-install button when the CLI is missing", async () => {
    vi.mocked(invoke).mockResolvedValue({ installed: false });
    render(
      <DependencyGate>
        <div>CHILD</div>
      </DependencyGate>,
    );

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "一键自动安装" })).toBeTruthy(),
    );
    expect(screen.queryByText("CHILD")).toBeNull();
  });

  it("invokes install_claude_cli when the auto-install button is clicked", async () => {
    const invokeMock = vi.mocked(invoke);
    // First check → missing; install → ok; re-check → still missing (needs restart).
    invokeMock
      .mockResolvedValueOnce({ installed: false })
      .mockResolvedValueOnce("1.2.3")
      .mockResolvedValueOnce({ installed: false });

    render(
      <DependencyGate>
        <div>CHILD</div>
      </DependencyGate>,
    );

    const button = await screen.findByRole("button", { name: "一键自动安装" });
    fireEvent.click(button);

    await waitFor(() =>
      expect(invokeMock).toHaveBeenCalledWith("install_claude_cli"),
    );
  });
});
