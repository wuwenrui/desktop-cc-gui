import {
  getClientStoreSync,
  isPreloaded,
  writeClientStoreValue,
} from "./clientStorage";
import type {
  RendererHeartbeatInput,
  RendererSupportState,
} from "./tauri/rendererStability";

export type RendererDiagnosticEntry = {
  timestamp: number;
  label: string;
  payload: Record<string, unknown>;
};

const RENDERER_DIAGNOSTICS_KEY = "diagnostics.rendererLifecycleLog";
const MAX_RENDERER_DIAGNOSTICS = 200;
const MAX_PERF_ENTRIES = 1000;
const MAX_REALTIME_TURN_SUMMARIES = 100;
const MAX_STREAM_LATENCY_ENTRIES = 600;
const EARLY_RENDERER_DIAGNOSTICS_STORAGE_KEY = "ccgui.bootstrapRendererDiagnostics";
const DEFAULT_BLANK_WATCHDOG_INTERVAL_MS = 1_500;
const DEFAULT_BLANK_WATCHDOG_MIN_CONSECUTIVE_SAMPLES = 2;
const DEFAULT_BLANK_WATCHDOG_MAX_REPORTS = 6;
const DEFAULT_RENDERER_HEARTBEAT_INTERVAL_MS = 15_000;
const MAX_HEARTBEAT_FAILURE_REPORTS = 3;

let installed = false;
let bufferedEntries: RendererDiagnosticEntry[] = [];
let blankWatchdogTimer: number | null = null;
let blankWatchdogConsecutiveSamples = 0;
let blankWatchdogReports = 0;
let rendererHeartbeatTimer: number | null = null;
let rendererHeartbeatInFlight = false;
let rendererHeartbeatSequence = 0;
let rendererHeartbeatFailureReports = 0;

type BlankScreenWatchdogOptions = {
  rootId?: string;
  intervalMs?: number;
  minConsecutiveSamples?: number;
  maxReports?: number;
};

type RendererHeartbeatOptions = {
  intervalMs?: number;
  appScope?: string;
  rendererId?: string;
  workspaceId?: string | null;
  threadId?: string | null;
};

function trimDiagnostics(entries: RendererDiagnosticEntry[]) {
  const regularEntries: RendererDiagnosticEntry[] = [];
  const perfEntries: RendererDiagnosticEntry[] = [];
  const realtimeTurnSummaryEntries: RendererDiagnosticEntry[] = [];
  const streamLatencyEntries: RendererDiagnosticEntry[] = [];
  for (const entry of entries) {
    if (entry.label === "realtime.turnTrace.summary") {
      realtimeTurnSummaryEntries.push(entry);
    } else if (entry.label.startsWith("stream-latency/")) {
      streamLatencyEntries.push(entry);
    } else if (entry.label.startsWith("perf.")) {
      perfEntries.push(entry);
    } else {
      regularEntries.push(entry);
    }
  }
  return [
    ...regularEntries.slice(Math.max(0, regularEntries.length - MAX_RENDERER_DIAGNOSTICS)),
    ...perfEntries.slice(Math.max(0, perfEntries.length - MAX_PERF_ENTRIES)),
    ...realtimeTurnSummaryEntries.slice(
      Math.max(0, realtimeTurnSummaryEntries.length - MAX_REALTIME_TURN_SUMMARIES),
    ),
    ...streamLatencyEntries.slice(
      Math.max(0, streamLatencyEntries.length - MAX_STREAM_LATENCY_ENTRIES),
    ),
  ].sort((left, right) => left.timestamp - right.timestamp);
}

