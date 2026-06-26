import { useCallback, useEffect, useMemo, useRef } from "react";
import { appendRenderSchedulerResourceDiagnostic } from "../services/rendererDiagnostics";

// Reusable idle-callback + budget scheduler. Replaces the ad-hoc
// `requestIdleCallback` + `setTimeout(0)` fallback in
// `useWorkspaceThreadListHydration` and the v1 `setTimeout(processNextChunk, 0)`
// chunk loop in `dispatchAppServerEventBatch`.
//
// Design references:
//   * proposal 2026-06-24-harden-realtime-interaction-jank-during-tool-call §1
//   * capability `streaming-schedule-tier-rollback`
//   * capability `app-server-event-stream-pacing`

export type UseRenderSchedulerOptions = {
  /** Hard per-chunk budget in ms before the scheduler yields. 0 = no budget. */
  budgetMs: number;
  /** `requestIdleCallback` timeout. 0 = no idle API. */
  idleTimeoutMs: number;
  /** Optional hook fired whenever the scheduler yields to the host. */
  onYield?: (reason: "budget" | "input-pending" | "queue-empty") => void;
  /** Optional chunk-finished callback (after `run()` returned false or threw). */
  onChunk?: (info: { chunkIndex: number; yieldCount: number }) => void;
  /** Optional input-pending detector. Defaults to `navigator.scheduling.isInputPending`. */
  isInputPending?: () => boolean;
  /** Optional content-safe diagnostics owner for long-run resource cleanup evidence. */
  diagnosticSurfaceId?: string;
};

export type UseRenderScheduler = {
  /**
   * Schedule a chunk. The `run` callback is expected to return `true` while
   * more work remains. The scheduler keeps draining across idle callbacks until
   * `run()` returns `false`; budget and input-pending only decide when to yield,
   * not whether the remaining queue should be abandoned.
   */
  scheduleChunk: (run: () => boolean) => void;
  /** Drain the queue immediately, bypassing the idle-callback. */
  flush: (run: () => boolean) => void;
  /** Cancel every pending callback. Called automatically on unmount. */
  cancel: () => void;
  /** Test-only surface for instrumentation counters. */
  __getInstrumentationForTests: () => RenderSchedulerInstrumentation;
};

export type RenderSchedulerInstrumentation = {
  chunkCount: number;
  yieldCount: number;
  inputPendingYieldCount: number;
  budgetMissCount: number;
  idleCallbackCount: number;
  timeoutFallbackCount: number;
  pendingCallback: boolean;
  idleCallbackPending: boolean;
  timeoutFallbackPending: boolean;
  cancelled: boolean;
};

type IdleHandle = number;

function defaultIsInputPending(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }
  const scheduling = (
    navigator as Navigator & {
      scheduling?: { isInputPending?: () => boolean };
    }
  ).scheduling;
  return scheduling?.isInputPending?.() === true;
}

