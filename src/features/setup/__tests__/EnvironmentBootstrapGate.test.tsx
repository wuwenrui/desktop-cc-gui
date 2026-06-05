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
  runEnvironmentInstaller,
} from "@/services/tauri";
import { subscribeEnvironmentInstallerEvents } from "@/services/events";
import { EnvironmentBootstrapGate } from "../EnvironmentBootstrapGate";

vi.mock("@/services/tauri", () => ({
  getEnvironmentDoctor: vi.fn(),
  getEnvironmentInstallPlan: vi.fn(),
  runEnvironmentInstaller: vi.fn(),
}));

vi.mock("@/services/events", () => ({
  subscribeEnvironmentInstallerEvents: vi.fn(() => vi.fn()),
}));

describe("EnvironmentBootstrapGate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(subscribeEnvironmentInstallerEvents).mockReturnValue(vi.fn());
  });

  it("renders children when required dependencies are installed", async () => {
    vi.mocked(getEnvironmentDoctor).mockResolvedValue(doctorReady());

    render(
      <EnvironmentBootstrapGate>
        <div>APP_READY</div>
      </EnvironmentBootstrapGate>,
    );

    await waitFor(() => expect(screen.getByText("APP_READY")).toBeTruthy());
  });

  it("shows a Homebrew-first install plan when Homebrew is missing", async () => {
    vi.mocked(getEnvironmentDoctor).mockResolvedValue(doctorMissingHomebrew());
    vi.mocked(getEnvironmentInstallPlan).mockResolvedValue(planMissingHomebrew());

    render(
      <EnvironmentBootstrapGate>
        <div>APP_READY</div>
      </EnvironmentBootstrapGate>,
    );

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "开始安装" })).toBeTruthy(),
    );
    expect(screen.getAllByText(/安装 Homebrew/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/TUNA/).length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText("APP_READY")).toBeNull();
  });

  it("renders progress events while installation is running", async () => {
    let progressHandler: (event: EnvironmentInstallProgressEvent) => void = () => {};
    vi.mocked(subscribeEnvironmentInstallerEvents).mockImplementation((handler) => {
      progressHandler = handler;
      return vi.fn();
    });
    vi.mocked(getEnvironmentDoctor)
      .mockResolvedValueOnce(doctorMissingHomebrew())
      .mockResolvedValueOnce(doctorReady());
    vi.mocked(getEnvironmentInstallPlan).mockResolvedValue(planMissingHomebrew());
    let resolveInstall: (result: EnvironmentInstallResult) => void = () => {};
    vi.mocked(runEnvironmentInstaller).mockImplementation(
      () =>
        new Promise<EnvironmentInstallResult>((resolve) => {
          resolveInstall = resolve;
        }),
    );

    render(
      <EnvironmentBootstrapGate>
        <div>APP_READY</div>
      </EnvironmentBootstrapGate>,
    );

    fireEvent.click(await screen.findByRole("button", { name: "开始安装" }));
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

    await act(async () => {
      resolveInstall({
          ok: true,
          exitCode: 0,
          details: null,
          durationMs: 10,
          doctorResult: doctorReady(),
      });
    });

    await waitFor(() => expect(screen.getByText("APP_READY")).toBeTruthy());
  });

  it("shows retry when installation fails", async () => {
    vi.mocked(getEnvironmentDoctor).mockResolvedValue(doctorMissingHomebrew());
    vi.mocked(getEnvironmentInstallPlan).mockResolvedValue(planMissingHomebrew());
    vi.mocked(runEnvironmentInstaller).mockResolvedValue({
      ok: false,
      exitCode: 1,
      details: "Homebrew mirror unreachable",
      durationMs: 10,
      doctorResult: doctorMissingHomebrew(),
    });

    render(
      <EnvironmentBootstrapGate>
        <div>APP_READY</div>
      </EnvironmentBootstrapGate>,
    );

    fireEvent.click(await screen.findByRole("button", { name: "开始安装" }));

    expect(await screen.findByText("Homebrew mirror unreachable")).toBeTruthy();
    expect(screen.getByRole("button", { name: "重试" })).toBeTruthy();
  });
});

function doctorReady(): EnvironmentDoctorResult {
  return {
    platform: "macos",
    dependencies: [
      status("xcodeCommandLineTools", true),
      status("homebrew", true),
      status("cmake", true),
      status("openssl3", true),
      status("claudeCli", true),
      status("codexCli", false, false),
    ],
  };
}

function doctorMissingHomebrew(): EnvironmentDoctorResult {
  return {
    platform: "macos",
    dependencies: [
      status("xcodeCommandLineTools", true),
      status("homebrew", false),
      status("cmake", false),
      status("openssl3", false),
      status("claudeCli", true),
      status("codexCli", false, false),
    ],
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
        commandPreview: ["git", "clone", "https://mirrors.tuna.tsinghua.edu.cn/git/homebrew/install.git"],
        environment: [
          ["HOMEBREW_API_DOMAIN", "https://mirrors.tuna.tsinghua.edu.cn/homebrew-bottles/api"],
        ],
        manualFallback: "manual brew install",
        warnings: ["TUNA 国内源"],
      },
    ],
  };
}

function status(
  id: EnvironmentDoctorResult["dependencies"][number]["id"],
  installed: boolean,
  required = true,
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