function mergeDiagnostics(
  ...groups: RendererDiagnosticEntry[][]
): RendererDiagnosticEntry[] {
  const seen = new Set<string>();
  const merged: RendererDiagnosticEntry[] = [];
  for (const group of groups) {
    for (const entry of group) {
      const signature = JSON.stringify(entry);
      if (seen.has(signature)) {
        continue;
      }
      seen.add(signature);
      merged.push(entry);
    }
  }
  return trimDiagnostics(merged);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeDiagnosticEntry(value: unknown): RendererDiagnosticEntry | null {
  if (!isRecord(value)) {
    return null;
  }
  const { timestamp, label, payload } = value;
  if (typeof timestamp !== "number" || !Number.isFinite(timestamp) || typeof label !== "string") {
    return null;
  }
  return {
    timestamp,
    label,
    payload: isRecord(payload) ? payload : {},
  };
}

function normalizeDiagnosticEntries(value: unknown): RendererDiagnosticEntry[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((entry) => {
    const normalized = normalizeDiagnosticEntry(entry);
    return normalized ? [normalized] : [];
  });
}

function formatUnknown(value: unknown): string | null {
  if (value == null) {
    return null;
  }
  if (typeof value === "string") {
    return value;
  }
  if (value instanceof Error) {
    return `${value.name}: ${value.message}`;
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function collectWindowSnapshot(extra: Record<string, unknown> = {}) {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return extra;
  }
  return {
    visibilityState: document.visibilityState,
    readyState: document.readyState,
    hasFocus: typeof document.hasFocus === "function" ? document.hasFocus() : null,
    href: window.location.href,
    ...extra,
  };
}

function collectElementSnapshot(element: HTMLElement | null) {
  if (!element || typeof window === "undefined") {
    return {
      exists: false,
      childElementCount: 0,
      textLength: 0,
      width: 0,
      height: 0,
      display: null,
      visibility: null,
      opacity: null,
    };
  }
  const rect = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);
  return {
    exists: true,
    childElementCount: element.childElementCount,
    textLength: element.textContent?.trim().length ?? 0,
    width: Math.round(rect.width),
    height: Math.round(rect.height),
    display: style.display,
    visibility: style.visibility,
    opacity: style.opacity,
  };
}

function collectRendererBlankScreenSnapshot(rootId: string) {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return null;
  }
  const root = document.getElementById(rootId);
  const rootElement = root instanceof HTMLElement ? root : null;
  const rootSnapshot = collectElementSnapshot(rootElement);
  const bodySnapshot = collectElementSnapshot(document.body);
  const activeElement = document.activeElement;
  return collectWindowSnapshot({
    rootId,
    root: rootSnapshot,
    body: bodySnapshot,
    activeElementTag:
      activeElement instanceof HTMLElement ? activeElement.tagName.toLowerCase() : null,
  });
}

function isBlankRendererSnapshot(snapshot: Record<string, unknown> | null) {
  if (!snapshot) {
    return false;
  }
  const root = snapshot.root;
  const body = snapshot.body;
  if (!isRecord(root) || !isRecord(body)) {
    return false;
  }
  if (root.exists !== true) {
    return true;
  }
  const rootChildElementCount =
    typeof root.childElementCount === "number" ? root.childElementCount : 0;
  const rootTextLength =
    typeof root.textLength === "number" ? root.textLength : 0;
  const rootWidth = typeof root.width === "number" ? root.width : 0;
  const rootHeight = typeof root.height === "number" ? root.height : 0;
  const bodyWidth = typeof body.width === "number" ? body.width : 0;
  const bodyHeight = typeof body.height === "number" ? body.height : 0;
  const rootHidden =
    root.display === "none" ||
    root.visibility === "hidden" ||
    root.opacity === "0";
  const rootHasNoContent = rootChildElementCount === 0 && rootTextLength === 0;
  const rootHasNoArea = rootWidth <= 0 || rootHeight <= 0;
  const bodyHasArea = bodyWidth > 0 && bodyHeight > 0;
  return rootHidden || rootHasNoContent || (bodyHasArea && rootHasNoArea);
}

function persistDiagnostics(entries: RendererDiagnosticEntry[]) {
  writeClientStoreValue("app", RENDERER_DIAGNOSTICS_KEY, entries, { immediate: true });
}

function canUseLocalStorage() {
  return typeof globalThis !== "undefined" && typeof globalThis.localStorage !== "undefined";
}

