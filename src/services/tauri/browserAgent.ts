import { invoke } from "@tauri-apps/api/core";
import type {
  BrowserActionRequest,
  BrowserActionResult,
  BrowserEvidenceCleanupResult,
  BrowserEvidenceRecord,
  BrowserAgentSettings,
  BrowserAgentStatus,
  BrowserSession,
  BrowserSessionCleanupResult,
  BrowserContextSnapshot,
  BrowserCodeCandidate,
  BrowserUrlValidationResult,
  CreateBrowserSessionRequest,
  UpdateBrowserSessionRequest,
  BrowserWebviewBounds,
  BrowserWebviewMountRequest,
  BrowserPlatformCapability,
  BrowserProviderRouteDecision,
} from "../../features/browser-agent/types";

export async function getBrowserAgentStatus(): Promise<BrowserAgentStatus> {
  return invoke<BrowserAgentStatus>("get_browser_agent_status");
}

export async function getBrowserAgentSettings(): Promise<BrowserAgentSettings> {
  return invoke<BrowserAgentSettings>("get_browser_agent_settings");
}

export async function getBrowserAgentPlatformCapability(): Promise<BrowserPlatformCapability> {
  return invoke<BrowserPlatformCapability>(
    "get_browser_agent_platform_capability",
  );
}

export async function routeBrowserAgentProvider(
  requestedCapability: BrowserProviderRouteDecision["requestedCapability"],
  userOverride = false,
): Promise<BrowserProviderRouteDecision> {
  return invoke<BrowserProviderRouteDecision>("route_browser_agent_provider", {
    requestedCapability,
    userOverride,
  });
}

export async function validateBrowserAgentUrl(
  url: string,
  workspaceId?: string | null,
): Promise<BrowserUrlValidationResult> {
  return invoke<BrowserUrlValidationResult>("validate_browser_agent_url", {
    url,
    workspaceId,
  });
}

export async function createBrowserAgentSession(
  request: CreateBrowserSessionRequest,
): Promise<BrowserSession> {
  return invoke<BrowserSession>("create_browser_agent_session", { request });
}

export async function listBrowserAgentSessions(
  workspaceId?: string | null,
): Promise<BrowserSession[]> {
  return invoke<BrowserSession[]>("list_browser_agent_sessions", {
    workspaceId,
  });
}

export async function updateBrowserAgentSession(
  request: UpdateBrowserSessionRequest,
): Promise<BrowserSession> {
  return invoke<BrowserSession>("update_browser_agent_session", { request });
}

export async function closeBrowserAgentSession(
  browserSessionId: string,
): Promise<BrowserSession> {
  return invoke<BrowserSession>("close_browser_agent_session", {
    browserSessionId,
  });
}

export async function cleanupBrowserAgentSessions(
  maxClosedAgeMs?: number | null,
): Promise<BrowserSessionCleanupResult> {
  return invoke<BrowserSessionCleanupResult>("cleanup_browser_agent_sessions", {
    maxClosedAgeMs,
  });
}

export async function mountBrowserAgentWebview(
  request: BrowserWebviewMountRequest,
): Promise<BrowserSession> {
  return invoke<BrowserSession>("mount_browser_agent_webview", { request });
}

export async function openBrowserAgentWindow(
  browserSessionId: string,
  locale?: string | null,
): Promise<BrowserSession> {
  return invoke<BrowserSession>("open_browser_agent_window", {
    browserSessionId,
    locale,
  });
}

export async function syncBrowserAgentWebviewBounds(
  browserSessionId: string,
  bounds: BrowserWebviewBounds,
): Promise<void> {
  return invoke<void>("sync_browser_agent_webview_bounds", {
    browserSessionId,
    bounds,
  });
}

export async function hideBrowserAgentWebview(
  browserSessionId: string,
): Promise<void> {
  return invoke<void>("hide_browser_agent_webview", { browserSessionId });
}

export async function listBrowserAgentEvidence(
  workspaceId?: string | null,
): Promise<BrowserEvidenceRecord[]> {
  return invoke<BrowserEvidenceRecord[]>("list_browser_agent_evidence", {
    workspaceId,
  });
}

export async function cleanupBrowserAgentEvidence(
  now?: number | null,
): Promise<BrowserEvidenceCleanupResult> {
  return invoke<BrowserEvidenceCleanupResult>("cleanup_browser_agent_evidence", {
    now,
  });
}

export async function captureBrowserAgentSnapshot(
  browserSessionId: string,
): Promise<BrowserContextSnapshot> {
  return invoke<BrowserContextSnapshot>("capture_browser_agent_snapshot", {
    browserSessionId,
  });
}

export async function captureBrowserAgentSnapshotV2(
  browserSessionId: string,
): Promise<BrowserContextSnapshot> {
  return invoke<BrowserContextSnapshot>("capture_browser_agent_snapshot_v2", {
    browserSessionId,
  });
}

export async function refreshBrowserAgentSnapshot(
  browserSessionId: string,
): Promise<BrowserContextSnapshot> {
  return invoke<BrowserContextSnapshot>("refresh_browser_agent_snapshot", {
    browserSessionId,
  });
}

export async function generateBrowserAgentCodeCandidates(
  snapshot: BrowserContextSnapshot,
): Promise<BrowserCodeCandidate[]> {
  return invoke<BrowserCodeCandidate[]>("generate_browser_agent_code_candidates", {
    snapshot,
  });
}

export async function runBrowserAgentAction(
  request: BrowserActionRequest,
): Promise<BrowserActionResult> {
  return invoke<BrowserActionResult>("run_browser_agent_action", {
    request,
  });
}
