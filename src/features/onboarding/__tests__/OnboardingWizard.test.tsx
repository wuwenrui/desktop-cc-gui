/** @vitest-environment jsdom */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { OnboardingWizard } from "../OnboardingWizard";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

describe("OnboardingWizard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the new-api key input", () => {
    render(<OnboardingWizard onDone={vi.fn()} />);
    expect(screen.getByLabelText("new-api key")).toBeTruthy();
  });

  it("disables the finish button until a key is entered", () => {
    render(<OnboardingWizard onDone={vi.fn()} />);
    const finish = screen.getByRole("button", { name: "完成" }) as HTMLButtonElement;
    expect(finish.disabled).toBe(true);

    fireEvent.change(screen.getByLabelText("new-api key"), {
      target: { value: "sk-test" },
    });
    expect(finish.disabled).toBe(false);
  });

  it("provisions provider, installs skills, then calls onDone (no crawler url)", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockResolvedValue(undefined);
    const onDone = vi.fn();
    render(<OnboardingWizard onDone={onDone} />);

    fireEvent.change(screen.getByLabelText("new-api key"), {
      target: { value: "sk-test" },
    });
    fireEvent.click(screen.getByRole("button", { name: "完成" }));

    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));

    expect(invokeMock).toHaveBeenCalledWith("vendor_add_claude_provider", {
      provider: {
        id: "new-api",
        name: "New API",
        settingsConfig: {
          env: expect.objectContaining({ ANTHROPIC_AUTH_TOKEN: "sk-test" }),
        },
      },
    });
    expect(invokeMock).toHaveBeenCalledWith("vendor_switch_claude_provider", {
      id: "new-api",
    });
    expect(invokeMock).toHaveBeenCalledWith("install_bundled_skills");
    expect(invokeMock).not.toHaveBeenCalledWith(
      "write_court_crawler_mcp",
      expect.anything(),
    );
  });

  it("shows an error and does not call onDone when provisioning fails", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockRejectedValue("boom");
    const onDone = vi.fn();
    render(<OnboardingWizard onDone={onDone} />);

    fireEvent.change(screen.getByLabelText("new-api key"), {
      target: { value: "sk-test" },
    });
    fireEvent.click(screen.getByRole("button", { name: "完成" }));

    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    expect(onDone).not.toHaveBeenCalled();
  });
});
