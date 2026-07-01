// rAF 掉帧监视器 + PerformanceObserver('longtask') 采集。
//
// rAF 掉帧检测是 macOS 打包版(WKWebView)里唯一稳定可用的掉帧信号:react-scan 在生产
// 构建下拿不到 per-render 计时,而 requestAnimationFrame 始终可用。掉帧瞬间把
// perfContextBridge 的上下文一并写进 renderer diagnostics,供"复制卡顿现场"导出。
//
// longtask 观测作为补充信号(直接对应 react-scan 面板里的 190ms JS-heavy 帧),但
// WebKit 对 longtask 支持较晚,不支持时静默降级、只依赖 rAF。
//
// appendRendererDiagnostic 不受 build-time PROD 门控,故本模块在打包版天然可用。

import { appendRendererDiagnostic } from "../rendererDiagnostics";
import { readPerfContext } from "./perfContextBridge";
import { getRecentReactScanRenderSummary } from "./reactScanRenderLog";

const WARN_FRAME_MS = 50; // 约掉 3 帧(60fps 下)
const SEVERE_FRAME_MS = 100; // 约掉 6 帧
const MIN_REPORT_INTERVAL_MS = 500; // 节流:相邻掉帧上报最短间隔,避免日志雪崩
const MAX_FRAME_DROP_REPORTS = 200; // 单次会话上报上限

let rafHandle: number | null = null;
let lastFrameTime: number | null = null;
let lastReportAt = Number.NEGATIVE_INFINITY;
let frameDropReports = 0;
let longTaskObserver: PerformanceObserver | null = null;

function nowMs(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function reportFrameDrop(deltaMs: number): void {
  const at = nowMs();
  if (at - lastReportAt < MIN_REPORT_INTERVAL_MS) {
    return;
  }
  if (frameDropReports >= MAX_FRAME_DROP_REPORTS) {
    return;
  }
  lastReportAt = at;
  frameDropReports += 1;
  appendRendererDiagnostic("perf.frame-drop", {
    deltaMs: Math.round(deltaMs),
    approxFps: Math.max(1, Math.round(1000 / deltaMs)),
    level: deltaMs >= SEVERE_FRAME_MS ? "severe" : "warn",
    ...readPerfContext(),
    topRenders: getRecentReactScanRenderSummary(600),
  });
}

/** 启动 rAF 掉帧监视循环。幂等。 */
export function startFrameDropMonitor(): void {
  if (
    rafHandle !== null ||
    typeof window === "undefined" ||
    typeof window.requestAnimationFrame !== "function"
  ) {
    return;
  }
  lastFrameTime = null;
  const tick = () => {
    const now = nowMs();
    if (lastFrameTime !== null) {
      const delta = now - lastFrameTime;
      if (delta >= WARN_FRAME_MS) {
        reportFrameDrop(delta);
      }
    }
    lastFrameTime = now;
    rafHandle = window.requestAnimationFrame(tick);
  };
  rafHandle = window.requestAnimationFrame(tick);
}

/** 停止 rAF 掉帧监视循环。幂等。 */
export function stopFrameDropMonitor(): void {
  if (rafHandle !== null && typeof window !== "undefined") {
    window.cancelAnimationFrame(rafHandle);
  }
  rafHandle = null;
  lastFrameTime = null;
}

/** 启动 longtask 观测;不支持时记录一次并降级依赖 rAF。幂等。 */
export function startLongTaskObserver(): void {
  if (longTaskObserver !== null) {
    return;
  }
  if (typeof PerformanceObserver === "undefined") {
    appendRendererDiagnostic("perf.longtask/unsupported", {
      reason: "no-PerformanceObserver",
    });
    return;
  }
  const supportedEntryTypes = (
    PerformanceObserver as typeof PerformanceObserver & {
      supportedEntryTypes?: readonly string[];
    }
  ).supportedEntryTypes;
  if (!supportedEntryTypes?.includes("longtask")) {
    appendRendererDiagnostic("perf.longtask/unsupported", {
      reason: "entryType-unavailable",
    });
    return;
  }
  try {
    longTaskObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        appendRendererDiagnostic("perf.longtask", {
          durationMs: Math.round(entry.duration),
          startTime: Math.round(entry.startTime),
          name: entry.name,
          ...readPerfContext(),
        });
      }
    });
    longTaskObserver.observe({ type: "longtask", buffered: true });
  } catch (error) {
    longTaskObserver = null;
    appendRendererDiagnostic("perf.longtask/install-failed", {
      error: String(error),
    });
  }
}

/** 停止 longtask 观测。幂等。 */
export function stopLongTaskObserver(): void {
  longTaskObserver?.disconnect();
  longTaskObserver = null;
}

export function __resetFrameDropMonitorForTests(): void {
  stopFrameDropMonitor();
  stopLongTaskObserver();
  lastReportAt = Number.NEGATIVE_INFINITY;
  frameDropReports = 0;
}
