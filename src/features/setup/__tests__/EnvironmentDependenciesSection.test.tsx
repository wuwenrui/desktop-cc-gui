/** @vitest-environment jsdom */
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  EnvironmentDoctorResult,
  EnvironmentInstallPlan,
  EnvironmentInstallProgressEvent,
  EnvironmentInstallResult,
} from "@/types";
import {
  getEnvironmentDoctor,
  getEnvironmentInstallPlan,
  retryEnvironmentInstallerStep,
  runEnvironmentInstaller,
} from "@/services/tauri";
import { subscribeEnvironmentInstallerEvents } from "@/services/events";
import { EnvironmentDependenciesSection } from "../EnvironmentDependenciesSection";

vi.mock("@/services/tauri", () => ({
  getEnvironmentDoctor: vi.fn(),
  getEnvironmentInstallPlan: vi.fn(),
  retryEnvironmentInstallerStep: vi.fn(),
  runEnvironmentInstaller: vi.fn(),
}));

vi.mock("@/services/events", () => ({
  subscribeEnvironmentInstallerEvents: vi.fn(() => vi.fn()),
}));

describe("EnvironmentDependenciesSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(subscribeEnvironmentInstallerEvents).mockReturnValue(vi.fn());
    vi.mocked(getEnvironmentInstallPlan).mockResolvedValue(planEmpty());
  });

  it("renders nothing when not the active sub-tab", () => {
    vi.mocked(getEnvironmentDoctor).mockResolvedValue(doctorReady());
    const { container } = render(<EnvironmentDependenciesSection active={false} />);
    expect(container.firstChild).toBeNull();
  });

  it("lists every dependency with its installed status", async () => {
    vi.mocked(getEnvironmentDoctor).mockResolvedValue(doctorReady());

    render(<EnvironmentDependenciesSection active />);

    await waitFor(() => expect(getEnvironmentDoctor).toHaveBeenCalled());
    expect(await screen.findByText("homebrew")).toBeTruthy();
    expect(screen.getAllByText("已安装").length).toBeGreaterThanOrEqual(1);
  });

  it("shows the install plan and a TTY hint when Homebrew is missing", async () => {
    vi.mocked(getEnvironmentDoctor).mockResolvedValue(doctorMissingHomebrew());
    vi.mocked(getEnvironmentInstallPlan).mockResolvedValue(planMissingHomebrew());

    render(<EnvironmentDependenciesSection active />);

    expect(await screen.findByText(/安装 Homebrew/)).toBeTruthy();
    expect(screen.getAllByText(/TUNA/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/已在终端启动/)).toBeTruthy();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "安装全部" })).toBeTruthy(),
    );
  });

  it("re-runs doctor when 检查依赖 is clicked", async () => {
    vi.mocked(getEnvironmentDoctor).mockResolvedValue(doctorReady());

    render(<EnvironmentDependenciesSection active />);

    await waitFor(() => expect(getEnvironmentDoctor).toHaveBeenCalledTimes(1));
    fireEvent.click(await screen.findByRole("button", { name: "检查依赖" }));
    await waitFor(() => expect(getEnvironmentDoctor).toHaveBeenCalledTimes(2));
  });

  it("streams progress while installing", async () => {
    let progressHandler: (event: EnvironmentInstallProgressEvent) => void = () => {};
    vi.mocked(subscribeEnvironmentInstallerEvents).mockImplementation((handler) => {
      progressHandler = handler;
      return vi.fn();
    });
    vi.mocked(getEnvironmentDoctor).mockResolvedValue(doctorMissingHomebrew());
    vi.mocked(getEnvironmentInstallPlan).mockResolvedValue(planMissingHomebrew());
    let resolveInstall: (result: EnvironmentInstallResult) => void = () => {};
    vi.mocked(runEnvironmentInstaller).mockImplementation(
      () =>
        new Promise<EnvironmentInstallResult>((resolve) => {
          resolveInstall = resolve;
        }),
    );

    render(<EnvironmentDependenciesSection active />);

    fireEvent.click(await screen.findByRole("button", { name: "安装全部" }));
    await act(async () => {
      progressHandler({
        runId: "environment-bootstrap",
        stepId: "install-homebrew",
        dependencyId: "homebrew",
        phase: "stdout",
        stream: "stdout",
        message: "Downloading Homebrew",
        exitCode: null,
        durationMs: 5,
      });
    });

    expect(await screen.findByText(/Downloading Homebrew/)).toBeTruthy();

    // After a successful run the plan is refreshed to an empty one, so steps drop out.
    vi.mocked(getEnvironmentInstallPlan).mockResolvedValue(planEmpty());
    await act(async () => {
      resolveInstall({
        ok: true,
        exitCode: 0,
        details: null,
        durationMs: 10,
        doctorResult: doctorReady(),
      });
    });

    await waitFor(() =>
      expect(screen.queryByText(/安装 Homebrew/)).toBeNull(),
    );
  });

  it("surfaces install failures", async () => {
    vi.mocked(getEnvironmentDoctor).mockResolvedValue(doctorMissingHomebrew());
    vi.mocked(getEnvironmentInstallPlan).mockResolvedValue(planMissingHomebrew());
    vi.mocked(runEnvironmentInstaller).mockResolvedValue({
      ok: false,
      exitCode: 1,
      details: "Homebrew mirror unreachable",
      durationMs: 10,
      doctorResult: doctorMissingHomebrew(),
    });

    render(<EnvironmentDependenciesSection active />);

    fireEvent.click(await screen.findByRole("button", { name: "安装全部" }));
    expect(await screen.findByText("Homebrew mirror unreachable")).toBeTruthy();
  });

  it("retries a single failed step via the per-step command", async () => {
    let progressHandler: (event: EnvironmentInstallProgressEvent) => void = () => {};
    vi.mocked(subscribeEnvironmentInstallerEvents).mockImplementation((handler) => {
      progressHandler = handler;
      return vi.fn();
    });
    vi.mocked(getEnvironmentDoctor).mockResolvedValue(doctorMissingHomebrew());
    vi.mocked(getEnvironmentInstallPlan).mockResolvedValue(planMissingHomebrew());
    vi.mocked(runEnvironmentInstaller).mockResolvedValue({
      ok: false,
      exitCode: 1,
      details: "Homebrew step failed",
      durationMs: 10,
      doctorResult: doctorMissingHomebrew(),
    });
    vi.mocked(retryEnvironmentInstallerStep).mockResolvedValue({
      ok: true,
      exitCode: 0,
      details: null,
      durationMs: 10,
      doctorResult: doctorReady(),
    });

    render(<EnvironmentDependenciesSection active />);

    fireEvent.click(await screen.findByRole("button", { name: "安装全部" }));
    await screen.findByText("Homebrew step failed");

    await act(async () => {
      progressHandler({
        runId: "environment-bootstrap",
        stepId: "install-homebrew",
        dependencyId: "homebrew",
        phase: "error",
        stream: null,
        message: "boom",
        exitCode: null,
        durationMs: 5,
      });
    });

    // A fresh empty plan is returned after the retry succeeds.
    vi.mocked(getEnvironmentInstallPlan).mockResolvedValue(planEmpty());
    fireEvent.click(await screen.findByRole("button", { name: "重试此步" }));

    await waitFor(() =>
      expect(retryEnvironmentInstallerStep).toHaveBeenCalledWith(
        "install-homebrew",
        "environment-bootstrap",
      ),
    );
  });
});

