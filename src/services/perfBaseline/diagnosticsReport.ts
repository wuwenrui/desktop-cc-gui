// 把已持久化的 renderer diagnostics 汇总成一段可粘贴的纯文本("卡顿现场")。
//
// 供设置页「复制卡顿现场」按钮一键复制 / 下载,让用户把性能现场直接发给维护者定位,
// 无需自己看懂 react-scan。只输出性能相关标签,不含任何 prompt / assistant / 文件内容。

import {
  exportRendererDiagnostics,
  type RendererDiagnosticEntry,
} from "../rendererDiagnostics";

const REPORT_MAX_ENTRIES = 80;
const REPORT_LABELS = [
  "perf.frame-drop",
  "perf.longtask",
  "perf.longtask/unsupported",
  "perf.longtask/install-failed",
  "perf.web-vital",
  "perf.messages.row-render-budget",
  "renderer/blank-screen-suspected",
];

function getAppVersion(): string {
  const env = (import.meta.env ?? {}) as Record<string, string | undefined>;
  return env.VITE_APP_VERSION || env.PACKAGE_VERSION || "unknown";
}

function getPlatform(): string {
  if (typeof navigator === "undefined") {
    return "unknown";
  }
  return (navigator.userAgent || "unknown").slice(0, 200);
}

function readNumber(
  payload: Record<string, unknown> | undefined,
  key: string,
): number | null {
  const value = payload?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function formatEntry(entry: RendererDiagnosticEntry): string {
  const time = new Date(entry.timestamp).toISOString();
  let payload = "{}";
  try {
    payload = JSON.stringify(entry.payload ?? {});
  } catch {
    payload = "{unserializable}";
  }
  return `${time} ${entry.label} ${payload}`;
}

export function buildDiagnosticsReportText(): string {
  const all = exportRendererDiagnostics();
  const relevant = all.filter((entry) => REPORT_LABELS.includes(entry.label));
  const recent = relevant.slice(-REPORT_MAX_ENTRIES);
  const frameDrops = relevant.filter((entry) => entry.label === "perf.frame-drop");
  const worstFrameMs = frameDrops.reduce((max, entry) => {
    const delta = readNumber(entry.payload, "deltaMs") ?? 0;
    return delta > max ? delta : max;
  }, 0);
  const longTasks = relevant.filter((entry) => entry.label === "perf.longtask");

  const header = [
    "=== CC GUI 性能诊断 / performance report ===",
    `generatedAt: ${new Date().toISOString()}`,
    `appVersion: ${getAppVersion()}`,
    `platform: ${getPlatform()}`,
    `totalEntries: ${all.length} | relevant: ${relevant.length} | shown: ${recent.length}`,
    `frameDropCount: ${frameDrops.length} | worstFrameMs: ${Math.round(worstFrameMs)} | longTaskCount: ${longTasks.length}`,
    "",
  ].join("\n");

  if (recent.length === 0) {
    return `${header}(no performance diagnostics recorded — 打开设置里的「性能诊断采集」并复现卡顿后再导出)\n`;
  }

  return `${header}${recent.map(formatEntry).join("\n")}\n`;
}
