#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const PERF_BASELINE_PATH = "docs/perf/baseline.json";
const COMPOSER_BASELINE_PATH = "docs/perf/composer-baseline.json";
const BROWSER_SCROLL_PATH = "docs/perf/long-list-browser-scroll.json";
const REALTIME_TURN_TRACE_PATH = "docs/perf/realtime-turn-trace.json";
const REALTIME_RUNTIME_EVIDENCE_PATH = "docs/perf/realtime-runtime-evidence.json";
const REALTIME_PROFILE_PATH = "docs/perf/realtime-profile.jsonl";
const LARGE_FILE_WATCHLIST_PATH = ".artifacts/large-files-near-threshold.json";
const LONGRUNNING_RUNTIME_EVIDENCE_PATH = "docs/perf/long-running-runtime-evidence.json";
const OUTPUT_JSON_PATH = "docs/perf/runtime-evidence-gates.json";
const OUTPUT_PERF_MARKDOWN_PATH = "docs/perf/runtime-evidence-gates.md";
const OUTPUT_OPENSPEC_MARKDOWN_PATH = "openspec/docs/runtime-evidence-gates-2026-05-24.md";
const CLOSURE_CHANGE_NAMES = new Set(["close-performance-iteration-2026-06"]);

const compatibilityPaths = [
  {
    name: "listClaudeSessions",
    classification: "retain-compatibility",
    reason: "Native Claude continuity and diagnostic listing path; not the sidebar membership truth source.",
    verification: "rg references in src/services/tauri.ts, useThreadActions fallback seed, and focused tests.",
  },
  {
    name: "listProjectRelatedCodexSessions",
    classification: "retain-compatibility",
    reason: "Project-related Codex diagnostics and continuity path; shared projection remains canonical for membership.",
    verification: "rg references in src/services/tauri/sessionManagement.ts and src/services/tauri.test.ts.",
  },
  {
    name: "legacy bare-session metadata lookup",
    classification: "retain-legacy",
    reason: "Recovery fallback for older persisted/session metadata shapes.",
    verification: "Spec and Rust test evidence keep stable-key plus legacy bare-session metadata compatibility.",
  },
  {
    name: "legacy cursor parsing",
    classification: "retain-legacy",
    reason: "Backward-compatible pagination fallback for older cursor payloads.",
    verification: "Session-management closeout records this as a protected compatibility path.",
  },
];

function repoPath(path) {
  return resolve(process.cwd(), path);
}

async function readJsonIfExists(path) {
  const absolutePath = repoPath(path);
  if (!existsSync(absolutePath)) {
    return null;
  }
  return JSON.parse(await readFile(absolutePath, "utf-8"));
}

async function readJsonlIfExists(path) {
  const absolutePath = repoPath(path);
  if (!existsSync(absolutePath)) {
    return null;
  }
  const content = await readFile(absolutePath, "utf-8");
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

async function writeText(path, value) {
  const absolutePath = repoPath(path);
  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, value, "utf-8");
}

function runJson(command, args) {
  try {
    const output = execFileSync(command, args, { cwd: process.cwd(), encoding: "utf-8" });
    return JSON.parse(output);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : String(error),
      changes: [],
    };
  }
}

function markdownCell(value) {
  return String(value ?? "")
    .replace(/\|/g, "\\|")
    .replace(/\r?\n/g, " ");
}

function classifyMetric(metric) {
  if (
    metric.evidenceClass === "measured"
    || metric.evidenceClass === "proxy"
    || metric.evidenceClass === "manual-only"
    || metric.evidenceClass === "unsupported"
  ) {
    return metric.evidenceClass;
  }
  const note = `${metric.notes ?? ""} ${metric.unsupportedReason ?? ""}`.toLowerCase();
  if (metric.value == null || metric.unsupportedReason) {
    return "unsupported";
  }
  if (metric.metric === "browserScrollFrameDropPct") {
    return "measured";
  }
  if (
    note.includes("proxy")
    || note.includes("jsdom")
    || note.includes("fixture")
    || metric.scenario?.startsWith("S-LL")
    || metric.scenario?.startsWith("S-CI")
    || metric.scenario?.startsWith("S-RS")
  ) {
    return "proxy";
  }
  return "measured";
}

function metricReason(metric, evidenceClass) {
  if (metric.unsupportedReason) {
    return metric.unsupportedReason;
  }
  if (metric.notes) {
    return metric.notes;
  }
  if (evidenceClass === "proxy") {
    return "Fixture or replay evidence; useful for regression comparison, not release-grade runtime proof.";
  }
  return "Directly measured from generated artifact.";
}

function metricNextAction(metric, evidenceClass) {
  if (metric.scenario === "S-LL-1000" && metric.metric === "scrollFrameDropPct") {
    return "Add browser-level scroll gate for the 1000-row scenario.";
  }
  if (metric.scenario === "S-CS-COLD" && metric.metric?.endsWith("Ms")) {
    return "Collect real Tauri webview cold-start timing on a supported runner.";
  }
  if (metric.scenario?.startsWith("S-RS")) {
    return "Correlate replay metrics with runtime visible-lag and terminal-pressure traces.";
  }
  if (evidenceClass === "proxy") {
    return "Keep as regression baseline and add runtime/browser evidence before release-grade closure.";
  }
  if (evidenceClass === "unsupported") {
    return "Provide supported environment evidence or preserve explicit qualifier.";
  }
  return "Track for regression.";
}

function missingSourceMetrics(path, reason = "missing") {
  const sourceState = reason === "invalid" ? "Invalid source file" : "Missing source file";
  if (path === BROWSER_SCROLL_PATH) {
    return [{
      scenario: "S-LL-1000",
      metric: "browserScrollFrameDropPct",
      value: null,
      unit: "%",
      unsupportedReason: `${sourceState}: ${path}. Run npm run perf:long-list:browser-scroll to collect browser scroll evidence or record an unsupported result.`,
    }];
  }
  return [{
    scenario: "runtime-perf-baseline",
    metric: "sourceFileAvailable",
    value: null,
    unit: "status",
    unsupportedReason: `${sourceState}: ${path}. Run the corresponding performance baseline command before claiming runtime evidence closure.`,
  }];
}

function buildPerfEvidence(fragments) {
  return fragments.flatMap(({ path, fragment }) => {
    const metrics = Array.isArray(fragment?.metrics)
      ? fragment.metrics
      : missingSourceMetrics(path, fragment == null ? "missing" : "invalid");
    return metrics.map((metric) => {
      const evidenceClass = classifyMetric(metric);
      return {
        source: path,
        scenario: metric.scenario,
        metric: metric.metric,
        value: metric.value,
        unit: metric.unit,
        evidenceClass,
        budget: metric.budget ?? null,
        reason: metricReason(metric, evidenceClass),
        nextAction: metricNextAction(metric, evidenceClass),
      };
    });
  });
}

function findMetric(perfEvidence, scenario, metric) {
  return perfEvidence.find((entry) => entry.scenario === scenario && entry.metric === metric);
}

function normalizeEvidenceClass(value, fallback = "proxy") {
  return value === "measured" || value === "proxy" || value === "unsupported"
    ? value
    : fallback;
}