function readEarlyPersistedDiagnostics(): RendererDiagnosticEntry[] {
  if (!canUseLocalStorage()) {
    return [];
  }
  try {
    const raw = globalThis.localStorage.getItem(EARLY_RENDERER_DIAGNOSTICS_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as unknown;
    return normalizeDiagnosticEntries(parsed);
  } catch {
    return [];
  }
}

function persistEarlyDiagnostics(entries: RendererDiagnosticEntry[]) {
  if (!canUseLocalStorage()) {
    return;
  }
  try {
    if (entries.length === 0) {
      globalThis.localStorage.removeItem(EARLY_RENDERER_DIAGNOSTICS_STORAGE_KEY);
      return;
    }
    globalThis.localStorage.setItem(
      EARLY_RENDERER_DIAGNOSTICS_STORAGE_KEY,
      JSON.stringify(trimDiagnostics(entries)),
    );
  } catch {
    // Ignore localStorage failures, diagnostics are best effort.
  }
}

function readPersistedDiagnostics() {
  const stored = getClientStoreSync<RendererDiagnosticEntry[] | unknown>(
    "app",
    RENDERER_DIAGNOSTICS_KEY,
  );
  return mergeDiagnostics(normalizeDiagnosticEntries(stored), readEarlyPersistedDiagnostics());
}

export function appendRendererDiagnostic(
  label: string,
  payload: Record<string, unknown> = {},
) {
  const entry: RendererDiagnosticEntry = {
    timestamp: Date.now(),
    label,
    payload,
  };

  if (!isPreloaded()) {
    bufferedEntries = trimDiagnostics([...bufferedEntries, entry]);
    persistEarlyDiagnostics(bufferedEntries);
    return;
  }

  const existing = readPersistedDiagnostics();
  const nextEntries = mergeDiagnostics(existing, bufferedEntries, [entry]);
  bufferedEntries = [];
  persistEarlyDiagnostics([]);
  persistDiagnostics(nextEntries);
}

export function appendRendererPerfDiagnostic(
  label: "perf.web-vital",
  payload: Record<string, unknown> = {},
) {
  appendRendererDiagnostic(label, payload);
}

export type ClientInteractionPerfEvidenceKind =
  | "measured"
  | "proxy"
  | "manual-only"
  | "unsupported";

export type ClientInteractionPerfDiagnosticInput = {
  area:
    | "typing"
    | "streaming-controls"
    | "thread-switch"
    | "sidebar-projection"
    | "catalog-hydration";
  evidenceKind: ClientInteractionPerfEvidenceKind;
  workspaceId?: string | null;
  threadId?: string | null;
  engine?: string | null;
  turnId?: string | null;
  inputEventCount?: number | null;
  renderCount?: number | null;
  commitDurationMs?: number | null;
  longTaskCount?: number | null;
  requestCount?: number | null;
  foregroundLatencyMs?: number | null;
  hydrationLatencyMs?: number | null;
  notes?: string | null;
};

export type ComposerRenderBudgetDiagnosticInput = {
  surfaceId: "chat-input-adapter" | "chat-input-box";
  evidenceKind: ClientInteractionPerfEvidenceKind;
  workspaceId?: string | null;
  renderCount: number;
  isProcessing?: boolean;
  disabled?: boolean;
  streamActivityPhase?: string | null;
  textLength?: number | null;
};

export type MessageRowRenderBudgetDiagnosticInput = {
  threadId?: string | null;
  itemId: string;
  role: "user" | "assistant";
  subtype: string;
  evidenceKind: ClientInteractionPerfEvidenceKind;
  renderCount: number;
  isStreaming?: boolean;
  textLength?: number | null;
};

export type EventBackpressureDiagnosticInput = {
  surfaceId: string;
  eventKind: string;
  queueDepth: number;
  droppedCount: number;
  coalescedCount: number;
  flushCount: number;
  lastFlushDurationMs: number;
  criticalBypassCount: number;
  deliveredCount: number;
  rawRetainedCount: number;
  evidenceClass: ClientInteractionPerfEvidenceKind;
};

export type ListenerOwnerDiagnosticInput = {
  activeCount: number;
  inactiveCount: number;
  evidenceClass: ClientInteractionPerfEvidenceKind;
};

export type MediaOwnerDiagnosticInput = {
  activeCount: number;
  revokedCount: number;
  retainedBytes?: number | null;
  unsupportedReason?: string | null;
  evidenceClass: ClientInteractionPerfEvidenceKind;
};

export type MarkdownPrecomputeDiagnosticInput = {
  mode: "worker-precompute" | "main" | "cache-hit" | "fallback";
  durationMs: number;
  contentLength: number;
  contentHash: string;
  thresholdReason: string;
  cacheState: string;
  fallbackReason?: string | null;
  evidenceClass: ClientInteractionPerfEvidenceKind;
  totalHeadings?: number | null;
  totalHeavyBlocks?: number | null;
  totalSourceLines?: number | null;
};

export type WorkspaceFileListingBudgetDiagnosticInput = {
  surfaceId: "initial-listing" | "subtree-listing" | "fallback-full-listing" | "shared-index";
  workspaceId?: string | null;
  durationMs?: number | null;
  returnedEntries: number;
  payloadBytes?: number | null;
  cacheState: string;
  scanState?: string | null;
  partial: boolean;
  limitHit: boolean;
  sourceVersion?: string | null;
  requestedPathHash?: string | null;
  evidenceClass: ClientInteractionPerfEvidenceKind;
  fallbackReason?: string | null;
};

function toFiniteDiagnosticNumber(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, value)
    : null;
}