function doctorReady(): EnvironmentDoctorResult {
  return {
    platform: "macos",
    dependencies: [
      status("xcodeCommandLineTools", true, false),
      status("homebrew", true, false),
      status("cmake", true, false),
      status("claudeCli", true, false),
      status("codexCli", false, false),
    ],
  };
}

function doctorMissingHomebrew(): EnvironmentDoctorResult {
  return {
    platform: "macos",
    dependencies: [
      status("xcodeCommandLineTools", true, false),
      status("homebrew", false, false),
      status("cmake", false, false),
      status("claudeCli", false, false),
      status("codexCli", false, false),
    ],
  };
}

function planEmpty(): EnvironmentInstallPlan {
  return {
    platform: "macos",
    canRun: true,
    blockers: [],
    warnings: [],
    steps: [],
  };
}

function planMissingHomebrew(): EnvironmentInstallPlan {
  return {
    platform: "macos",
    canRun: true,
    blockers: [],
    warnings: [],
    steps: [
      {
        id: "install-homebrew",
        dependencyId: "homebrew",
        label: "安装 Homebrew",
        commandPreview: [
          "git",
          "clone",
          "https://mirrors.tuna.tsinghua.edu.cn/git/homebrew/install.git",
        ],
        environment: [
          [
            "HOMEBREW_API_DOMAIN",
            "https://mirrors.tuna.tsinghua.edu.cn/homebrew-bottles/api",
          ],
        ],
        manualFallback: "manual brew install",
        warnings: ["TUNA 国内源"],
        requiresTty: true,
      },
    ],
  };
}

function status(
  id: EnvironmentDoctorResult["dependencies"][number]["id"],
  installed: boolean,
  required = false,
) {
  return {
    id,
    label: id,
    installed,
    required,
    version: installed ? "1.0.0" : null,
    details: null,
    installable: true,
  };
}