export function useRenderScheduler(
  options: UseRenderSchedulerOptions,
): UseRenderScheduler {
  const {
    budgetMs,
    idleTimeoutMs,
    onYield,
    onChunk,
    isInputPending,
    diagnosticSurfaceId,
  } = options;

  const countersRef = useRef<RenderSchedulerInstrumentation>({
    chunkCount: 0,
    yieldCount: 0,
    inputPendingYieldCount: 0,
    budgetMissCount: 0,
    idleCallbackCount: 0,
    timeoutFallbackCount: 0,
    pendingCallback: false,
    idleCallbackPending: false,
    timeoutFallbackPending: false,
    cancelled: false,
  });
  const pendingRef = useRef(false);
  const scheduleRef = useRef<((run: () => boolean) => void) | null>(null);
  const cancelledRef = useRef(false);
  const idleHandleRef = useRef<IdleHandle | null>(null);
  const timeoutHandleRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const detectInputPending = useCallback((): boolean => {
    if (isInputPending) {
      try {
        return isInputPending();
      } catch {
        return false;
      }
    }
    return defaultIsInputPending();
  }, [isInputPending]);

  const clearPendingHandles = useCallback(() => {
    if (
      typeof window !== "undefined" &&
      idleHandleRef.current !== null &&
      typeof window.cancelIdleCallback === "function"
    ) {
      try {
        window.cancelIdleCallback(idleHandleRef.current);
      } catch {
        // ignore double-cancel
      }
    }
    idleHandleRef.current = null;
    if (timeoutHandleRef.current !== null) {
      clearTimeout(timeoutHandleRef.current);
      timeoutHandleRef.current = null;
    }
  }, []);

  const snapshotInstrumentation = useCallback(
    (): RenderSchedulerInstrumentation => ({
      ...countersRef.current,
      pendingCallback: pendingRef.current,
      idleCallbackPending: idleHandleRef.current !== null,
      timeoutFallbackPending: timeoutHandleRef.current !== null,
      cancelled: cancelledRef.current,
    }),
    [],
  );

  const appendResourceSnapshot = useCallback(
    (cancelled: boolean) => {
      if (!diagnosticSurfaceId) {
        return;
      }
      const snapshot = snapshotInstrumentation();
      appendRenderSchedulerResourceDiagnostic({
        surfaceId: diagnosticSurfaceId,
        chunkCount: snapshot.chunkCount,
        yieldCount: snapshot.yieldCount,
        inputPendingYieldCount: snapshot.inputPendingYieldCount,
        budgetMissCount: snapshot.budgetMissCount,
        idleCallbackCount: snapshot.idleCallbackCount,
        timeoutFallbackCount: snapshot.timeoutFallbackCount,
        pendingCallback: snapshot.pendingCallback,
        idleCallbackPending: snapshot.idleCallbackPending,
        timeoutFallbackPending: snapshot.timeoutFallbackPending,
        cancelled,
        evidenceClass: "proxy",
      });
    },
    [diagnosticSurfaceId, snapshotInstrumentation],
  );

  const markCancelled = useCallback((cancelled: boolean) => {
    cancelledRef.current = cancelled;
    countersRef.current.cancelled = cancelled;
  }, []);

  const invokeYield = useCallback(
    (reason: "budget" | "input-pending" | "queue-empty") => {
      countersRef.current.yieldCount += 1;
      if (reason === "budget") {
        countersRef.current.budgetMissCount += 1;
      }
      if (reason === "input-pending") {
        countersRef.current.inputPendingYieldCount += 1;
      }
      onYield?.(reason);
    },
    [onYield],
  );

  const runChunk = useCallback(
    (run: () => boolean) => {
      pendingRef.current = false;
      if (cancelledRef.current) {
        return;
      }
      const startedAt = nowMs();
      countersRef.current.chunkCount += 1;
      const chunkIndex = countersRef.current.chunkCount;
      let more = false;
      try {
        more = run() === true;
      } catch {
        // Swallow chunk errors so the scheduler keeps draining. Real
        // callers should surface errors through their own state path.
      }
      onChunk?.({ chunkIndex, yieldCount: countersRef.current.yieldCount });

      if (cancelledRef.current) {
        return;
      }

      if (!more) {
        invokeYield("queue-empty");
        return;
      }

      const elapsed = nowMs() - startedAt;
      const budgetExceeded = budgetMs > 0 && elapsed >= budgetMs;
      const inputPending = detectInputPending();
      if (budgetExceeded) {
        invokeYield("budget");
      }
      if (inputPending) {
        invokeYield("input-pending");
      }
      // Auto-reschedule while work remains. Budget/input-pending affect the
      // yield reason and counters, but queue liveness must not depend on a new
      // external event arriving later.
      if (more && !cancelledRef.current) {
        pendingRef.current = false;
        scheduleRef.current?.(run);
      }
    },
    [budgetMs, detectInputPending, invokeYield, onChunk],
  );

  const schedule = useCallback(
    (run: () => boolean) => {
      if (cancelledRef.current || pendingRef.current) {
        return;
      }
      pendingRef.current = true;

      if (
        typeof window !== "undefined" &&
        typeof window.requestIdleCallback === "function" &&
        idleTimeoutMs > 0
      ) {
        countersRef.current.idleCallbackCount += 1;
        idleHandleRef.current = window.requestIdleCallback(
          () => runChunk(run),
          { timeout: idleTimeoutMs },
        );
        return;
      }

      countersRef.current.timeoutFallbackCount += 1;
      timeoutHandleRef.current = setTimeout(() => runChunk(run), 0);
    },
    [idleTimeoutMs, runChunk],
  );
  scheduleRef.current = schedule;

  const flush = useCallback(
    (run: () => boolean) => {
      clearPendingHandles();
      pendingRef.current = false;
      runChunk(run);
    },
    [clearPendingHandles, runChunk],
  );

  const cancel = useCallback(() => {
    markCancelled(true);
    appendResourceSnapshot(true);
    pendingRef.current = false;
    clearPendingHandles();
  }, [appendResourceSnapshot, clearPendingHandles, markCancelled]);

  // Reset cancellation latch on each render; we keep the counters intact.
  useEffect(() => {
    markCancelled(false);
    return () => {
      markCancelled(true);
      appendResourceSnapshot(true);
      clearPendingHandles();
    };
  }, [appendResourceSnapshot, clearPendingHandles, markCancelled]);

  const __getInstrumentationForTests = useCallback(
    () => snapshotInstrumentation(),
    [snapshotInstrumentation],
  );

  return useMemo<UseRenderScheduler>(
    () => ({ scheduleChunk: schedule, flush, cancel, __getInstrumentationForTests }),
    [schedule, flush, cancel, __getInstrumentationForTests],
  );
}

function nowMs(): number {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now();
  }
  return Date.now();
}