function toBoundedDiagnosticString(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, 120) : null;
}

function isPerfDiagnosticCollectionEnabled() {
  const env = (import.meta.env ?? {}) as Record<string, string | boolean | undefined>;
  const nodeEnv = typeof process === "undefined" ? undefined : process.env?.NODE_ENV;
  return (
    env.DEV === true ||
    env.VITE_ENABLE_PERF_BASELINE === "1" ||
    nodeEnv === "test"
  );
}

function toSupportState(supported: boolean): RendererSupportState {
  return supported ? "supported" : "unsupported";
}

function getNavigatorPlatform() {
  if (typeof navigator === "undefined") {
    return "unknown";
  }
  const navigatorWithUserAgentData = navigator as Navigator & {
    userAgentData?: { platform?: string };
  };
  return (
    navigatorWithUserAgentData.userAgentData?.platform ||
    navigator.platform ||
    "unknown"
  ).slice(0, 80);
}

function getAppVersion() {
  const env = (import.meta.env ?? {}) as Record<string, string | undefined>;
  return (env.VITE_APP_VERSION || env.PACKAGE_VERSION || "unknown").slice(0, 80);
}

function getLongTaskSupportState(): RendererSupportState {
  if (typeof PerformanceObserver === "undefined") {
    return "unsupported";
  }
  const observer = PerformanceObserver as typeof PerformanceObserver & {
    supportedEntryTypes?: readonly string[];
  };
  return toSupportState(Boolean(observer.supportedEntryTypes?.includes("longtask")));
}

function getMemorySnapshot() {
  if (typeof performance === "undefined" || !("memory" in performance)) {
    return {
      memorySupportState: "unsupported" as RendererSupportState,
      usedJsHeapSize: null,
      totalJsHeapSize: null,
      jsHeapSizeLimit: null,
    };
  }
  const memory = (performance as Performance & {
    memory?: {
      usedJSHeapSize?: number;
      totalJSHeapSize?: number;
      jsHeapSizeLimit?: number;
    };
  }).memory;
  return {
    memorySupportState: "supported" as RendererSupportState,
    usedJsHeapSize: toFiniteDiagnosticNumber(memory?.usedJSHeapSize),
    totalJsHeapSize: toFiniteDiagnosticNumber(memory?.totalJSHeapSize),
    jsHeapSizeLimit: toFiniteDiagnosticNumber(memory?.jsHeapSizeLimit),
  };
}

export function buildRendererHeartbeatPayload(
  options: RendererHeartbeatOptions = {},
): RendererHeartbeatInput {
  const memorySnapshot = getMemorySnapshot();
  const longTaskSupportState = getLongTaskSupportState();
  rendererHeartbeatSequence += 1;
  return {
    appScope: toBoundedDiagnosticString(options.appScope) ?? "main",
    rendererId: toBoundedDiagnosticString(options.rendererId) ?? "main",
    sequence: rendererHeartbeatSequence,
    sentAt: Date.now(),
    platform: getNavigatorPlatform(),
    appVersion: getAppVersion(),
    workspaceId: toBoundedDiagnosticString(options.workspaceId),
    threadId: toBoundedDiagnosticString(options.threadId),
    visibilityState:
      typeof document === "undefined" ? "unknown" : document.visibilityState,
    documentReadyState:
      typeof document === "undefined" ? "unknown" : document.readyState,
    support: {
      nativeProcessFailureHook: "not-implemented",
      memory: memorySnapshot.memorySupportState,
      longTask: longTaskSupportState,
      processCount: "unsupported",
    },
    pressure: {
      activeEngineCount: null,
      activeStreamingTurnCount: null,
      helperProcessCount: null,
      memorySupportState: memorySnapshot.memorySupportState,
      usedJsHeapSize: memorySnapshot.usedJsHeapSize,
      totalJsHeapSize: memorySnapshot.totalJsHeapSize,
      jsHeapSizeLimit: memorySnapshot.jsHeapSizeLimit,
      longTaskSupportState,
      recoveryAttemptCount: 0,
    },
  };
}