function metricFromRealtimeProfileEntry(entry) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    return null;
  }
  const scenario = typeof entry.scenario === "string" ? entry.scenario : "S-IO-FP";
  const metric = typeof entry.metric === "string"
    ? entry.metric
    : typeof entry.name === "string"
      ? entry.name
      : null;
  const value = toFiniteNumber(entry.value ?? entry.count ?? entry.renderCount);
  if (!metric || value === null) {
    return null;
  }

  return {
    source: REALTIME_PROFILE_PATH,
    scenario,
    metric,
    value,
    unit: typeof entry.unit === "string" ? entry.unit : "count",
    evidenceClass: normalizeEvidenceClass(entry.evidenceClass, "proxy"),
    budget: entry.budget ?? null,
    reason:
      typeof entry.notes === "string"
        ? entry.notes
        : "Profiler artifact evidence from realtime-profile.jsonl.",
    nextAction:
      typeof entry.nextAction === "string"
        ? entry.nextAction
        : "Promote proxy fixture evidence to measured live-session evidence when available.",
  };
}

function buildRealtimeProfileEvidence(profileEntries) {
  if (!Array.isArray(profileEntries)) {
    return [];
  }
  return profileEntries
    .map(metricFromRealtimeProfileEntry)
    .filter((entry) => entry !== null);
}

