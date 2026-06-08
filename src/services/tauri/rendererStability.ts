import { invoke, isTauri } from "@tauri-apps/api/core";

export type RendererSupportState = "supported" | "unsupported" | "not-implemented";

export type RendererHeartbeatSupportFlags = {
  nativeProcessFailureHook: RendererSupportState;
  memory: RendererSupportState;
  longTask: RendererSupportState;
  processCount: RendererSupportState;
};

export type RendererHeartbeatPressureSnapshot = {
  activeEngineCount: number | null;
  activeStreamingTurnCount: number | null;
  helperProcessCount: number | null;
  memorySupportState: RendererSupportState;
  usedJsHeapSize: number | null;
  totalJsHeapSize: number | null;
  jsHeapSizeLimit: number | null;
  longTaskSupportState: RendererSupportState;
  recoveryAttemptCount: number;
};

export type RendererHeartbeatInput = {
  appScope: string;
  rendererId: string;
  sequence: number;
  sentAt: number;
  platform: string;
  appVersion: string;
  workspaceId?: string | null;
  threadId?: string | null;
  visibilityState: string;
  documentReadyState: string;
  support: RendererHeartbeatSupportFlags;
  pressure: RendererHeartbeatPressureSnapshot;
};

export type RendererHeartbeatClassification =
  | "healthy"
  | "heartbeat_missed"
  | "unknown";

export type RendererPlatformHookSupport = {
  platform: "windows" | "macos" | "linux";
  webviewRuntime: "webview2" | "wkwebview" | "webkitgtk";
  state: RendererSupportState;
  reason: string;
};

export type RendererHeartbeatStatus = {
  appScope: string;
  classification: RendererHeartbeatClassification;
  thresholdMs: number;
  missedByMs: number | null;
  latest: {
    appScope: string;
    rendererId: string;
    sequence: number;
    sentAt: number;
    receivedAt: number;
    platform: string;
    appVersion: string;
    workspaceId?: string | null;
    threadId?: string | null;
    visibilityState: string;
    documentReadyState: string;
    support: RendererHeartbeatSupportFlags;
    pressure: RendererHeartbeatPressureSnapshot;
  } | null;
  nativeHookSupport: RendererPlatformHookSupport[];
};

export type RendererStabilitySnapshot = {
  statuses: RendererHeartbeatStatus[];
  watchdogDiagnostics: Array<{
    timestamp: number;
    appScope: string;
    label: "renderer.heartbeat_missed";
    missedByMs: number;
    thresholdMs: number;
  }>;
  nativeHookSupport: RendererPlatformHookSupport[];
};

export async function recordRendererHeartbeat(
  input: RendererHeartbeatInput,
): Promise<RendererHeartbeatStatus | null> {
  if (!isTauri()) {
    return null;
  }
  return invoke<RendererHeartbeatStatus>("record_renderer_heartbeat", { input });
}

export async function getRendererStabilitySnapshot(): Promise<RendererStabilitySnapshot | null> {
  if (!isTauri()) {
    return null;
  }
  return invoke<RendererStabilitySnapshot>("get_renderer_stability_snapshot");
}