async function sendRendererHeartbeat(options: RendererHeartbeatOptions) {
  if (rendererHeartbeatInFlight) {
    return;
  }
  rendererHeartbeatInFlight = true;
  try {
    const { recordRendererHeartbeat } = await import("./tauri/rendererStability");
    await recordRendererHeartbeat(buildRendererHeartbeatPayload(options));
    rendererHeartbeatFailureReports = 0;
  } catch (error) {
    if (rendererHeartbeatFailureReports < MAX_HEARTBEAT_FAILURE_REPORTS) {
      rendererHeartbeatFailureReports += 1;
      appendRendererDiagnostic("renderer/heartbeat-send-failed", {
        error: formatUnknown(error),
        reportCount: rendererHeartbeatFailureReports,
      });
    }
  } finally {
    rendererHeartbeatInFlight = false;
  }
}

export function appendClientInteractionPerfDiagnostic(
  input: ClientInteractionPerfDiagnosticInput,
) {
  appendRendererDiagnostic("perf.client-interaction", {
    area: input.area,
    evidenceKind: input.evidenceKind,
    workspaceId: toBoundedDiagnosticString(input.workspaceId),
    threadId: toBoundedDiagnosticString(input.threadId),
    engine: toBoundedDiagnosticString(input.engine),
    turnId: toBoundedDiagnosticString(input.turnId),
    inputEventCount: toFiniteDiagnosticNumber(input.inputEventCount),
    renderCount: toFiniteDiagnosticNumber(input.renderCount),
    commitDurationMs: toFiniteDiagnosticNumber(input.commitDurationMs),
    longTaskCount: toFiniteDiagnosticNumber(input.longTaskCount),
    requestCount: toFiniteDiagnosticNumber(input.requestCount),
    foregroundLatencyMs: toFiniteDiagnosticNumber(input.foregroundLatencyMs),
    hydrationLatencyMs: toFiniteDiagnosticNumber(input.hydrationLatencyMs),
    notes: toBoundedDiagnosticString(input.notes),
  });
}

export function appendComposerRenderBudgetDiagnostic(
  input: ComposerRenderBudgetDiagnosticInput,
) {
  if (!isPerfDiagnosticCollectionEnabled()) {
    return;
  }
  appendRendererDiagnostic("perf.composer.render-budget", {
    surfaceId: input.surfaceId,
    evidenceKind: input.evidenceKind,
    workspaceId: toBoundedDiagnosticString(input.workspaceId),
    renderCount: toFiniteDiagnosticNumber(input.renderCount),
    isProcessing: Boolean(input.isProcessing),
    disabled: Boolean(input.disabled),
    streamActivityPhase: toBoundedDiagnosticString(input.streamActivityPhase),
    textLength: toFiniteDiagnosticNumber(input.textLength),
  });
}

export function appendMessageRowRenderBudgetDiagnostic(
  input: MessageRowRenderBudgetDiagnosticInput,
) {
  if (!isPerfDiagnosticCollectionEnabled()) {
    return;
  }
  appendRendererDiagnostic("perf.messages.row-render-budget", {
    threadId: toBoundedDiagnosticString(input.threadId),
    itemId: toBoundedDiagnosticString(input.itemId),
    role: input.role,
    subtype: toBoundedDiagnosticString(input.subtype),
    evidenceKind: input.evidenceKind,
    renderCount: toFiniteDiagnosticNumber(input.renderCount),
    isStreaming: Boolean(input.isStreaming),
    textLength: toFiniteDiagnosticNumber(input.textLength),
  });
}

export function appendEventBackpressureDiagnostic(
  input: EventBackpressureDiagnosticInput,
) {
  if (!isPerfDiagnosticCollectionEnabled()) {
    return;
  }
  appendRendererDiagnostic("events.backpressure", {
    surfaceId: toBoundedDiagnosticString(input.surfaceId),
    eventKind: toBoundedDiagnosticString(input.eventKind),
    queueDepth: toFiniteDiagnosticNumber(input.queueDepth),
    droppedCount: toFiniteDiagnosticNumber(input.droppedCount),
    coalescedCount: toFiniteDiagnosticNumber(input.coalescedCount),
    flushCount: toFiniteDiagnosticNumber(input.flushCount),
    lastFlushDurationMs: toFiniteDiagnosticNumber(input.lastFlushDurationMs),
    criticalBypassCount: toFiniteDiagnosticNumber(input.criticalBypassCount),
    deliveredCount: toFiniteDiagnosticNumber(input.deliveredCount),
    rawRetainedCount: toFiniteDiagnosticNumber(input.rawRetainedCount),
    evidenceClass: input.evidenceClass,
  });
}