function toFiniteNumber(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function buildRealtimeSummary(perfEvidence, turnTraceFragment) {
  const firstToken = findMetric(perfEvidence, "S-RS-FT", "firstTokenLatency");
  const jitter = findMetric(perfEvidence, "S-RS-FT", "interTokenJitterP95");
  const assembler = findMetric(perfEvidence, "S-RS-PE", "assemblerLatency");
  const visibleTextLag = findMetric(perfEvidence, "S-RS-VL", "visibleTextLagP95");
  const reducerAmplification = findMetric(perfEvidence, "S-RS-RA", "reducerAmplificationMedian");
  const batchFlushDuration = findMetric(perfEvidence, "S-RS-FD", "batchFlushDurationP95");
  const terminalSettlement = findMetric(perfEvidence, "S-RS-TS", "terminalSettlementP95");
  const firstTokenValue = toFiniteNumber(firstToken?.value);
  const jitterValue = toFiniteNumber(jitter?.value);
  const visibleLagRisk = firstTokenValue == null && jitterValue == null
    ? "unsupported"
    : (firstTokenValue ?? 0) >= 2000 || (jitterValue ?? 0) >= 500
      ? "high"
      : "bounded";
  const traceEvidenceClass = turnTraceFragment && typeof turnTraceFragment === "object"
    ? "proxy"
    : "unsupported";
  return {
    firstTokenLatencyMs: firstToken?.value ?? null,
    interTokenJitterP95Ms: jitter?.value ?? null,
    assemblerLatencyMs: assembler?.value ?? null,
    visibleTextLagP95Ms: visibleTextLag?.value ?? null,
    reducerAmplificationMedian: reducerAmplification?.value ?? null,
    batchFlushDurationP95Ms: batchFlushDuration?.value ?? null,
    terminalSettlementP95Ms: terminalSettlement?.value ?? null,
    evidenceClass: visibleLagRisk === "unsupported" ? "unsupported" : "proxy",
    visibleLagRisk,
    terminalPressure: "not-directly-measured",
    turnTraceEvidenceClass: traceEvidenceClass,
    turnTraceSource: turnTraceFragment ? REALTIME_TURN_TRACE_PATH : null,
    nextAction: "Add runtime trace that correlates ingress cadence, batch flush, render-visible cadence, and terminal settlement.",
  };
}

function buildRendererResourceSummary(perfEvidence) {
  const batchFlushDuration = findMetric(perfEvidence, "S-RS-FD", "batchFlushDurationP95");
  const terminalSettlement = findMetric(perfEvidence, "S-RS-TS", "terminalSettlementP95");
  return {
    backpressure: {
      source: batchFlushDuration?.source ?? "docs/perf/realtime-extended-baseline.json",
      eventFlushCap: 200,
      byteFlushCap: 128 * 1024,
      evidenceClass: batchFlushDuration?.evidenceClass ?? "unsupported",
      queueDepth: null,
      droppedCount: null,
      coalescedCount: null,
      reason: batchFlushDuration?.reason
        ?? "Runtime backpressure substrate is present; live queue counters require renderer diagnostics capture.",
    },
    listenerOwners: {
      ownerTaxonomy: ["bootstrap", "shell", "workspace", "panel", "modal"],
      migratedPilotSurfaces: [
        "events.terminal-output",
        "events.runtime-log-line",
        "events.runtime-log-status",
        "focus-refresh-wave",
      ],
      evidenceClass: "proxy",
      residualRisk: "Full-app listener inventory remains manual; pilot surfaces are tracked first.",
    },
    mediaOwners: {
      migratedPilotSurfaces: ["message-image-grid", "message-deferred-image"],
      activeCount: null,
      revokedCount: null,
      retainedBytes: null,
      evidenceClass: "proxy",
      unsupportedReason: "Retained bytes are reported when Blob sizes are available in renderer diagnostics.",
    },
    criticalPath: {
      terminalSettlementP95Ms: terminalSettlement?.value ?? null,
      evidenceClass: terminalSettlement?.evidenceClass ?? "unsupported",
    },
  };
}

function buildBackendBridgeSummary() {
  return {
    substrate: {
      scanCache: {
        api: "ScanCache<K,V>.get_or_compute/invalidate/invalidate_matching",
        evidenceClass: "proxy",
      },
      jsonlAppendOnly: {
        states: ["append-only", "full-rescan", "corrupt-fallback"],
        evidenceClass: "proxy",
      },
      blockingPolicy: {
        timeoutFallback: "TimeoutPartial",
        evidenceClass: "proxy",
      },
    },
    bridgePayload: {
      pilotCommand: "get_git_log",
      surfaceId: "git-history-log",
      targetBytes: 1024 * 1024,
      hardFailBytes: 4 * 1024 * 1024,
      targetItems: 2000,
      hardFailItems: 5000,
      metadataFields: [
        "command",
        "surfaceId",
        "itemCount",
        "estimatedBytes",
        "partial",
        "truncated",
        "cacheState",
        "evidenceClass",
      ],
      evidenceClass: "proxy",
      contentSafety: "Metadata intentionally excludes absolute paths, prompts, assistant bodies, and tool output.",
    },
    residualRisk: [
      "session catalog",
      "local usage",
      "Claude history",
      "workspace files",
      "project map relations",
    ],
  };
}

function buildWorkspaceFileListingSummary(perfEvidence) {
  const commitP95 = findMetric(perfEvidence, "S-LL-1000", "commitDurationP95");
  const browserScroll = findMetric(perfEvidence, "S-LL-1000", "browserScrollFrameDropPct");
  return {
    diagnosticsLabel: "workspaces.file.listing-budget",
    metadataFields: [
      "surfaceId",
      "workspaceId",
      "durationMs",
      "returnedEntries",
      "payloadBytes",
      "cacheState",
      "scanState",
      "partial",
      "limitHit",
      "sourceVersion",
      "requestedPathHash",
      "evidenceClass",
    ],
    initialListing: {
      surfaceId: "workspaces.file.initial-listing",
      depth: 2,
      targetEntries: 2000,
      hardFailEntries: 5000,
      targetPayloadBytes: 1024 * 1024,
      hardFailPayloadBytes: 4 * 1024 * 1024,
      evidenceClass: "proxy",
    },
    subtreeListing: {
      surfaceId: "workspaces.file.subtree-listing",
      depth: 1,
      targetEntries: 500,
      fallback: "full listing fallback is recorded as fallback-full-listing",
      evidenceClass: "proxy",
    },
    sharedIndex: {
      contract: ["pathTokens", "directoryTokens", "sourceVersion", "freshness", "invalidatedPaths"],
      fallbackClass: "unsupported",
      evidenceClass: "proxy",
    },
    longListProxy: {
      commitDurationP95Ms: commitP95?.value ?? null,
      browserScrollFrameDropPct: browserScroll?.value ?? null,
      evidenceClass: browserScroll?.evidenceClass ?? commitP95?.evidenceClass ?? "unsupported",
    },
    contentSafety: "Diagnostics store hashes, counts, sourceVersion, and payload sizes; file contents and raw paths are excluded.",
  };
}

function buildMarkdownPrecomputeSummary() {
  return {
    diagnosticsLabel: "perf.messages.markdown.precompute",
    threshold: {
      minLengthChars: 10_000,
      complexitySignals: ["fenced-code", "math", "table", "raw-html"],
    },
    modes: ["worker-precompute", "main", "cache-hit", "fallback"],
    metadataFields: [
      "mode",
      "durationMs",
      "contentLength",
      "contentHash",
      "thresholdReason",
      "cacheState",
      "fallbackReason",
      "evidenceClass",
      "totalHeadings",
      "totalHeavyBlocks",
      "totalSourceLines",
    ],
    unsafeHtmlBoundary: "Worker output is not trusted DOM; rich React render and sanitization remain on the main renderer path.",
    evidenceClass: "proxy",
    contentSafety: "Diagnostics store source length/hash and structural counts; raw Markdown, prompt text, assistant body, tool output, and file content are excluded.",
  };
}

const REALTIME_TRACE_BUDGETS = {
  "S-RS-VL": {
    target: 2000,
    hardFail: 5000,
    unit: "ms",
    rollout: "advisory-until-runtime-trace",
    source: "openspec/changes/collect-release-grade-performance-evidence/budget-decision-table.md",
    owner: "realtime-runtime-evidence",
    status: "approved-runtime-measured",
    reason: "Replay-derived first-delta -> first-visible-text P95; jsdom/PerformanceObserver path is the follow-up.",
    nextAction: "Wire PerformanceObserver in Tauri webview to record first visible text growth and bring this to measured.",
  },
  "S-RS-RA": {
    target: 2,
    hardFail: 4,
    unit: "ratio",
    rollout: "advisory-until-runtime-trace",
    source: "openspec/changes/collect-release-grade-performance-evidence/budget-decision-table.md",
    owner: "realtime-runtime-evidence",
    status: "approved-runtime-measured",
    reason: "Replay-derived reducer amplification median; reflects fixture batch grouping.",
    nextAction: "Cross-check with renderer-side reducer commit count under live Tauri session.",
  },
  "S-RS-FD": {
    target: 8,
    hardFail: 16,
    unit: "ms",
    rollout: "advisory-until-runtime-trace",
    source: "openspec/changes/collect-release-grade-performance-evidence/budget-decision-table.md",
    owner: "realtime-runtime-evidence",
    status: "approved-runtime-measured",
    reason: "Replay-derived batch flush duration P95; replay group window is the surrogate.",
    nextAction: "Replace with measured wall-clock gap between batcher flush-start and flush-end in the renderer hot path.",
  },
  "S-RS-TS": {
    target: 100,
    hardFail: 250,
    unit: "ms",
    rollout: "advisory-until-runtime-trace",
    source: "openspec/changes/collect-release-grade-performance-evidence/budget-decision-table.md",
    owner: "realtime-runtime-evidence",
    status: "approved-runtime-measured",
    reason: "Replay-derived terminal settlement P95 (last reducer commit -> agentCompleted).",
    nextAction: "Wire real Tauri/webview terminal signal (provider final + reducer final) and reclassify to measured.",
  },
};

function buildRealtimeTraceBudgets(perfEvidence) {
  // Enrich existing baseline rows with target / hardFail / clearer next-action.
  // Returns the (mutated) perfEvidence so callers can append the same array.
  for (const entry of perfEvidence) {
    const budget = REALTIME_TRACE_BUDGETS[entry.scenario];
    if (budget && entry.metric === (
      entry.scenario === "S-RS-VL" ? "visibleTextLagP95"
        : entry.scenario === "S-RS-RA" ? "reducerAmplificationMedian"
        : entry.scenario === "S-RS-FD" ? "batchFlushDurationP95"
        : entry.scenario === "S-RS-TS" ? "terminalSettlementP95"
        : null
    )) {
      entry.budget = {
        target: budget.target,
        hardFail: budget.hardFail,
        unit: budget.unit,
        rollout: budget.rollout,
        source: budget.source,
        owner: budget.owner,
        status: budget.status,
      };
      if (entry.source === REALTIME_RUNTIME_EVIDENCE_PATH) {
        entry.nextAction = entry.nextAction ?? budget.nextAction;
      } else if (entry.evidenceClass !== "measured") {
        entry.reason = budget.reason;
        entry.nextAction = budget.nextAction;
        entry.evidenceClass = "proxy";
        entry.source = "docs/perf/realtime-extended-baseline.json";
      }
    }
  }
  return perfEvidence;
}

function buildColdStartSummary(perfEvidence) {
  const firstPaint = findMetric(perfEvidence, "S-CS-COLD", "firstPaintMs");
  const firstInteractive = findMetric(perfEvidence, "S-CS-COLD", "firstInteractiveMs");
  return {
    firstPaintEvidence: firstPaint?.evidenceClass ?? "unsupported",
    firstInteractiveEvidence: firstInteractive?.evidenceClass ?? "unsupported",
    reason: firstPaint?.reason ?? firstInteractive?.reason ?? "Cold-start timing source is missing.",
    nextAction: "Collect Tauri webview timing on supported macOS/Windows/Linux runners.",
  };
}

function buildRealtimeInputRenderBudgetSummary(perfEvidence) {
  const prepareThreadItemsCallRate = findMetric(perfEvidence, "S-IO-RR", "prepareThreadItems_calls_per_1000_delta");
  const reducerFlush = findMetric(perfEvidence, "S-IO-RR", "thread_reducer_flush_ms_p95");
  const routeDuration = findMetric(perfEvidence, "S-IO-RR", "realtime_delta_route_ms_p95");
  return {
    diagnosticsLabel: "perf.realtime.input-render-budget",
    scenarios: ["S-IO-RR"],
    metadataFields: [
      "scenario",
      "metric",
      "value",
      "unit",
      "budget",
      "evidenceClass",
    ],
    target: {
      prepareThreadItemsCallsPer1000Delta: 5,
      threadReducerFlushMsP95: 8,
      realtimeDeltaRouteMsP95: 4,
    },
    prepareThreadItems_calls_per_1000_delta: prepareThreadItemsCallRate?.value ?? null,
    thread_reducer_flush_ms_p95: reducerFlush?.value ?? null,
    realtime_delta_route_ms_p95: routeDuration?.value ?? null,
    evidenceClass: prepareThreadItemsCallRate?.evidenceClass
      ?? reducerFlush?.evidenceClass
      ?? routeDuration?.evidenceClass
      ?? "unsupported",
    reason: "Streaming fixture needed to populate reducer fast-path evidence; baseline scenarios are added by this change.",
    nextAction: "Wire prepareThreadItems call counter and reducer flush timing into the realtime replay fixture.",
  };
}

function buildBackendFileIoIsolationSummary(perfEvidence) {
  const wallP95 = findMetric(perfEvidence, "S-IO-FS", "file_io_command_wall_ms_p95");
  const asyncStall = findMetric(perfEvidence, "S-IO-FS", "file_io_async_worker_stall_ms_p95");
  const poolCalls = findMetric(perfEvidence, "S-IO-FS", "file_io_blocking_pool_call_count");
  const tauriDuringStream = findMetric(perfEvidence, "S-IO-FS", "tauri_command_during_stream_ms_p95");
  return {
    diagnosticsLabel: "perf.backend.file-io-isolation",
    scenarios: ["S-IO-FS"],
    metadataFields: [
      "command",
      "workspaceId",
      "durationMs",
      "asyncWorkerStallMs",
      "blockingPoolCalled",
      "evidenceClass",
    ],
    target: {
      // No artificial 5ms budget; use realistic workspace file command wall time.
      file_io_command_wall_ms_p95: null,
      file_io_async_worker_stall_ms_p95_target: 1,
      file_io_blocking_pool_call_count: null,
      tauri_command_during_stream_ms_p95: null,
    },
    file_io_command_wall_ms_p95: wallP95?.value ?? null,
    file_io_async_worker_stall_ms_p95: asyncStall?.value ?? null,
    file_io_blocking_pool_call_count: poolCalls?.value ?? null,
    tauri_command_during_stream_ms_p95: tauriDuringStream?.value ?? null,
    evidenceClass: wallP95?.evidenceClass
      ?? asyncStall?.evidenceClass
      ?? poolCalls?.evidenceClass
      ?? tauriDuringStream?.evidenceClass
      ?? "unsupported",
    reason: "Blocking pool call counter and async-worker stall probe will be added by the file I/O isolation step.",
    nextAction: "Run blocking pool call counter and async-worker stall probe in a 10MB read/write fixture during streaming.",
  };
}

function buildFileChangeEventDebounceSummary(perfEvidence) {
  const raw = findMetric(perfEvidence, "S-IO-FC", "fs_event_raw_per_sec");
  const emit = findMetric(perfEvidence, "S-IO-FC", "fs_event_emitted_per_sec");
  const samePath = findMetric(perfEvidence, "S-IO-FC", "fs_event_same_path_coalesce_ratio");
  const emptyBatch = findMetric(perfEvidence, "S-IO-FC", "fs_event_empty_batch_emit_count");
  return {
    diagnosticsLabel: "perf.file-change.debounce",
    scenarios: ["S-IO-FC"],
    metadataFields: [
      "workspaceId",
      "normalizedPathHash",
      "eventKind",
      "rawCount",
      "emittedCount",
      "coalesceRatio",
      "emptyBatchEmitted",
      "evidenceClass",
    ],
    target: {
      fs_event_emitted_per_sec: 10,
      fs_event_same_path_coalesce_ratio: 0.8,
      fs_event_empty_batch_emit_count: 0,
    },
    fs_event_raw_per_sec: raw?.value ?? null,
    fs_event_emitted_per_sec: emit?.value ?? null,
    fs_event_same_path_coalesce_ratio: samePath?.value ?? null,
    fs_event_empty_batch_emit_count: emptyBatch?.value ?? null,
    evidenceClass: raw?.evidenceClass
      ?? emit?.evidenceClass
      ?? samePath?.evidenceClass
      ?? emptyBatch?.evidenceClass
      ?? "unsupported",
    reason: "Debounce emitter is added by the file watcher debounce step; current fixture does not yet produce same-path burst events.",
    nextAction: "Generate a 1000-event same-path burst fixture and capture raw vs emitted counts.",
  };
}

function buildAppServerEventBatchingSummary(perfEvidence) {
  const rawRate = findMetric(perfEvidence, "S-IO-AS", "app_server_event_raw_per_sec");
  const ipcRate = findMetric(perfEvidence, "S-IO-AS", "app_server_event_ipc_emit_per_sec");
  const route = findMetric(perfEvidence, "S-IO-AS", "app_server_event_route_ms_p95");
  const dispatches = findMetric(perfEvidence, "S-IO-AS", "realtime_reducer_dispatches_per_1000_delta");
  const longTasks = findMetric(perfEvidence, "S-IO-AS", "main_thread_long_task_count_during_stream");
  return {
    diagnosticsLabel: "perf.app-server-event.batching",
    scenarios: ["S-IO-AS"],
    metadataFields: [
      "workspaceId",
      "eventKind",
      "rawCount",
      "ipcEmitCount",
      "routeDurationMs",
      "reducerDispatchCount",
      "mainThreadLongTaskCount",
      "evidenceClass",
    ],
    target: {
      // IPC emit rate must be far below raw rate when batching is enabled.
      ipcEmitToRawRatioMax: 0.1,
      app_server_event_route_ms_p95: 4,
      realtime_reducer_dispatches_per_1000_delta: 1000,
      main_thread_long_task_count_during_stream: 0,
    },
    app_server_event_raw_per_sec: rawRate?.value ?? null,
    app_server_event_ipc_emit_per_sec: ipcRate?.value ?? null,
    app_server_event_route_ms_p95: route?.value ?? null,
    realtime_reducer_dispatches_per_1000_delta: dispatches?.value ?? null,
    main_thread_long_task_count_during_stream: longTasks?.value ?? null,
    evidenceClass: rawRate?.evidenceClass
      ?? ipcRate?.evidenceClass
      ?? route?.evidenceClass
      ?? dispatches?.evidenceClass
      ?? longTasks?.evidenceClass
      ?? "unsupported",
    reason: "App server event batching emitter and batch-aware route are added by the batching step.",
    nextAction: "Capture raw vs IPC emit divergence and reducer dispatch count in a multi-workspace codex streaming fixture.",
  };
}

function buildFrontendPropChainStabilitySummary(perfEvidence) {
  const composerRenders = findMetric(perfEvidence, "S-IO-FP", "composer_render_count_per_streaming_minute");
  const sidebarRenders = findMetric(perfEvidence, "S-IO-FP", "sidebar_render_count_per_streaming_minute");
  const rowRerender = findMetric(perfEvidence, "S-IO-FP", "thread_row_rerender_count_per_1000_delta");
  const layoutRecompute = findMetric(perfEvidence, "S-IO-FP", "layout_nodes_recompute_count_per_1000_delta");
  return {
    diagnosticsLabel: "perf.frontend.prop-chain-stability",
    scenarios: ["S-IO-FP"],
    metadataFields: [
      "componentName",
      "renderCount",
      "rerenderSource",
      "evidenceClass",
    ],
    target: {
      composer_render_count_per_streaming_minute: 1800,
      sidebar_render_count_per_streaming_minute: 600,
      thread_row_rerender_count_per_1000_delta: 100,
      layout_nodes_recompute_count_per_1000_delta: 100,
    },
    composer_render_count_per_streaming_minute: composerRenders?.value ?? null,
    sidebar_render_count_per_streaming_minute: sidebarRenders?.value ?? null,
    thread_row_rerender_count_per_1000_delta: rowRerender?.value ?? null,
    layout_nodes_recompute_count_per_1000_delta: layoutRecompute?.value ?? null,
    evidenceClass: composerRenders?.evidenceClass
      ?? sidebarRenders?.evidenceClass
      ?? rowRerender?.evidenceClass
      ?? layoutRecompute?.evidenceClass
      ?? "unsupported",
    reason: "Domain context split and scoped status lookup are added by the prop chain stability step; render counters need source.",
    nextAction: "Add Profiler-based render counters or React Profiler API capture during the streaming fixture.",
  };
}


function qualifierForChange(changeName) {
  if (
    changeName.includes("session")
    || changeName.includes("stale-thread")
    || changeName.includes("sidebar-list")
    || changeName.includes("claude-sidebar")
  ) {
    return "Keep local manual QA and Windows/Claude-manual qualifiers explicit before archive.";
  }
  if (changeName.includes("optimize") || changeName.includes("perf") || changeName.includes("bundle")) {
    return "Archive only after evidence report identifies measured/proxy/unsupported boundaries.";
  }
  return "Review validation and platform qualifiers before archive.";
}

function buildArchiveReadiness(openSpecState) {
  const changes = Array.isArray(openSpecState?.changes) ? openSpecState.changes : [];
  const completed = changes
    .filter((change) => change.status === "complete" && !CLOSURE_CHANGE_NAMES.has(change.name))
    .map((change) => ({
      name: change.name,
      tasks: `${change.completedTasks}/${change.totalTasks}`,
      recommendation: "archive-candidate-after-qualifier-review",
      qualifier: qualifierForChange(change.name),
    }));
  const previousArchiveContext = changes
    .filter((change) => change.status === "complete" && CLOSURE_CHANGE_NAMES.has(change.name))
    .map((change) => ({
      name: change.name,
      tasks: `${change.completedTasks}/${change.totalTasks}`,
      recommendation: "previous-closure-context",
      qualifier: "Retained as historical closure context; not a current completed-active archive candidate.",
    }));
  const inProgress = changes
    .filter((change) => change.status !== "complete")
    .map((change) => ({
      name: change.name,
      tasks: `${change.completedTasks}/${change.totalTasks}`,
      recommendation: "not-archive-ready",
    }));
  return {
    source: "openspec list --json",
    completed,
    previousArchiveContext,
    inProgress,
    error: openSpecState?.error ?? null,
  };
}

function splitFacadeNote(path) {
  if (path === "src/services/tauri.ts") {
    return "Preserve service exports, payload mapping, and web/Tauri fallback semantics.";
  }
  if (path.startsWith("src-tauri/src/")) {
    return "Preserve command registration, Rust module facade, payload shape, and cross-platform paths.";
  }
  if (path.includes("/hooks/")) {
    return "Preserve hook input/output shape and async cleanup semantics.";
  }
  if (path.startsWith("src/styles/")) {
    return "Preserve selector names, import order, and cascade compatibility.";
  }
  if (path.startsWith("src/i18n/")) {
    return "Passive i18n debt; do not displace P0/P1 runtime hot-path cleanup.";
  }
  if (path.endsWith(".test.tsx") || path.endsWith(".test.ts")) {
    return "Test debt; split only with matching test readability and coverage preservation.";
  }
  return "Declare public facade before splitting.";
}

function largeFileOwner(path) {
  if (path.startsWith("src-tauri/src/engine/")) {
    return "backend-engine-runtime";
  }
  if (path.startsWith("src-tauri/src/codex/")) {
    return "backend-codex-runtime";
  }
  if (path.startsWith("src-tauri/src/git/")) {
    return "backend-git-runtime";
  }
  if (path.startsWith("src-tauri/src/runtime/")) {
    return "backend-runtime";
  }
  if (path.startsWith("src-tauri/src/bin/")) {
    return "daemon-runtime";
  }
  if (path.startsWith("src-tauri/src/")) {
    return "backend-runtime";
  }
  if (path.startsWith("src/services/tauri")) {
    return "frontend-tauri-bridge";
  }
  if (path.startsWith("src/features/threads/")) {
    return "frontend-thread-runtime";
  }
  return "code-health";
}

function largeFileFollowUp(finding) {
  const headroom = toFiniteNumber(finding.failThreshold) == null || toFiniteNumber(finding.lines) == null
    ? "unknown headroom"
    : `${toFiniteNumber(finding.failThreshold) - toFiniteNumber(finding.lines)} lines headroom`;
  return `${splitFacadeNote(finding.path)} Next split must be scoped to ${finding.policyId ?? "current policy"} (${headroom}).`;
}

function buildLargeFileSummary(largeFileReport) {
  const findings = Array.isArray(largeFileReport?.results) ? largeFileReport.results : [];
  const ranked = findings
    .map((finding) => {
      const failThreshold = toFiniteNumber(finding.failThreshold);
      const lines = toFiniteNumber(finding.lines);
      return {
        path: finding.path,
        lines: finding.lines,
        priority: finding.priority,
        policyId: finding.policyId,
        headroom: failThreshold == null || lines == null ? null : failThreshold - lines,
        owner: largeFileOwner(finding.path),
        followUp: largeFileFollowUp(finding),
        facade: splitFacadeNote(finding.path),
      };
    })
    .sort((left, right) => {
      const priorityOrder = { P0: 0, P1: 1, P2: 2 };
      return (priorityOrder[left.priority] ?? 3) - (priorityOrder[right.priority] ?? 3)
        || (left.headroom ?? Number.POSITIVE_INFINITY) - (right.headroom ?? Number.POSITIVE_INFINITY)
        || left.path.localeCompare(right.path);
    });
  return {
    source: existsSync(repoPath(LARGE_FILE_WATCHLIST_PATH)) ? LARGE_FILE_WATCHLIST_PATH : null,
    generatedAt: largeFileReport?.generatedAt ?? null,
    status: largeFileReport?.status ?? "missing",
    candidates: ranked.slice(0, 10),
    nextAction: ranked.length === 0
      ? "Run npm run check:large-files:near-threshold before selecting a split batch."
      : "Pick one coherent runtime boundary; do not batch unrelated hot paths together.",
  };
}

function createPerfMarkdown(report) {
  const lines = [
    "# Runtime Evidence Gates",
    "",
    `Generated at: ${report.generatedAt}`,
    "",
    "## Performance Evidence",
    "",
    "| Source | Scenario | Metric | Value | Unit | Class | Target | Hard Fail | Reason | Next Action |",
    "|---|---|---|---:|---|---|---:|---:|---|---|",
  ];
  for (const entry of report.performanceEvidence) {
    lines.push(`| ${markdownCell(entry.source)} | ${markdownCell(entry.scenario)} | ${markdownCell(entry.metric)} | ${markdownCell(entry.value ?? "unsupported")} | ${markdownCell(entry.unit)} | ${entry.evidenceClass} | ${markdownCell(entry.budget?.target ?? "")} | ${markdownCell(entry.budget?.hardFail ?? "")} | ${markdownCell(entry.reason)} | ${markdownCell(entry.nextAction)} |`);
  }
  lines.push("", "## Realtime Correlation", "");
  lines.push(`- First token latency: ${report.realtimeSummary.firstTokenLatencyMs ?? "unsupported"} ms`);
  lines.push(`- Inter-token jitter P95: ${report.realtimeSummary.interTokenJitterP95Ms ?? "unsupported"} ms`);
  lines.push(`- Visible text lag P95: ${report.realtimeSummary.visibleTextLagP95Ms ?? "unsupported"} ms (turn-trace correlation gate)`);
  lines.push(`- Reducer amplification median: ${report.realtimeSummary.reducerAmplificationMedian ?? "unsupported"} ratio`);
  lines.push(`- Batch flush duration P95: ${report.realtimeSummary.batchFlushDurationP95Ms ?? "unsupported"} ms`);
  lines.push(`- Terminal settlement P95: ${report.realtimeSummary.terminalSettlementP95Ms ?? "unsupported"} ms`);
  lines.push(`- Visible lag risk: ${report.realtimeSummary.visibleLagRisk}`);
  lines.push(`- Terminal pressure: ${report.realtimeSummary.terminalPressure}`);
  lines.push(`- Turn trace evidence class: ${report.realtimeSummary.turnTraceEvidenceClass ?? "unsupported"} (source: ${report.realtimeSummary.turnTraceSource ?? "n/a"})`);
  lines.push(`- Next action: ${report.realtimeSummary.nextAction}`);
  lines.push("", "## Renderer Resource Pressure", "");
  lines.push(`- Backpressure flush cap: ${report.rendererResourceSummary.backpressure.eventFlushCap} events / ${report.rendererResourceSummary.backpressure.byteFlushCap} bytes`);
  lines.push(`- Backpressure evidence: ${report.rendererResourceSummary.backpressure.evidenceClass}`);
  lines.push(`- Listener owner pilot surfaces: ${report.rendererResourceSummary.listenerOwners.migratedPilotSurfaces.join(", ")}`);
  lines.push(`- Media owner pilot surfaces: ${report.rendererResourceSummary.mediaOwners.migratedPilotSurfaces.join(", ")}`);
  lines.push(`- Residual listener risk: ${report.rendererResourceSummary.listenerOwners.residualRisk}`);
  lines.push("", "## Backend IO / Bridge Payload", "");
  lines.push(`- Scan cache substrate: ${report.backendBridgeSummary.substrate.scanCache.api}`);
  lines.push(`- JSONL states: ${report.backendBridgeSummary.substrate.jsonlAppendOnly.states.join(", ")}`);
  lines.push(`- Bridge pilot command: ${report.backendBridgeSummary.bridgePayload.pilotCommand}`);
  lines.push(`- Bridge payload target: ${report.backendBridgeSummary.bridgePayload.targetBytes} bytes / ${report.backendBridgeSummary.bridgePayload.targetItems} items`);
  lines.push(`- Bridge residual risk: ${report.backendBridgeSummary.residualRisk.join(", ")}`);
  lines.push("", "## Workspace File Listing", "");
  lines.push(`- Diagnostics label: ${report.workspaceFileListingSummary.diagnosticsLabel}`);
  lines.push(`- Initial listing target: ${report.workspaceFileListingSummary.initialListing.targetPayloadBytes} bytes / ${report.workspaceFileListingSummary.initialListing.targetEntries} entries`);
  lines.push(`- Subtree target entries: ${report.workspaceFileListingSummary.subtreeListing.targetEntries}`);
  lines.push(`- Shared index fields: ${report.workspaceFileListingSummary.sharedIndex.contract.join(", ")}`);
  lines.push(`- Long-list commit P95: ${report.workspaceFileListingSummary.longListProxy.commitDurationP95Ms ?? "unsupported"} ms`);
  lines.push(`- Browser scroll drop: ${report.workspaceFileListingSummary.longListProxy.browserScrollFrameDropPct ?? "unsupported"}%`);
  lines.push(`- Content safety: ${report.workspaceFileListingSummary.contentSafety}`);
  lines.push("", "## Markdown Precompute", "");
  lines.push(`- Diagnostics label: ${report.markdownPrecomputeSummary.diagnosticsLabel}`);
  lines.push(`- Threshold: ${report.markdownPrecomputeSummary.threshold.minLengthChars} chars or ${report.markdownPrecomputeSummary.threshold.complexitySignals.join(", ")}`);
  lines.push(`- Modes: ${report.markdownPrecomputeSummary.modes.join(", ")}`);
  lines.push(`- Unsafe HTML boundary: ${report.markdownPrecomputeSummary.unsafeHtmlBoundary}`);
  lines.push(`- Content safety: ${report.markdownPrecomputeSummary.contentSafety}`);
  lines.push("", "## Realtime Input Render Budget", "");
  lines.push(`- Diagnostics label: ${report.realtimeInputRenderBudgetSummary.diagnosticsLabel}`);
  lines.push(`- prepareThreadItems calls / 1000 delta: ${report.realtimeInputRenderBudgetSummary.prepareThreadItems_calls_per_1000_delta ?? "unsupported"} (target ${report.realtimeInputRenderBudgetSummary.target.prepareThreadItemsCallsPer1000Delta})`);
  lines.push(`- Reducer flush P95: ${report.realtimeInputRenderBudgetSummary.thread_reducer_flush_ms_p95 ?? "unsupported"} ms (target ${report.realtimeInputRenderBudgetSummary.target.threadReducerFlushMsP95})`);
  lines.push(`- Delta route P95: ${report.realtimeInputRenderBudgetSummary.realtime_delta_route_ms_p95 ?? "unsupported"} ms (target ${report.realtimeInputRenderBudgetSummary.target.realtimeDeltaRouteMsP95})`);
  lines.push(`- Evidence class: ${report.realtimeInputRenderBudgetSummary.evidenceClass}`);
  lines.push(`- Reason: ${report.realtimeInputRenderBudgetSummary.reason}`);
  lines.push(`- Next action: ${report.realtimeInputRenderBudgetSummary.nextAction}`);
  lines.push("", "## Backend File IO Isolation", "");
  lines.push(`- Diagnostics label: ${report.backendFileIoIsolationSummary.diagnosticsLabel}`);
  lines.push(`- File I/O command wall P95: ${report.backendFileIoIsolationSummary.file_io_command_wall_ms_p95 ?? "unsupported"} ms (no artificial 5ms budget)`);
  lines.push(`- Async worker stall P95: ${report.backendFileIoIsolationSummary.file_io_async_worker_stall_ms_p95 ?? "unsupported"} ms (target ${report.backendFileIoIsolationSummary.target.file_io_async_worker_stall_ms_p95_target})`);
  lines.push(`- Blocking pool call count: ${report.backendFileIoIsolationSummary.file_io_blocking_pool_call_count ?? "unsupported"}`);
  lines.push(`- Tauri command during stream P95: ${report.backendFileIoIsolationSummary.tauri_command_during_stream_ms_p95 ?? "unsupported"} ms`);
  lines.push(`- Evidence class: ${report.backendFileIoIsolationSummary.evidenceClass}`);
  lines.push(`- Reason: ${report.backendFileIoIsolationSummary.reason}`);
  lines.push(`- Next action: ${report.backendFileIoIsolationSummary.nextAction}`);
  lines.push("", "## File Change Debounce", "");
  lines.push(`- Diagnostics label: ${report.fileChangeEventDebounceSummary.diagnosticsLabel}`);
  lines.push(`- Raw fs events / sec: ${report.fileChangeEventDebounceSummary.fs_event_raw_per_sec ?? "unsupported"}`);
  lines.push(`- Emitted fs events / sec: ${report.fileChangeEventDebounceSummary.fs_event_emitted_per_sec ?? "unsupported"} (target ${report.fileChangeEventDebounceSummary.target.fs_event_emitted_per_sec})`);
  lines.push(`- Same-path coalesce ratio: ${report.fileChangeEventDebounceSummary.fs_event_same_path_coalesce_ratio ?? "unsupported"} (target ${report.fileChangeEventDebounceSummary.target.fs_event_same_path_coalesce_ratio})`);
  lines.push(`- Empty batch emit count: ${report.fileChangeEventDebounceSummary.fs_event_empty_batch_emit_count ?? "unsupported"} (target ${report.fileChangeEventDebounceSummary.target.fs_event_empty_batch_emit_count})`);
  lines.push(`- Evidence class: ${report.fileChangeEventDebounceSummary.evidenceClass}`);
  lines.push(`- Reason: ${report.fileChangeEventDebounceSummary.reason}`);
  lines.push(`- Next action: ${report.fileChangeEventDebounceSummary.nextAction}`);
  lines.push("", "## App Server Event Batching", "");
  lines.push(`- Diagnostics label: ${report.appServerEventBatchingSummary.diagnosticsLabel}`);
  lines.push(`- Raw app server events / sec: ${report.appServerEventBatchingSummary.app_server_event_raw_per_sec ?? "unsupported"}`);
  lines.push(`- IPC app server events / sec: ${report.appServerEventBatchingSummary.app_server_event_ipc_emit_per_sec ?? "unsupported"} (target ipcEmit/raw ratio ${report.appServerEventBatchingSummary.target.ipcEmitToRawRatioMax})`);
  lines.push(`- Route P95: ${report.appServerEventBatchingSummary.app_server_event_route_ms_p95 ?? "unsupported"} ms (target ${report.appServerEventBatchingSummary.target.app_server_event_route_ms_p95})`);
  lines.push(`- Reducer dispatches / 1000 delta: ${report.appServerEventBatchingSummary.realtime_reducer_dispatches_per_1000_delta ?? "unsupported"} (target ${report.appServerEventBatchingSummary.target.realtime_reducer_dispatches_per_1000_delta})`);
  lines.push(`- Main thread long tasks during stream: ${report.appServerEventBatchingSummary.main_thread_long_task_count_during_stream ?? "unsupported"} (target ${report.appServerEventBatchingSummary.target.main_thread_long_task_count_during_stream})`);
  lines.push(`- Evidence class: ${report.appServerEventBatchingSummary.evidenceClass}`);
  lines.push(`- Reason: ${report.appServerEventBatchingSummary.reason}`);
  lines.push(`- Next action: ${report.appServerEventBatchingSummary.nextAction}`);
  lines.push("", "## Frontend Prop Chain Stability", "");
  lines.push(`- Diagnostics label: ${report.frontendPropChainStabilitySummary.diagnosticsLabel}`);
  lines.push(`- Composer renders / streaming minute: ${report.frontendPropChainStabilitySummary.composer_render_count_per_streaming_minute ?? "unsupported"} (target ${report.frontendPropChainStabilitySummary.target.composer_render_count_per_streaming_minute})`);
  lines.push(`- Sidebar renders / streaming minute: ${report.frontendPropChainStabilitySummary.sidebar_render_count_per_streaming_minute ?? "unsupported"} (target ${report.frontendPropChainStabilitySummary.target.sidebar_render_count_per_streaming_minute})`);
  lines.push(`- Thread row rerenders / 1000 delta: ${report.frontendPropChainStabilitySummary.thread_row_rerender_count_per_1000_delta ?? "unsupported"} (target ${report.frontendPropChainStabilitySummary.target.thread_row_rerender_count_per_1000_delta})`);
  lines.push(`- Layout nodes recomputes / 1000 delta: ${report.frontendPropChainStabilitySummary.layout_nodes_recompute_count_per_1000_delta ?? "unsupported"} (target ${report.frontendPropChainStabilitySummary.target.layout_nodes_recompute_count_per_1000_delta})`);
  lines.push(`- Evidence class: ${report.frontendPropChainStabilitySummary.evidenceClass}`);
  lines.push(`- Reason: ${report.frontendPropChainStabilitySummary.reason}`);
  lines.push(`- Next action: ${report.frontendPropChainStabilitySummary.nextAction}`);
  lines.push("", "## Cold Start", "");

  lines.push(`- First paint evidence: ${report.coldStartSummary.firstPaintEvidence}`);
  lines.push(`- First interactive evidence: ${report.coldStartSummary.firstInteractiveEvidence}`);
  lines.push(`- Reason: ${report.coldStartSummary.reason}`);
  lines.push(`- Next action: ${report.coldStartSummary.nextAction}`);
  lines.push("");
  return lines.join("\n");
}

function createOpenSpecMarkdown(report) {
  const lines = [
    "# Runtime Evidence Gate Governance Report",
    "",
    `Generated at: ${report.generatedAt}`,
    "",
    "## Archive Readiness",
    "",
    "| Change | Tasks | Recommendation | Qualifier |",
    "|---|---:|---|---|",
  ];
  for (const change of report.archiveReadiness.completed) {
    lines.push(`| ${markdownCell(change.name)} | ${change.tasks} | ${change.recommendation} | ${markdownCell(change.qualifier)} |`);
  }
  if (report.archiveReadiness.previousArchiveContext?.length > 0) {
    lines.push("", "## Previous Archive Context", "");
    for (const change of report.archiveReadiness.previousArchiveContext) {
      lines.push(`- ${change.name}: ${change.tasks}, ${change.recommendation}. ${change.qualifier}`);
    }
  }
  lines.push("", "## In Progress", "");
  if (report.archiveReadiness.inProgress.length === 0) {
    lines.push("- No in-progress active changes.");
  } else {
    for (const change of report.archiveReadiness.inProgress) {
      lines.push(`- ${change.name}: ${change.tasks}, ${change.recommendation}`);
    }
  }
  lines.push("", "## Compatibility / Cleanup Matrix", "");
  lines.push("| Path | Classification | Reason | Verification |");
  lines.push("|---|---|---|---|");
  for (const entry of report.compatibilityPaths) {
    lines.push(`| ${markdownCell(entry.name)} | ${entry.classification} | ${markdownCell(entry.reason)} | ${markdownCell(entry.verification)} |`);
  }
  lines.push("", "## Large-File Optimization Queue", "");
  lines.push(`Source: ${report.largeFileSummary.source ?? "missing"}`);
  lines.push("");
  lines.push("| Path | Priority | Lines | Headroom | Facade / Boundary |");
  lines.push("|---|---|---:|---:|---|");
  for (const candidate of report.largeFileSummary.candidates) {
    lines.push(`| ${markdownCell(candidate.path)} | ${candidate.priority} | ${candidate.lines} | ${candidate.headroom ?? "n/a"} | ${markdownCell(candidate.facade)} |`);
  }
  lines.push("", `Next action: ${report.largeFileSummary.nextAction}`, "");
  return lines.join("\n");
}

async function main() {
  const perfBaseline = await readJsonIfExists(PERF_BASELINE_PATH);
  const composerBaseline = await readJsonIfExists(COMPOSER_BASELINE_PATH);
  const browserScroll = await readJsonIfExists(BROWSER_SCROLL_PATH);
  const realtimeTurnTrace = await readJsonIfExists(REALTIME_TURN_TRACE_PATH);
  const realtimeRuntimeEvidence = await readJsonIfExists(REALTIME_RUNTIME_EVIDENCE_PATH);
  const longrunningRuntimeEvidence = await readJsonIfExists(LONGRUNNING_RUNTIME_EVIDENCE_PATH);
  const realtimeProfile = await readJsonlIfExists(REALTIME_PROFILE_PATH);
  const largeFileReport = await readJsonIfExists(LARGE_FILE_WATCHLIST_PATH);
  const openSpecState = runJson("openspec", ["list", "--json"]);
  const performanceEvidence = buildPerfEvidence([
    { path: PERF_BASELINE_PATH, fragment: perfBaseline },
    { path: COMPOSER_BASELINE_PATH, fragment: composerBaseline },
    { path: BROWSER_SCROLL_PATH, fragment: browserScroll },
    { path: REALTIME_RUNTIME_EVIDENCE_PATH, fragment: realtimeRuntimeEvidence },
    { path: LONGRUNNING_RUNTIME_EVIDENCE_PATH, fragment: longrunningRuntimeEvidence },
  ]);
  performanceEvidence.push(...buildRealtimeProfileEvidence(realtimeProfile));
  // Enrich baseline rows in place; the function mutates and returns the same array.
  const realtimeTraceBudgets = buildRealtimeTraceBudgets(performanceEvidence);
  const report = {
    schemaVersion: "1.0",
    generatedAt: new Date().toISOString(),
    sources: {
      perfBaseline: existsSync(repoPath(PERF_BASELINE_PATH)) ? PERF_BASELINE_PATH : null,
      composerBaseline: existsSync(repoPath(COMPOSER_BASELINE_PATH)) ? COMPOSER_BASELINE_PATH : null,
      browserScroll: existsSync(repoPath(BROWSER_SCROLL_PATH)) ? BROWSER_SCROLL_PATH : null,
      realtimeTurnTrace: existsSync(repoPath(REALTIME_TURN_TRACE_PATH)) ? REALTIME_TURN_TRACE_PATH : null,
      realtimeRuntimeEvidence: existsSync(repoPath(REALTIME_RUNTIME_EVIDENCE_PATH)) ? REALTIME_RUNTIME_EVIDENCE_PATH : null,
      longrunningRuntimeEvidence: existsSync(repoPath(LONGRUNNING_RUNTIME_EVIDENCE_PATH)) ? LONGRUNNING_RUNTIME_EVIDENCE_PATH : null,
      realtimeProfile: existsSync(repoPath(REALTIME_PROFILE_PATH)) ? REALTIME_PROFILE_PATH : null,
      largeFileWatchlist: existsSync(repoPath(LARGE_FILE_WATCHLIST_PATH)) ? LARGE_FILE_WATCHLIST_PATH : null,
      openSpec: "openspec list --json",
    },
    performanceEvidence,
    realtimeSummary: buildRealtimeSummary(performanceEvidence, realtimeTurnTrace),
    rendererResourceSummary: buildRendererResourceSummary(performanceEvidence),
    backendBridgeSummary: buildBackendBridgeSummary(),
    workspaceFileListingSummary: buildWorkspaceFileListingSummary(performanceEvidence),
    markdownPrecomputeSummary: buildMarkdownPrecomputeSummary(),
    realtimeInputRenderBudgetSummary: buildRealtimeInputRenderBudgetSummary(performanceEvidence),
    backendFileIoIsolationSummary: buildBackendFileIoIsolationSummary(performanceEvidence),
    fileChangeEventDebounceSummary: buildFileChangeEventDebounceSummary(performanceEvidence),
    appServerEventBatchingSummary: buildAppServerEventBatchingSummary(performanceEvidence),
    frontendPropChainStabilitySummary: buildFrontendPropChainStabilitySummary(performanceEvidence),
    realtimeTraceBudgets,
    coldStartSummary: buildColdStartSummary(performanceEvidence),
    archiveReadiness: buildArchiveReadiness(openSpecState),
    compatibilityPaths,
    largeFileSummary: buildLargeFileSummary(largeFileReport),
  };
  await writeText(OUTPUT_JSON_PATH, `${JSON.stringify(report, null, 2)}\n`);
  await writeText(OUTPUT_PERF_MARKDOWN_PATH, createPerfMarkdown(report));
  await writeText(OUTPUT_OPENSPEC_MARKDOWN_PATH, createOpenSpecMarkdown(report));
  console.info(`runtime evidence report written: ${OUTPUT_JSON_PATH}`);
  console.info(`runtime evidence markdown written: ${OUTPUT_PERF_MARKDOWN_PATH}`);
  console.info(`openspec governance report written: ${OUTPUT_OPENSPEC_MARKDOWN_PATH}`);
}

export const runtimeEvidenceReportInternals = {
  buildLargeFileSummary,
  buildBackendBridgeSummary,
  buildWorkspaceFileListingSummary,
  buildMarkdownPrecomputeSummary,
  buildPerfEvidence,
  buildRealtimeProfileEvidence,
  buildRendererResourceSummary,
  buildRealtimeSummary,
  buildRealtimeTraceBudgets,
};

const isDirectExecution =
  process.argv[1] != null &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isDirectExecution) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
