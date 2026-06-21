// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  subscribeRuntimeLogExited,
  subscribeRuntimeLogStatus,
  subscribeTerminalOutput,
  type TerminalOutputEvent,
} from "../../../services/events";
import {
  closeTerminalSession,
  openTerminalSession,
  runtimeLogDetectProfiles,
  runtimeLogGetSession,
  runtimeLogMarkExit,
  runtimeLogStart,
  runtimeLogStop,
  writeTerminalSession,
} from "../../../services/tauri";
import type { WorkspaceInfo } from "../../../types";
import { useRuntimeLogSession } from "./useRuntimeLogSession";

vi.mock("../../../services/tauri", () => ({
  openTerminalSession: vi.fn(),
  writeTerminalSession: vi.fn(),
  closeTerminalSession: vi.fn(),
  runtimeLogDetectProfiles: vi.fn(),
  runtimeLogStart: vi.fn(),
  runtimeLogStop: vi.fn(),
  runtimeLogGetSession: vi.fn(),
  runtimeLogMarkExit: vi.fn(),
}));

vi.mock("../../../services/events", () => ({
  subscribeTerminalOutput: vi.fn(),
  subscribeRuntimeLogStatus: vi.fn(),
  subscribeRuntimeLogExited: vi.fn(),
}));

const workspace: WorkspaceInfo = {
  id: "workspace-1",
  name: "Workspace",
  path: "/tmp/workspace",
  connected: true,
  settings: { sidebarCollapsed: false },
};

let terminalOutputListener: ((event: TerminalOutputEvent) => void) | null = null;

function emitRuntimeOutput(
  data: string,
  overrides: Partial<TerminalOutputEvent> = {},
) {
  terminalOutputListener?.({
    workspaceId: workspace.id,
    terminalId: "runtime-console",
    data,
    ...overrides,
  });
}

beforeEach(() => {
  terminalOutputListener = null;
  vi.useFakeTimers();
  vi.clearAllMocks();
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) =>
    window.setTimeout(() => callback(performance.now()), 16),
  );
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation((handle) => {
    window.clearTimeout(handle);
  });
  vi.mocked(openTerminalSession).mockResolvedValue({ id: "runtime-console" });
  vi.mocked(writeTerminalSession).mockResolvedValue(undefined);
  vi.mocked(closeTerminalSession).mockResolvedValue(undefined);
  vi.mocked(runtimeLogDetectProfiles).mockImplementation(
    () => new Promise(() => undefined),
  );
  vi.mocked(runtimeLogStart).mockResolvedValue({
    workspaceId: workspace.id,
    terminalId: "runtime-console",
    status: "running",
    commandPreview: "pnpm dev",
    startedAtMs: Date.now(),
    stoppedAtMs: null,
    exitCode: null,
    error: null,
  });
  vi.mocked(runtimeLogStop).mockResolvedValue({
    workspaceId: workspace.id,
    terminalId: "runtime-console",
    status: "stopped",
    commandPreview: "pnpm dev",
    startedAtMs: Date.now(),
    stoppedAtMs: Date.now(),
    exitCode: 130,
    error: null,
  });
  vi.mocked(runtimeLogGetSession).mockResolvedValue(null);
  vi.mocked(runtimeLogMarkExit).mockResolvedValue({
    workspaceId: workspace.id,
    terminalId: "runtime-console",
    status: "stopped",
    commandPreview: "pnpm dev",
    startedAtMs: Date.now(),
    stoppedAtMs: Date.now(),
    exitCode: 0,
    error: null,
  });
  vi.mocked(subscribeTerminalOutput).mockImplementation((listener) => {
    terminalOutputListener = listener;
    return () => {
      terminalOutputListener = null;
    };
  });
  vi.mocked(subscribeRuntimeLogStatus).mockImplementation(() => () => undefined);
  vi.mocked(subscribeRuntimeLogExited).mockImplementation(() => () => undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("useRuntimeLogSession", () => {
  it("keeps the returned runtime state reference stable when session state is unchanged", async () => {
    const { result, rerender } = renderHook(
      ({ activeWorkspace }) => useRuntimeLogSession({ activeWorkspace }),
      { initialProps: { activeWorkspace: workspace } },
    );

    expect(result.current.runtimeCommandPresetOptions).toEqual(["auto", "custom"]);

    const previousRuntimeState = result.current;

    rerender({ activeWorkspace: workspace });

    expect(result.current).toBe(previousRuntimeState);
  });

  it("coalesces runtime terminal output chunks within one animation frame", async () => {
    const { result } = renderHook(() =>
      useRuntimeLogSession({ activeWorkspace: workspace }),
    );

    expect(terminalOutputListener).toBeTypeOf("function");

    act(() => {
      for (let index = 0; index < 10; index += 1) {
        emitRuntimeOutput(`line-${index}\n`);
      }
    });

    expect(result.current.runtimeConsoleLog).toBe("");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(16);
    });

    expect(result.current.runtimeConsoleVisible).toBe(true);
    expect(result.current.runtimeConsoleStatus).toBe("running");
    expect(result.current.runtimeConsoleLog).toBe(
      Array.from({ length: 10 }, (_, index) => `line-${index}\n`).join(""),
    );
  });

  it("ignores runtime terminal output without a workspace id or data", async () => {
    const { result } = renderHook(() =>
      useRuntimeLogSession({ activeWorkspace: workspace }),
    );

    act(() => {
      emitRuntimeOutput("missing workspace\n", { workspaceId: "" });
      emitRuntimeOutput("");
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(16);
    });

    expect(result.current.runtimeConsoleLog).toBe("");
    expect(result.current.runtimeConsoleStatus).toBe("idle");
  });

  it("falls back to a timer flush when requestAnimationFrame is unavailable", async () => {
    const originalRequestAnimationFrame = window.requestAnimationFrame;
    const originalCancelAnimationFrame = window.cancelAnimationFrame;
    Object.defineProperty(window, "requestAnimationFrame", {
      configurable: true,
      writable: true,
      value: undefined,
    });
    Object.defineProperty(window, "cancelAnimationFrame", {
      configurable: true,
      writable: true,
      value: undefined,
    });

    try {
      const { result } = renderHook(() =>
        useRuntimeLogSession({ activeWorkspace: workspace }),
      );

      act(() => {
        emitRuntimeOutput("fallback output\n");
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      expect(result.current.runtimeConsoleLog).toBe("fallback output\n");
      expect(result.current.runtimeConsoleStatus).toBe("running");
    } finally {
      Object.defineProperty(window, "requestAnimationFrame", {
        configurable: true,
        writable: true,
        value: originalRequestAnimationFrame,
      });
      Object.defineProperty(window, "cancelAnimationFrame", {
        configurable: true,
        writable: true,
        value: originalCancelAnimationFrame,
      });
    }
  });

  it("cancels pending output flushes on cleanup", async () => {
    const { result, unmount } = renderHook(() =>
      useRuntimeLogSession({ activeWorkspace: workspace }),
    );

    expect(terminalOutputListener).toBeTypeOf("function");

    act(() => {
      emitRuntimeOutput("late output\n");
    });

    unmount();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(16);
    });

    expect(result.current.runtimeConsoleLog).toBe("");
    expect(window.cancelAnimationFrame).toHaveBeenCalledTimes(1);
  });
});
