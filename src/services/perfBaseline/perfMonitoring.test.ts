// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// 用可捕获的假实现替换 rendererDiagnostics,避免碰真实持久化 store。
const { appendMock, exportState } = vi.hoisted(() => ({
  appendMock: vi.fn(),
  exportState: {
    entries: [] as Array<{
      timestamp: number;
      label: string;
      payload: Record<string, unknown>;
    }>,
  },
}));

vi.mock("../rendererDiagnostics", () => ({
  appendRendererDiagnostic: appendMock,
  exportRendererDiagnostics: () => exportState.entries,
}));

import {
  __resetPerfContextBridgeForTests,
  installPerfInteractionTracking,
  notePerfInteraction,
  readPerfContext,
  setPerfStreamingState,
  uninstallPerfInteractionTracking,
} from "./perfContextBridge";
import {
  __resetFrameDropMonitorForTests,
  startFrameDropMonitor,
  startLongTaskObserver,
  stopFrameDropMonitor,
} from "./frameDropMonitor";
import { buildDiagnosticsReportText } from "./diagnosticsReport";
import {
  __resetReactScanRenderLogForTests,
  getRecentReactScanRenderSummary,
  recordReactScanRender,
} from "./reactScanRenderLog";

describe("perfContextBridge", () => {
  beforeEach(() => {
    __resetPerfContextBridgeForTests();
    appendMock.mockClear();
  });

  it("stores and reads streaming state", () => {
    setPerfStreamingState({
      isStreaming: true,
      streamActivityPhase: "generating",
      visibleRowCount: 42,
    });
    const snapshot = readPerfContext();
    expect(snapshot.isStreaming).toBe(true);
    expect(snapshot.streamActivityPhase).toBe("generating");
    expect(snapshot.visibleRowCount).toBe(42);
  });

  it("records the most recent interaction with a non-negative age", () => {
    notePerfInteraction("pointer");
    const snapshot = readPerfContext();
    expect(snapshot.lastInteractionLabel).toBe("pointer");
    expect(snapshot.lastInteractionAgoMs ?? -1).toBeGreaterThanOrEqual(0);
  });

  it("tracks DOM interactions once installed and detaches on reset", () => {
    installPerfInteractionTracking();
    window.dispatchEvent(new Event("pointerdown"));
    expect(readPerfContext().lastInteractionLabel).toBe("pointer");

    __resetPerfContextBridgeForTests();
    window.dispatchEvent(new Event("keydown"));
    expect(readPerfContext().lastInteractionLabel).toBeNull();
    uninstallPerfInteractionTracking();
  });
});

