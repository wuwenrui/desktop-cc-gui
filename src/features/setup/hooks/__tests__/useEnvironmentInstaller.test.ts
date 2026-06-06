/** @vitest-environment jsdom */
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  EnvironmentDoctorResult,
  EnvironmentInstallPlan,
  EnvironmentInstallProgressEvent,
} from "@/types";
import {
  getEnvironmentDoctor,
  getEnvironmentInstallPlan,
} from "@/services/tauri";
import { subscribeEnvironmentInstallerEvents } from "@/services/events";
import { useEnvironmentInstaller } from "../useEnvironmentInstaller";

vi.mock("@/services/tauri", () => ({
  getEnvironmentDoctor: vi.fn(),
  getEnvironmentInstallPlan: vi.fn(),
  retryEnvironmentInstallerStep: vi.fn(),
  runEnvironmentInstaller: vi.fn(),
}));

vi.mock("@/services/events", () => ({
  subscribeEnvironmentInstallerEvents: vi.fn(() => vi.fn()),
}));

describe("useEnvironmentInstaller", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(subscribeEnvironmentInstallerEvents).mockReturnValue(vi.fn());
  });

  it("reaches ready when the plan has no steps", async () => {
    vi.mocked(getEnvironmentDoctor).mockResolvedValue(doctor(true));
    vi.mocked(getEnvironmentInstallPlan).mockResolvedValue(plan([]));

    const { result } = renderHook(() => useEnvironmentInstaller());

    await waitFor(() => expect(result.current.phase).toBe("ready"));
  });

  it("reaches missing when the plan has outstanding steps", async () => {
    vi.mocked(getEnvironmentDoctor).mockResolvedValue(doctor(false));
    vi.mocked(getEnvironmentInstallPlan).mockResolvedValue(
      plan(["install-homebrew"]),
    );

    const { result } = renderHook(() => useEnvironmentInstaller());

    await waitFor(() => expect(result.current.phase).toBe("missing"));
    expect(result.current.plan?.steps).toHaveLength(1);
  });

  it("truncates the streamed log buffer to 80 lines", async () => {
    let progressHandler: (event: EnvironmentInstallProgressEvent) => void = () => {};
    vi.mocked(subscribeEnvironmentInstallerEvents).mockImplementation((handler) => {
      progressHandler = handler;
      return vi.fn();
    });
    vi.mocked(getEnvironmentDoctor).mockResolvedValue(doctor(true));
    vi.mocked(getEnvironmentInstallPlan).mockResolvedValue(plan([]));

    const { result } = renderHook(() => useEnvironmentInstaller());
    await waitFor(() => expect(result.current.phase).toBe("ready"));

    await act(async () => {
      for (let index = 0; index < 100; index += 1) {
        progressHandler({
          runId: "environment-bootstrap",
          stepId: "install-homebrew",
          dependencyId: "homebrew",
          phase: "stdout",
          stream: "stdout",
          message: `line ${index}`,
          exitCode: null,
          durationMs: index,
        });
      }
    });

    expect(result.current.logLines).toHaveLength(80);
    expect(result.current.logLines.at(-1)).toContain("line 99");
  });

  it("ignores progress events from a different run id", async () => {
    let progressHandler: (event: EnvironmentInstallProgressEvent) => void = () => {};
    vi.mocked(subscribeEnvironmentInstallerEvents).mockImplementation((handler) => {
      progressHandler = handler;
      return vi.fn();
    });
    vi.mocked(getEnvironmentDoctor).mockResolvedValue(doctor(true));
    vi.mocked(getEnvironmentInstallPlan).mockResolvedValue(plan([]));

    const { result } = renderHook(() => useEnvironmentInstaller());
    await waitFor(() => expect(result.current.phase).toBe("ready"));

    await act(async () => {
      progressHandler({
        runId: "other-run",
        stepId: "install-homebrew",
        dependencyId: "homebrew",
        phase: "stdout",
        stream: "stdout",
        message: "noise",
        exitCode: null,
        durationMs: 1,
      });
    });

    expect(result.current.logLines).toHaveLength(0);
  });
});

function doctor(installed: boolean): EnvironmentDoctorResult {
  return {
    platform: "macos",
    dependencies: [
      {
        id: "homebrew",
        label: "Homebrew",
        installed,
        required: false,
        version: installed ? "4.0.0" : null,
        details: null,
        installable: true,
      },
    ],
  };
}

function plan(stepIds: string[]): EnvironmentInstallPlan {
  return {
    platform: "macos",
    canRun: true,
    blockers: [],
    warnings: [],
    steps: stepIds.map((id) => ({
      id,
      dependencyId: "homebrew",
      label: id,
      commandPreview: [],
      environment: [],
      manualFallback: null,
      warnings: [],
      requiresTty: false,
    })),
  };
}
