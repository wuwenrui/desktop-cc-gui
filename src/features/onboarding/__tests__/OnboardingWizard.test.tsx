/** @vitest-environment jsdom */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { OnboardingWizard } from "../OnboardingWizard";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

// Avoid a real network/Tauri call on the key step; return one usable model.
// Paths are relative to THIS test file (under onboarding/__tests__/).
vi.mock("../../../services/tauri/vendors", () => ({
  fetchSiteModels: vi.fn(async () => [{ id: "claude-sonnet", label: "Sonnet" }]),
}));

// Stub the model picker so the test can drive the second step's confirm
// without reproducing the picker UI.
vi.mock("../../vendors/components/SiteModelPicker", () => ({
  SiteModelPicker: ({
    onConfirm,
  }: {
    onConfirm: (slots: { sonnet: string; haiku: string; opus: string }, codex: string[]) => void;
  }) => (
    <button
      type="button"
      onClick={() =>
        onConfirm({ sonnet: "claude-sonnet", haiku: "claude-sonnet", opus: "claude-sonnet" }, [])
      }
    >
      confirm-models
    </button>
  ),
}));

describe("OnboardingWizard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the new-api key input", () => {
    render(<OnboardingWizard onDone={vi.fn()} />);
    expect(screen.getByLabelText("new-api key")).toBeTruthy();
  });

  it("disables Next until a key is entered", () => {
    render(<OnboardingWizard onDone={vi.fn()} />);
    const next = screen.getByRole("button", { name: "Next" }) as HTMLButtonElement;
    expect(next.disabled).toBe(true);

    fireEvent.change(screen.getByLabelText("new-api key"), {
      target: { value: "sk-test" },
    });
    expect(next.disabled).toBe(false);
  });

  it("lets the user skip setup and enter the app", () => {
    const onDone = vi.fn();
    render(<OnboardingWizard onDone={onDone} />);
    fireEvent.click(screen.getByRole("button", { name: /skip for now/i }));
    expect(onDone).toHaveBeenCalledTimes(1);
    // Skipping must not provision a provider.
    expect(vi.mocked(invoke)).not.toHaveBeenCalledWith(
      "vendor_add_claude_provider",
      expect.anything(),
    );
  });

  it("provisions provider, installs skills, then calls onDone", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockResolvedValue(undefined);
    const onDone = vi.fn();
    render(<OnboardingWizard onDone={onDone} />);

    fireEvent.change(screen.getByLabelText("new-api key"), {
      target: { value: "sk-test" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    // Second step: confirm model selection via the stubbed picker.
    fireEvent.click(await screen.findByRole("button", { name: "confirm-models" }));

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
  });

  it("shows an error and does not call onDone when provisioning fails", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockRejectedValue("boom");
    const onDone = vi.fn();
    render(<OnboardingWizard onDone={onDone} />);

    fireEvent.change(screen.getByLabelText("new-api key"), {
      target: { value: "sk-test" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(await screen.findByRole("button", { name: "confirm-models" }));

    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    expect(onDone).not.toHaveBeenCalled();
  });
});
