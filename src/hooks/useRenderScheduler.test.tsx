// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const rendererDiagnosticMocks = vi.hoisted(() => ({
  appendRenderSchedulerResourceDiagnostic: vi.fn(),
}));

vi.mock("../services/rendererDiagnostics", () => rendererDiagnosticMocks);

import { useRenderScheduler } from "./useRenderScheduler";

describe("useRenderScheduler", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    rendererDiagnosticMocks.appendRenderSchedulerResourceDiagnostic.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("schedules chunks via setTimeout fallback in test env and continues while run() returns true", () => {
    const { result } = renderHook(() =>
      useRenderScheduler({ budgetMs: 0, idleTimeoutMs: 0 }),
    );

    let calls = 0;
    const run = () => {
      calls += 1;
      return calls < 3;
    };

    act(() => {
      result.current.scheduleChunk(run);
    });
    // First chunk runs on the next macrotask.
    act(() => {
      vi.runOnlyPendingTimers();
    });
    expect(calls).toBe(1);
    act(() => {
      vi.runOnlyPendingTimers();
    });
    expect(calls).toBe(2);
    act(() => {
      vi.runOnlyPendingTimers();
    });
    expect(calls).toBe(3);
    // No more pending work after run() returned false.
    act(() => {
      vi.runOnlyPendingTimers();
    });
    expect(calls).toBe(3);

    const instr = result.current.__getInstrumentationForTests();
    expect(instr.chunkCount).toBe(3);
    expect(instr.idleCallbackCount).toBe(0);
    expect(instr.timeoutFallbackCount).toBeGreaterThan(0);
  });

  it("yields on input-pending when isInputPending returns true", () => {
    const onYield = vi.fn();
    const { result } = renderHook(() =>
      useRenderScheduler({
        budgetMs: 0,
        idleTimeoutMs: 0,
        isInputPending: () => true,
        onYield,
      }),
    );

    act(() => {
      result.current.scheduleChunk(() => true);
    });
    act(() => {
      vi.runOnlyPendingTimers();
    });

    expect(onYield).toHaveBeenCalledWith("input-pending");
    const instr = result.current.__getInstrumentationForTests();
    expect(instr.inputPendingYieldCount).toBe(1);
  });

  it("continues draining after an input-pending yield", () => {
    const onYield = vi.fn();
    let inputPendingChecks = 0;
    const { result } = renderHook(() =>
      useRenderScheduler({
        budgetMs: 0,
        idleTimeoutMs: 0,
        isInputPending: () => inputPendingChecks++ === 0,
        onYield,
      }),
    );

    let calls = 0;
    const run = () => {
      calls += 1;
      return calls < 2;
    };

    act(() => {
      result.current.scheduleChunk(run);
    });
    act(() => {
      vi.runOnlyPendingTimers();
    });
    expect(calls).toBe(1);
    expect(onYield).toHaveBeenCalledWith("input-pending");

    act(() => {
      vi.runOnlyPendingTimers();
    });
    expect(calls).toBe(2);
    expect(result.current.__getInstrumentationForTests().chunkCount).toBe(2);
  });

  it("continues draining after a budget yield", () => {
    const nowSpy = vi
      .spyOn(performance, "now")
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(10)
      .mockReturnValueOnce(20)
      .mockReturnValueOnce(21);
    const onYield = vi.fn();
    const { result } = renderHook(() =>
      useRenderScheduler({ budgetMs: 4, idleTimeoutMs: 0, onYield }),
    );

    let calls = 0;
    const run = () => {
      calls += 1;
      return calls < 2;
    };

    act(() => {
      result.current.scheduleChunk(run);
    });
    act(() => {
      vi.runOnlyPendingTimers();
    });
    expect(calls).toBe(1);
    expect(onYield).toHaveBeenCalledWith("budget");

    act(() => {
      vi.runOnlyPendingTimers();
    });
    expect(calls).toBe(2);
    expect(result.current.__getInstrumentationForTests().budgetMissCount).toBe(1);
    nowSpy.mockRestore();
  });

  it("cancels pending callbacks on unmount and does not run the chunk", () => {
    const onChunk = vi.fn();
    const { result, unmount } = renderHook(() =>
      useRenderScheduler({ budgetMs: 0, idleTimeoutMs: 0, onChunk }),
    );

    act(() => {
      result.current.scheduleChunk(() => true);
    });
    unmount();
    act(() => {
      vi.runOnlyPendingTimers();
    });
    expect(onChunk).not.toHaveBeenCalled();
  });

  it("records a cleanup diagnostic when unmount cancels pending work", () => {
    const { result, unmount } = renderHook(() =>
      useRenderScheduler({
        budgetMs: 0,
        idleTimeoutMs: 0,
        diagnosticSurfaceId: "test-canvas-lane",
      }),
    );

    act(() => {
      result.current.scheduleChunk(() => true);
    });
    unmount();

    expect(rendererDiagnosticMocks.appendRenderSchedulerResourceDiagnostic)
      .toHaveBeenCalledWith(expect.objectContaining({
        surfaceId: "test-canvas-lane",
        pendingCallback: true,
        timeoutFallbackPending: true,
        cancelled: true,
      }));

    act(() => {
      vi.runOnlyPendingTimers();
    });
    expect(result.current.__getInstrumentationForTests().chunkCount).toBe(0);
  });

  it("flush() runs the chunk synchronously without queuing a callback", () => {
    const onChunk = vi.fn();
    const { result } = renderHook(() =>
      useRenderScheduler({ budgetMs: 0, idleTimeoutMs: 0, onChunk }),
    );

    act(() => {
      result.current.flush(() => false);
    });
    expect(onChunk).toHaveBeenCalledTimes(1);
  });
});