describe("frameDropMonitor", () => {
  let now = 0;
  let rafCallbacks: FrameRequestCallback[] = [];

  beforeEach(() => {
    now = 1000; // 起点远大于节流窗,模拟应用已运行一段时间
    rafCallbacks = [];
    appendMock.mockClear();
    __resetPerfContextBridgeForTests();
    __resetFrameDropMonitorForTests();
    vi.spyOn(performance, "now").mockImplementation(() => now);
    vi.spyOn(window, "requestAnimationFrame").mockImplementation(
      (cb: FrameRequestCallback) => {
        rafCallbacks.push(cb);
        return rafCallbacks.length;
      },
    );
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);
  });

  afterEach(() => {
    stopFrameDropMonitor();
    vi.restoreAllMocks();
  });

  function advance(deltaMs: number) {
    now += deltaMs;
    const pending = rafCallbacks;
    rafCallbacks = [];
    for (const cb of pending) {
      cb(now);
    }
  }

  it("reports a severe frame drop with context on a >100ms frame", () => {
    setPerfStreamingState({
      isStreaming: true,
      streamActivityPhase: "generating",
      visibleRowCount: 7,
    });
    startFrameDropMonitor();
    advance(0); // first tick seeds lastFrameTime
    advance(120); // 120ms frame → severe drop
    const call = appendMock.mock.calls.find((c) => c[0] === "perf.frame-drop");
    expect(call).toBeTruthy();
    expect(call?.[1]).toMatchObject({
      level: "severe",
      deltaMs: 120,
      isStreaming: true,
      streamActivityPhase: "generating",
      visibleRowCount: 7,
    });
  });

  it("does not report normal ~16ms frames", () => {
    startFrameDropMonitor();
    advance(0);
    advance(16);
    advance(16);
    expect(
      appendMock.mock.calls.some((c) => c[0] === "perf.frame-drop"),
    ).toBe(false);
  });

  it("throttles bursts of frame drops within the min interval", () => {
    startFrameDropMonitor();
    advance(0);
    advance(120); // reported
    advance(120); // within 500ms → throttled
    advance(120); // still throttled
    const dropCalls = appendMock.mock.calls.filter(
      (c) => c[0] === "perf.frame-drop",
    );
    expect(dropCalls.length).toBe(1);
  });

  it("records longtask unsupported when the entry type is unavailable", () => {
    const original = (globalThis as { PerformanceObserver?: unknown })
      .PerformanceObserver;
    delete (globalThis as { PerformanceObserver?: unknown }).PerformanceObserver;
    appendMock.mockClear();
    startLongTaskObserver();
    expect(
      appendMock.mock.calls.some((c) => c[0] === "perf.longtask/unsupported"),
    ).toBe(true);
    if (original) {
      (globalThis as { PerformanceObserver?: unknown }).PerformanceObserver =
        original;
    }
  });
});

describe("buildDiagnosticsReportText", () => {
  beforeEach(() => {
    exportState.entries = [];
  });

  it("summarizes frame drops and long tasks into pasteable text", () => {
    exportState.entries = [
      {
        timestamp: 1_700_000_000_000,
        label: "perf.frame-drop",
        payload: { deltaMs: 190, level: "severe" },
      },
      {
        timestamp: 1_700_000_000_100,
        label: "perf.frame-drop",
        payload: { deltaMs: 60, level: "warn" },
      },
      {
        timestamp: 1_700_000_000_200,
        label: "perf.longtask",
        payload: { durationMs: 120 },
      },
      { timestamp: 1_700_000_000_300, label: "window/focus", payload: {} },
    ];
    const text = buildDiagnosticsReportText();
    expect(text).toContain("性能诊断");
    expect(text).toContain("frameDropCount: 2");
    expect(text).toContain("worstFrameMs: 190");
    expect(text).toContain("longTaskCount: 1");
    expect(text).toContain("perf.frame-drop");
    expect(text).not.toContain("window/focus");
  });

  it("returns a hint when no performance entries are recorded", () => {
    exportState.entries = [
      { timestamp: 1, label: "window/focus", payload: {} },
    ];
    const text = buildDiagnosticsReportText();
    expect(text).toContain("no performance diagnostics recorded");
  });
});

describe("reactScanRenderLog (MON-3)", () => {
  beforeEach(() => {
    __resetReactScanRenderLogForTests();
  });

  it("aggregates render counts by component name, ranked", () => {
    function MessageRow() {
      return null;
    }
    recordReactScanRender({ type: MessageRow }, [1, 2]);
    recordReactScanRender({ type: MessageRow }, [1]);
    recordReactScanRender({ type: "div" }, [1]);
    const summary = getRecentReactScanRenderSummary(10_000);
    expect(summary[0]).toMatchObject({ name: "MessageRow", count: 3 });
    expect(summary.find((s) => s.name === "div")?.count).toBe(1);
  });

  it("handles memo/forwardRef wrappers and unknown fibers", () => {
    recordReactScanRender({ type: { displayName: "MemoRow" } }, [1]);
    recordReactScanRender({ type: null }, 1);
    const summary = getRecentReactScanRenderSummary(10_000);
    expect(summary.find((s) => s.name === "MemoRow")).toBeTruthy();
    expect(summary.find((s) => s.name === "unknown")).toBeTruthy();
  });
});