export function appendListenerOwnerDiagnostic(input: ListenerOwnerDiagnosticInput) {
  if (!isPerfDiagnosticCollectionEnabled()) {
    return;
  }
  appendRendererDiagnostic("listeners.owner-budget", {
    activeCount: toFiniteDiagnosticNumber(input.activeCount),
    inactiveCount: toFiniteDiagnosticNumber(input.inactiveCount),
    evidenceClass: input.evidenceClass,
  });
}

export function appendMediaOwnerDiagnostic(input: MediaOwnerDiagnosticInput) {
  if (!isPerfDiagnosticCollectionEnabled()) {
    return;
  }
  appendRendererDiagnostic("media.owner-budget", {
    activeCount: toFiniteDiagnosticNumber(input.activeCount),
    revokedCount: toFiniteDiagnosticNumber(input.revokedCount),
    retainedBytes: toFiniteDiagnosticNumber(input.retainedBytes),
    unsupportedReason: toBoundedDiagnosticString(input.unsupportedReason),
    evidenceClass: input.evidenceClass,
  });
}

export function appendMarkdownPrecomputeDiagnostic(
  input: MarkdownPrecomputeDiagnosticInput,
) {
  if (!isPerfDiagnosticCollectionEnabled()) {
    return;
  }
  appendRendererDiagnostic("perf.messages.markdown.precompute", {
    mode: input.mode,
    durationMs: toFiniteDiagnosticNumber(input.durationMs),
    contentLength: toFiniteDiagnosticNumber(input.contentLength),
    contentHash: toBoundedDiagnosticString(input.contentHash),
    thresholdReason: toBoundedDiagnosticString(input.thresholdReason),
    cacheState: toBoundedDiagnosticString(input.cacheState),
    fallbackReason: toBoundedDiagnosticString(input.fallbackReason),
    evidenceClass: input.evidenceClass,
    totalHeadings: toFiniteDiagnosticNumber(input.totalHeadings),
    totalHeavyBlocks: toFiniteDiagnosticNumber(input.totalHeavyBlocks),
    totalSourceLines: toFiniteDiagnosticNumber(input.totalSourceLines),
  });
}

export function appendWorkspaceFileListingBudgetDiagnostic(
  input: WorkspaceFileListingBudgetDiagnosticInput,
) {
  if (!isPerfDiagnosticCollectionEnabled()) {
    return;
  }
  appendRendererDiagnostic("workspaces.file.listing-budget", {
    surfaceId: input.surfaceId,
    workspaceId: toBoundedDiagnosticString(input.workspaceId),
    durationMs: toFiniteDiagnosticNumber(input.durationMs),
    returnedEntries: toFiniteDiagnosticNumber(input.returnedEntries),
    payloadBytes: toFiniteDiagnosticNumber(input.payloadBytes),
    cacheState: toBoundedDiagnosticString(input.cacheState),
    scanState: toBoundedDiagnosticString(input.scanState),
    partial: Boolean(input.partial),
    limitHit: Boolean(input.limitHit),
    sourceVersion: toBoundedDiagnosticString(input.sourceVersion),
    requestedPathHash: toBoundedDiagnosticString(input.requestedPathHash),
    evidenceClass: input.evidenceClass,
    fallbackReason: toBoundedDiagnosticString(input.fallbackReason),
  });
}

export function stopRendererBlankScreenWatchdog() {
  if (blankWatchdogTimer === null || typeof window === "undefined") {
    blankWatchdogTimer = null;
    return;
  }
  window.clearInterval(blankWatchdogTimer);
  blankWatchdogTimer = null;
}

export function stopRendererHeartbeat() {
  if (
    rendererHeartbeatTimer === null ||
    typeof window === "undefined" ||
    typeof window.clearInterval !== "function"
  ) {
    rendererHeartbeatTimer = null;
    return;
  }
  window.clearInterval(rendererHeartbeatTimer);
  rendererHeartbeatTimer = null;
}

export function startRendererHeartbeat(options: RendererHeartbeatOptions = {}) {
  if (
    typeof window === "undefined" ||
    typeof document === "undefined" ||
    typeof window.setInterval !== "function"
  ) {
    return;
  }
  if (rendererHeartbeatTimer !== null) {
    return;
  }
  const intervalMs = Math.max(
    5_000,
    options.intervalMs ?? DEFAULT_RENDERER_HEARTBEAT_INTERVAL_MS,
  );
  void sendRendererHeartbeat(options);
  rendererHeartbeatTimer = window.setInterval(() => {
    void sendRendererHeartbeat(options);
  }, intervalMs);
}

export function startRendererBlankScreenWatchdog(
  options: BlankScreenWatchdogOptions = {},
) {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return;
  }
  if (blankWatchdogTimer !== null) {
    return;
  }
  const rootId = options.rootId ?? "root";
  const intervalMs = Math.max(250, options.intervalMs ?? DEFAULT_BLANK_WATCHDOG_INTERVAL_MS);
  const minConsecutiveSamples = Math.max(
    1,
    options.minConsecutiveSamples ?? DEFAULT_BLANK_WATCHDOG_MIN_CONSECUTIVE_SAMPLES,
  );
  const maxReports = Math.max(1, options.maxReports ?? DEFAULT_BLANK_WATCHDOG_MAX_REPORTS);
  blankWatchdogConsecutiveSamples = 0;
  blankWatchdogReports = 0;
  blankWatchdogTimer = window.setInterval(() => {
    const snapshot = collectRendererBlankScreenSnapshot(rootId);
    if (!isBlankRendererSnapshot(snapshot)) {
      blankWatchdogConsecutiveSamples = 0;
      return;
    }
    blankWatchdogConsecutiveSamples += 1;
    if (
      blankWatchdogConsecutiveSamples < minConsecutiveSamples ||
      blankWatchdogReports >= maxReports
    ) {
      return;
    }
    blankWatchdogReports += 1;
    appendRendererDiagnostic("renderer/blank-screen-suspected", {
      consecutiveSamples: blankWatchdogConsecutiveSamples,
      intervalMs,
      ...snapshot,
    });
  }, intervalMs);
}

export function flushRendererDiagnosticsBuffer() {
  if (bufferedEntries.length === 0 && readEarlyPersistedDiagnostics().length === 0) {
    return;
  }
  if (!isPreloaded()) {
    persistEarlyDiagnostics(bufferedEntries);
    return;
  }
  const existing = readPersistedDiagnostics();
  const nextEntries = mergeDiagnostics(existing, bufferedEntries);
  bufferedEntries = [];
  persistEarlyDiagnostics([]);
  persistDiagnostics(nextEntries);
}

export function installRendererLifecycleDiagnostics() {
  if (installed || typeof window === "undefined" || typeof document === "undefined") {
    return;
  }
  installed = true;

  appendRendererDiagnostic("renderer/install", collectWindowSnapshot());
  startRendererHeartbeat();

  window.addEventListener("focus", () => {
    appendRendererDiagnostic("window/focus", collectWindowSnapshot());
  });

  window.addEventListener("blur", () => {
    appendRendererDiagnostic("window/blur", collectWindowSnapshot());
  });

  document.addEventListener("visibilitychange", () => {
    appendRendererDiagnostic(
      "document/visibilitychange",
      collectWindowSnapshot({
        hidden: document.hidden,
      }),
    );
  });

  window.addEventListener("pageshow", (event) => {
    appendRendererDiagnostic(
      "window/pageshow",
      collectWindowSnapshot({
        persisted: event.persisted,
      }),
    );
  });

  window.addEventListener("pagehide", (event) => {
    appendRendererDiagnostic(
      "window/pagehide",
      collectWindowSnapshot({
        persisted: event.persisted,
      }),
    );
  });

  window.addEventListener("error", (event) => {
    appendRendererDiagnostic(
      "window/error",
      collectWindowSnapshot({
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: formatUnknown(event.error),
      }),
    );
  });

  window.addEventListener("unhandledrejection", (event) => {
    appendRendererDiagnostic(
      "window/unhandledrejection",
      collectWindowSnapshot({
        reason: formatUnknown(event.reason),
      }),
    );
  });

  void import("./perfBaseline")
    .then((module) => {
      module.installPerfBaselineWebVitals();
    })
    .catch((error: unknown) => {
      appendRendererDiagnostic("perf.web-vital/install-failed", {
        error: formatUnknown(error),
      });
    });
}
