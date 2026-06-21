import { invoke } from "@tauri-apps/api/core";
import { appendRendererDiagnostic } from "./rendererDiagnostics";
import { open } from "@tauri-apps/plugin-dialog";
import type {
  AppSettings,
  EmailSendError,
  EmailInboundListenerStatus,
  EmailInboundSettingsView,
  EmailMailSessionList,
  EmailSenderSettingsView,
  EmailSendResult,
  CheckEmailInboxRequest,
  CheckEmailInboxResult,
  ClaimMailCommandResult,
  CompleteMailCommandRequest,
  MutateMailSessionRequest,
  SendConversationCompletionEmailRequest,
  SendTestEmailRequest,
  UpdateEmailInboundSettingsRequest,
  UpdateEmailSenderSettingsRequest,
  LocalUsageSnapshot,
  LocalUsageStatistics,
  WorkspaceInfo,
  EngineType,
  CustomPromptOption,
  ReviewTarget,
} from "../types";
import { engineSendMessageSync } from "./tauri/appServer";
export type {
  WorkspaceSessionCatalogEntry,
  WorkspaceSessionCatalogQuery,
  WorkspaceSessionCatalogPage,
  WorkspaceSessionCatalogSourceStatus,
  WorkspaceSessionCatalogDiagnostic,
  WorkspaceSessionArchiveEvidence,
  WorkspaceSessionSourceCacheMetrics,
  WorkspaceSessionSourceCompleteness,
  WorkspaceSessionProjectionSummary,
  WorkspaceSessionBatchMutationResult,
  WorkspaceSessionBatchMutationResponse,
  WorkspaceSessionFolder,
  WorkspaceSessionFolderTree,
  WorkspaceSessionFolderMutation,
  WorkspaceSessionAssignmentResponse,
  AutoSessionMetadata,
} from "./tauri/sessionManagement";
export {
  assignWorkspaceSessionFolders,
  assignWorkspaceSessionFolder,
  archiveWorkspaceSessions,
  createWorkspaceSessionFolder,
  deleteWorkspaceSessionFolder,
  deleteWorkspaceSessions,
  getWorkspaceSessionProjectionSummary,
  listGlobalCodexSessions,
  listProjectRelatedCodexSessions,
  listProjectRelatedSessions,
  listWorkspaceSessionArchiveEvidence,
  listWorkspaceSessionFolders,
  listWorkspaceSessions,
  moveWorkspaceSessionFolder,
  recordAutoSessionMetadata,
  renameWorkspaceSessionFolder,
  unarchiveWorkspaceSessions,
} from "./tauri/sessionManagement";
export type { CodexRuntimeReloadResult } from "./tauri/settings";
export { getCodexConfigPath, getCodexUnifiedExecExternalStatus, reloadCodexRuntimeConfig, restoreCodexUnifiedExecOfficialDefault, setCodexUnifiedExecOfficialOverride } from "./tauri/settings";
export type {
  AgentMdResponse,
  ClaudeMdResponse,
  GlobalAgentsResponse,
  GlobalCodexAuthResponse,
  GlobalCodexConfigResponse,
  TextFileResponse,
} from "./tauri/textFiles";
export {
  readAgentMd,
  readClaudeMd,
  readGlobalAgentsMd,
  readGlobalCodexAuthJson,
  readGlobalCodexConfigToml,
  writeAgentMd,
  writeClaudeMd,
  writeGlobalAgentsMd,
  writeGlobalCodexConfigToml,
} from "./tauri/textFiles";
export { getComputerUseBridgeStatus, runComputerUseActivationProbe, runComputerUseCodexBroker, runComputerUseHostContractDiagnostics } from "./tauri/computerUse";
export {
  getRendererStabilitySnapshot,
  recordRendererHeartbeat,
} from "./tauri/rendererStability";
export type {
  RendererHeartbeatInput,
  RendererHeartbeatStatus,
  RendererPlatformHookSupport,
  RendererStabilitySnapshot,
  RendererSupportState,
} from "./tauri/rendererStability";
export {
  captureBrowserAgentSnapshot,
  captureBrowserAgentSnapshotV2,
  cleanupBrowserAgentEvidence,
  cleanupBrowserAgentSessions,
  closeBrowserAgentSession,
  createBrowserAgentSession,
  generateBrowserAgentCodeCandidates,
  getBrowserAgentPlatformCapability,
  getBrowserAgentSettings,
  getBrowserAgentStatus,
  hideBrowserAgentWebview,
  listBrowserAgentEvidence,
  listBrowserAgentSessions,
  mountBrowserAgentWebview,
  openBrowserAgentWindow,
  refreshBrowserAgentSnapshot,
  routeBrowserAgentProvider,
  runBrowserAgentAction,
  syncBrowserAgentWebviewBounds,
  updateBrowserAgentSession,
  validateBrowserAgentUrl,
} from "./tauri/browserAgent";
export type {
  BrowserActionAuditEntry,
  BrowserActionRequest,
  BrowserActionResult,
  BrowserActionTarget,
  BrowserEvidenceCleanupResult,
  BrowserEvidenceRecord,
  BrowserAgentFeaturePhase,
  BrowserAgentSettings,
  BrowserAgentStatus,
  BrowserContextAttachment,
  BrowserContextSnapshot,
  BrowserCodeCandidate,
  BrowserSession,
  BrowserSessionCleanupResult,
  BrowserSessionStatus,
  BrowserUrlValidationResult,
  CreateBrowserSessionRequest,
  UpdateBrowserSessionRequest,
  BrowserDiagnostic,
  BrowserElementBounds,
  BrowserFormSummary,
  BrowserLandmark,
  BrowserNetworkSummary,
  BrowserPlatformCapability,
  BrowserPrivacyReport,
  BrowserProviderRouteDecision,
  BrowserSnapshotBudget,
  BrowserTextNode,
} from "../features/browser-agent/types";
export { previewCodexLaunchProfile, runClaudeDoctor, runCodexDoctor } from "./tauri/doctor";
export { getCliInstallPlan, runCliInstaller } from "./tauri/cliInstaller";
export type {
  ComputerUseActivationFailureKind,
  ComputerUseActivationOutcome,
  ComputerUseActivationResult,
  ComputerUseAuthorizationBackendMode,
  ComputerUseAuthorizationContinuityKind,
  ComputerUseAuthorizationContinuityStatus,
  ComputerUseAuthorizationHostRole,
  ComputerUseAuthorizationHostSnapshot,
  ComputerUseAuthorizationLaunchMode,
  ComputerUseBrokerFailureKind,
  ComputerUseBrokerOutcome,
  ComputerUseBrokerRequest,
  ComputerUseBrokerResult,
  ComputerUseBridgeStatus,
  ComputerUseHostContractDiagnosticsKind,
  ComputerUseHostContractDiagnosticsResult,
  ComputerUseHostContractEvidence,
  ComputerUseOfficialParentHandoffDiscovery,
  ComputerUseOfficialParentHandoffEvidence,
  ComputerUseOfficialParentHandoffKind,
  ComputerUseOfficialParentHandoffMethod,
} from "../types";
export {
  cancelDictation,
  cancelDictationDownload,
  downloadDictationModel,
  getDictationModelStatus,
  removeDictationModel,
  requestDictationPermission,
  startDictation,
  stopDictation,
} from "./tauri/dictation";
export {
  closeTerminalSession,
  openTerminalSession,
  resizeTerminalSession,
  runtimeLogDetectProfiles,
  runtimeLogGetSession,
  runtimeLogMarkExit,
  runtimeLogStart,
  runtimeLogStop,
  writeTerminalSession,
} from "./tauri/terminalRuntime";
export type { RuntimeLogSessionSnapshot, RuntimeLogSessionStatus, RuntimeProfileDescriptor } from "./tauri/terminalRuntime";
export {
  projectMemoryCaptureAuto,
  projectMemoryCaptureTurnInput,
  projectMemoryCompleteTurn,
  projectMemoryCreate,
  projectMemoryDelete,
  projectMemoryDiagnostics,
  projectMemoryGet,
  projectMemoryGetDetail,
  projectMemoryGetSettings,
  projectMemoryList,
  projectMemoryListSummary,
  projectMemoryReconcile,
  projectMemoryUpdate,
  projectMemoryUpdateSettings,
} from "./tauri/projectMemory";
export type {
  NormalizedConversationTurnPayload,
  ProjectMemoryDiagnosticsResult,
  ProjectMemoryHealthState,
  ProjectMemoryItem,
  ProjectMemoryListResult,
  ProjectMemoryReconcileResult,
  ProjectMemoryReviewState,
  ProjectMemorySettings,
} from "./tauri/projectMemory";
export {
  noteCardArchive,
  noteCardCreate,
  noteCardDelete,
  noteCardGet,
  noteCardList,
  noteCardRestore,
  noteCardUpdate,
} from "./tauri/noteCards";
export type {
  NoteCardAttachment,
  NoteCardPreviewAttachment,
  WorkspaceNoteCard,
  WorkspaceNoteCardListResult,
  WorkspaceNoteCardSummary,
} from "./tauri/noteCards";
export {
  addClaudeProvider,
  addCodexProvider,
  deleteClaudeProvider,
  deleteCodexProvider,
  fetchClaudeProviderModels,
  getClaudeAlwaysThinkingEnabled,
  getClaudeProviders,
  getCodexProviders,
  getCurrentClaudeConfig,
  getGeminiVendorPreflight,
  getGeminiVendorSettings,
  reorderClaudeProviders,
  saveGeminiVendorSettings,
  setClaudeAlwaysThinkingEnabled,
  switchClaudeProvider,
  switchCodexProvider,
  updateClaudeProvider,
  updateCodexProvider,
} from "./tauri/vendors";
export type {
  GeminiVendorPreflightCheck,
  GeminiVendorPreflightResult,
  GeminiVendorSettings,
  VendorModelListResult,
} from "./tauri/vendors";
export {
  addAgentConfig,
  applyImportAgentConfigs,
  deleteAgentConfig,
  exportAgentConfigs,
  getSelectedAgentConfig,
  listAgentConfigs,
  previewImportAgentConfigs,
  setSelectedAgentConfig,
  updateAgentConfig,
} from "./tauri/agents";
export type { WorktreeSetupStatus } from "./tauri/workspaceRuntime";
export {
  addClone,
  addWorkspace,
  addWorktree,
  applyWorktreeChanges,
  appendClientErrorLog,
  connectWorkspace,
  ensureRuntimeReady,
  ensureWorkspacePathDir,
  exportDiagnosticsBundle,
  getOpenAppIcon,
  getRuntimePoolSnapshot,
  getWorktreeSetupStatus,
  isWorkspacePathDir,
  markWorktreeSetupRan,
  mutateRuntimePool,
  noteWebServiceReconnected,
  openNewWindow,
  openWorkspaceIn,
  queryTurnReconciliationStatus,
  readPanelLockPasswordFile,
  removeWorkspace,
  removeWorktree,
  renameWorktree,
  renameWorktreeUpstream,
  updateWorkspaceCodexBin,
  updateWorkspaceSettings,
  writePanelLockPasswordFile,
} from "./tauri/workspaceRuntime";
export type {
  CreateGitPrWorkflowOptions,
  GitPullOptions,
  GitPullStrategyOption,
  GitPushOptions,
  GitResetMode,
} from "./tauri/git";
export {
  checkoutGitBranch,
  cherryPickCommit,
  commitGit,
  createGitBranch,
  createGitBranchFromBranch,
  createGitBranchFromCommit,
  createGitPrWorkflow,
  deleteGitBranch,
  fetchGit,
  getGitBranchCompareCommits,
  getGitBranchDiffBetweenBranches,
  getGitBranchDiffFileBetweenBranches,
  getGitCommitDetails,
  getGitCommitDiff,
  getGitCommitHistory,
  getGitDiffs,
  getGitFileFullDiff,
  getGitHubIssues,
  getGitHubPullRequestComments,
  getGitHubPullRequestDiff,
  getGitHubPullRequests,
  getGitLog,
  getGitPrWorkflowDefaults,
  getGitPushPreview,
  getGitRemote,
  getGitStatus,
  getGitWorktreeDiffAgainstBranch,
  getGitWorktreeDiffFileAgainstBranch,
  listGitBranches,
  listGitRoots,
  mergeGitBranch,
  pullGit,
  pushGit,
  rebaseGitBranch,
  renameGitBranch,
  resetGitCommit,
  resolveGitCommitRef,
  revertCommit,
  revertGitAll,
  revertGitFile,
  stageGitAll,
  stageGitFile,
  syncGit,
  unstageGitFile,
  updateGitBranch,
} from "./tauri/git";
export type {
  DetachedExternalChangeMonitorStatus,
  EngineTaskOutputArtifactTailResponse,
  ExportRewindFilesParams,
  ExportRewindFilesResult,
  ExternalSpecFileResponse,
  FilePreviewHandle,
  WorkspaceCommandResult,
  WorkspaceDirectoryChildState,
  WorkspaceDirectoryEntry,
  WorkspaceDirectorySpecialKind,
  WorkspaceFileItemKind,
  WorkspaceFileListingBudgetMetadata,
  WorkspaceFileListingCacheState,
  WorkspaceFileOperationResult,
  WorkspaceFilesResponse,
  WorkspaceFileScanState,
  WorkspaceTextSearchFileResult,
  WorkspaceTextSearchMatch,
  WorkspaceTextSearchResponse,
} from "./tauri/workspaceFiles";
export {
  clearDetachedExternalChangeMonitor,
  compactProjectCanvasFiles,
  configureDetachedExternalChangeMonitor,
  copyWorkspaceItem,
  createWorkspaceDirectory,
  duplicateWorkspaceItem,
  exportRewindFiles,
  getWorkspaceDirectoryChildren,
  getWorkspaceFiles,
  listExternalAbsoluteDirectoryChildren,
  listExternalSpecTree,
  pasteExternalWorkspaceItems,
  pasteWorkspaceItem,
  readEngineTaskOutputArtifact,
  readExternalAbsoluteFile,
  readExternalSpecFile,
  readLocalImageDataUrl,
  readProjectCanvasFile,
  readWorkspaceFile,
  readWorkspaceFilePreview,
  renameWorkspaceItem,
  resolveFilePreviewHandle,
  runSpecCommand,
  runWorkspaceCommand,
  searchWorkspaceText,
  trashProjectCanvasFile,
  trashWorkspaceItem,
  writeExternalAbsoluteFile,
  writeExternalSpecFile,
  writeProjectCanvasFile,
  writeWorkspaceFile,
} from "./tauri/workspaceFiles";
export {
  getDaemonStatus,
  getWebServerStatus,
  startDaemon,
  startWebServer,
  stopDaemon,
  stopWebServer,
  detectEngines,
  engineInterrupt,
  engineSendMessage,
  engineSendMessageSync,
  getActiveEngine,
  getEngineActiveProcessDiagnostics,
  getEngineModels,
  getEngineStatus,
  switchEngine,
} from "./tauri/appServer";
export type {
  DaemonStatus,
  EngineActiveProcessDiagnostics,
  EngineOsChildLivenessEvidence,
  EngineStaleChildCandidate,
  EngineWorkspaceActiveProcessDiagnostics,
  WebServerStatus,
} from "./tauri/appServer";
export {
  respondToServerRequest,
  respondToUserInputRequest,
  rememberApprovalRule,
} from "./tauri/permission";
export {
  archiveThread,
  deleteClaudeSession,
  deleteCodexSession,
  deleteCodexSessions,
  deleteGeminiSession,
  deleteOpenCodeSession,
  forkClaudeSession,
  forkClaudeSessionFromMessage,
  forkThread,
  hydrateClaudeDeferredImage,
  listClaudeSessions,
  listGeminiSessions,
  listGlobalMcpServers,
  listMcpServerStatus,
  listThreads,
  loadClaudeSession,
  loadCodexSession,
  loadGeminiSession,
  resumeThread,
  rewindCodexThread,
  startThread,
} from "./tauri/session";
export type {
  ClaudeSessionSummaryPayload,
  GlobalMcpServerEntry,
  ThreadListPayload,
  ThreadListResultPayload,
} from "./tauri/session";
export { isWebServiceRuntime } from "./tauri/runtimeMode";
import {
  isMissingTauriInvokeError,
} from "./tauri/runtimeMode";
import { traceStartupCommand, type StartupWorkspaceScope } from "../features/startup-orchestration/utils/startupTrace";

function workspaceScope(workspaceId: string): StartupWorkspaceScope {
  return { workspaceId };
}

function traceStartupInvoke<T>(
  commandLabel: string,
  scope: StartupWorkspaceScope,
  run: () => Promise<T>,
) {
  return traceStartupCommand(commandLabel, scope, run);
}

export async function pickWorkspacePath(): Promise<string | null> {
  const selection = await open({ directory: true, multiple: false });
  if (!selection || Array.isArray(selection)) {
    return null;
  }
  return selection;
}

export async function pickImageFiles(): Promise<string[]> {
  const selection = await open({
    multiple: true,
    filters: [
      {
        name: "Images",
        extensions: ["png", "jpg", "jpeg", "gif", "webp", "bmp", "tiff", "tif"],
      },
    ],
  });
  if (!selection) {
    return [];
  }
  return Array.isArray(selection) ? selection : [selection];
}

export async function pickFiles(): Promise<string[]> {
  const selection = await open({
    multiple: true,
  });
  if (!selection) {
    return [];
  }
  return Array.isArray(selection) ? selection : [selection];
}

export async function listWorkspaces(): Promise<WorkspaceInfo[]> {
  try {
    return await invoke<WorkspaceInfo[]>("list_workspaces");
  } catch (error) {
    if (isMissingTauriInvokeError(error)) {
      // In non-Tauri environments (e.g., Electron/web previews), the invoke
      // bridge may be missing. Treat this as "no workspaces" instead of crashing.
      console.warn("Tauri invoke bridge unavailable; returning empty workspaces list.");
      return [];
    }
    throw error;
  }
}

export async function getConfigModel(workspaceId: string): Promise<string | null> {
  const response = await invoke<{ model?: string | null }>("get_config_model", {
    workspaceId,
  });
  const model = response?.model;
  if (typeof model !== "string") {
    return null;
  }
  const trimmed = model.trim();
  return trimmed.length > 0 ? trimmed : null;
}

type CodexTurnStartAckDiagnosticPayload = {
  workspaceId: string;
  threadId: string;
  model: string | null;
  requestStartedAtMs: number;
  respondedAtMs: number;
  durationMs: number;
  outcome: "ok" | "error";
  errorName?: string;
};

function appendCodexTurnStartAckDiagnostic(payload: CodexTurnStartAckDiagnosticPayload) {
  try {
    appendRendererDiagnostic("stream-latency/codex-turn-start-ack", payload);
  } catch {
    // Diagnostics must not change send_user_message invoke behavior.
  }
}

export async function sendUserMessage(
  workspaceId: string,
  threadId: string,
  text: string,
  options?: {
    model?: string | null;
    effort?: string | null;
    disableThinking?: boolean | null;
    accessMode?: "default" | "read-only" | "current" | "full-access";
    images?: string[];
    collaborationMode?: Record<string, unknown> | null;
    preferredLanguage?: string | null;
    customSpecRoot?: string | null;
    resumeSource?: "queue-fusion-cutover" | null;
    resumeTurnId?: string | null;
  },
) {
  const requestStartedAtMs = Date.now();
  const payload: Record<string, unknown> = {
    workspaceId,
    threadId,
    text,
    model: options?.model ?? null,
    effort: options?.effort ?? null,
    disableThinking: options?.disableThinking ?? false,
    accessMode: options?.accessMode ?? null,
    images: options?.images ?? null,
    preferredLanguage: options?.preferredLanguage ?? null,
    resumeSource: options?.resumeSource ?? null,
    resumeTurnId: options?.resumeTurnId ?? null,
  };
  if (options?.customSpecRoot !== undefined) {
    payload.customSpecRoot = options.customSpecRoot;
  }
  if (options?.collaborationMode) {
    payload.collaborationMode = options.collaborationMode;
  }
  try {
    const response = await invoke("send_user_message", payload);
    const respondedAtMs = Date.now();
    appendCodexTurnStartAckDiagnostic({
      workspaceId,
      threadId,
      model: options?.model ?? null,
      requestStartedAtMs,
      respondedAtMs,
      durationMs: Math.max(0, respondedAtMs - requestStartedAtMs),
      outcome: "ok",
    });
    return response;
  } catch (error) {
    const respondedAtMs = Date.now();
    appendCodexTurnStartAckDiagnostic({
      workspaceId,
      threadId,
      model: options?.model ?? null,
      requestStartedAtMs,
      respondedAtMs,
      durationMs: Math.max(0, respondedAtMs - requestStartedAtMs),
      outcome: "error",
      errorName: error instanceof Error ? error.name : typeof error,
    });
    throw error;
  }
}

export async function interruptTurn(workspaceId: string, threadId: string, turnId: string) {
  return invoke("turn_interrupt", { workspaceId, threadId, turnId });
}

export async function engineInterruptTurn(workspaceId: string, turnId: string, engine?: EngineType | null): Promise<void> {
  return invoke("engine_interrupt_turn", {
    workspaceId,
    turnId,
    engine: engine ?? null,
  });
}

export async function compactThreadContext(workspaceId: string, threadId: string) {
  return invoke("thread_compact", { workspaceId, threadId });
}

export async function startReview(workspaceId: string, threadId: string, target: ReviewTarget, delivery?: "inline" | "detached") {
  const payload: Record<string, unknown> = { workspaceId, threadId, target };
  if (delivery) {
    payload.delivery = delivery;
  }
  return invoke("start_review", payload);
}

export async function localUsageSnapshot(days?: number, workspacePath?: string | null): Promise<LocalUsageSnapshot> {
  const payload: { days: number; workspacePath?: string } = {
    days: days ?? 30,
  };
  if (workspacePath) {
    payload.workspacePath = workspacePath;
  }
  return invoke("local_usage_snapshot", payload);
}

export async function localUsageStatistics(input: {
  scope: "current" | "all";
  provider?: string | null;
  dateRange: "7d" | "30d" | "all";
  workspacePath?: string | null;
}): Promise<LocalUsageStatistics> {
  return invoke<LocalUsageStatistics>("local_usage_statistics", {
    scope: input.scope,
    provider: input.provider ?? "all",
    dateRange: input.dateRange,
    workspacePath: input.workspacePath ?? null,
  });
}

export async function getModelList(workspaceId: string) {
  return traceStartupInvoke("model_list", workspaceScope(workspaceId), () =>
    invoke<{
      data?: Record<string, unknown>[];
      result?: { data?: Record<string, unknown>[]; [key: string]: unknown };
      [key: string]: unknown;
    }>("model_list", { workspaceId }),
  );
}

export async function generateRunMetadata(workspaceId: string, prompt: string) {
  return invoke<{ title: string; worktreeName: string }>("generate_run_metadata", {
    workspaceId,
    prompt,
  });
}

export async function getCollaborationModes(workspaceId: string) {
  return traceStartupInvoke("collaboration_mode_list", workspaceScope(workspaceId), () =>
    invoke<{
      data?: Record<string, unknown>[];
      result?: { data?: Record<string, unknown>[]; [key: string]: unknown };
      [key: string]: unknown;
    }>("collaboration_mode_list", { workspaceId }),
  );
}

export async function getAccountRateLimits(workspaceId: string) {
  return invoke<{
    rateLimits?: unknown;
    rate_limits?: unknown;
    result?: {
      rateLimits?: unknown;
      rate_limits?: unknown;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  }>("account_rate_limits", { workspaceId });
}

export async function getAccountInfo(workspaceId: string) {
  return invoke<Record<string, unknown> | null>("account_read", {
    workspaceId,
  });
}

export async function runCodexLogin(workspaceId: string) {
  return invoke<{ output: string }>("codex_login", { workspaceId });
}

export async function cancelCodexLogin(workspaceId: string) {
  return invoke<{ canceled: boolean }>("codex_login_cancel", { workspaceId });
}

export async function getSkillsList(
  workspaceId: string,
  customSkillRoots?: string[],
) {
  return traceStartupInvoke("skills_list", workspaceScope(workspaceId), () =>
    invoke<unknown>("skills_list", {
      workspaceId,
      customSkillRoots: customSkillRoots ?? [],
    }),
  );
}

export async function getClaudeCommandsList(workspaceId?: string | null) {
  return traceStartupInvoke(
    "claude_commands_list",
    workspaceId ? workspaceScope(workspaceId) : "global",
    () =>
      invoke<unknown>("claude_commands_list", {
        workspaceId: workspaceId ?? null,
      }),
  );
}

export async function getOpenCodeCommandsList(refresh = false) {
  return traceStartupInvoke("opencode_commands_list", "global", () =>
    invoke<unknown>("opencode_commands_list", { refresh }),
  );
}

export async function getOpenCodeAgentsList(refresh = false) {
  return traceStartupInvoke("opencode_agents_list", "global", () =>
    invoke<unknown>("opencode_agents_list", { refresh }),
  );
}

export async function getOpenCodeSessionList(workspaceId: string) {
  return traceStartupInvoke(
    "opencode_session_list",
    workspaceScope(workspaceId),
    async () => {
      try {
        return await invoke<
          Array<{
            sessionId: string;
            title: string;
            updatedLabel: string;
            updatedAt?: number | null;
          }>
        >("opencode_session_list", { workspaceId });
      } catch (error) {
        if (
          String(error).includes(
            "OpenCode CLI is disabled in CLI validation settings",
          )
        ) {
          return [];
        }
        throw error;
      }
    },
  );
}

export async function getOpenCodeStats(workspaceId: string, days?: number | null) {
  return invoke<string>("opencode_stats", {
    workspaceId,
    days: days ?? null,
  });
}

export async function exportOpenCodeSession(workspaceId: string, sessionId: string, outputPath?: string | null) {
  return invoke<{ sessionId: string; filePath: string }>("opencode_export_session", {
    workspaceId,
    sessionId,
    outputPath: outputPath ?? null,
  });
}

export async function importOpenCodeSession(workspaceId: string, source: string) {
  return invoke<{ sessionId?: string | null; source: string; output: string }>("opencode_import_session", {
    workspaceId,
    source,
  });
}

export async function shareOpenCodeSession(workspaceId: string, sessionId: string) {
  return invoke<{ sessionId: string; url: string }>("opencode_share_session", {
    workspaceId,
    sessionId,
  });
}

export async function getOpenCodeMcpStatus(workspaceId: string) {
  return invoke<{ text: string }>("opencode_mcp_status", { workspaceId });
}

export async function getOpenCodeProviderHealth(workspaceId: string, provider?: string | null) {
  return invoke<{
    provider: string;
    connected: boolean;
    credentialCount: number;
    matched: boolean;
    authenticatedProviders?: string[];
    error?: string | null;
  }>("opencode_provider_health", {
    workspaceId,
    provider: provider ?? null,
  });
}

export async function getOpenCodeProviderCatalog(workspaceId: string) {
  return invoke<
    Array<{
      id: string;
      label: string;
      description?: string | null;
      category: "popular" | "other";
      recommended: boolean;
    }>
  >("opencode_provider_catalog", { workspaceId });
}

export async function connectOpenCodeProvider(workspaceId: string, providerId?: string | null) {
  return invoke<{
    started: boolean;
    providerId?: string | null;
    command?: string | null;
  }>("opencode_provider_connect", {
    workspaceId,
    providerId: providerId ?? null,
  });
}

export async function getOpenCodeStatusSnapshot(input: { workspaceId: string; threadId?: string | null; model?: string | null; agent?: string | null; variant?: string | null }) {
  return invoke<{
    sessionId?: string | null;
    model?: string | null;
    agent?: string | null;
    variant?: string | null;
    provider?: string | null;
    providerHealth: {
      provider: string;
      connected: boolean;
      credentialCount: number;
      matched: boolean;
      authenticatedProviders?: string[];
      error?: string | null;
    };
    mcpEnabled: boolean;
    mcpServers: Array<{
      name: string;
      enabled: boolean;
      status?: string | null;
      permissionHint?: string | null;
    }>;
    mcpRaw: string;
    managedToggles: boolean;
    tokenUsage?: number | null;
    contextWindow?: number | null;
  }>("opencode_status_snapshot", {
    workspaceId: input.workspaceId,
    threadId: input.threadId ?? null,
    model: input.model ?? null,
    agent: input.agent ?? null,
    variant: input.variant ?? null,
  });
}

export async function setOpenCodeMcpToggle(
  workspaceId: string,
  input: {
    serverName?: string | null;
    enabled?: boolean | null;
    globalEnabled?: boolean | null;
  },
) {
  return invoke<{
    workspaceId: string;
    mcpEnabled: boolean;
    serverStates: Record<string, boolean>;
    managedToggles: boolean;
  }>("opencode_mcp_toggle", {
    workspaceId,
    serverName: input.serverName ?? null,
    enabled: input.enabled ?? null,
    globalEnabled: input.globalEnabled ?? null,
  });
}

export async function getOpenCodeLspDiagnostics(workspaceId: string, filePath: string) {
  return invoke<{ filePath: string; result: unknown }>("opencode_lsp_diagnostics", {
    workspaceId,
    filePath,
  });
}

export async function getOpenCodeLspSymbols(workspaceId: string, query: string) {
  return invoke<{ query: string; result: unknown }>("opencode_lsp_symbols", {
    workspaceId,
    query,
  });
}

export async function getOpenCodeLspDocumentSymbols(workspaceId: string, fileUri: string) {
  return invoke<{ fileUri: string; result: unknown }>("opencode_lsp_document_symbols", {
    workspaceId,
    fileUri,
  });
}

export async function getCodeIntelDefinition(
  workspaceId: string,
  input: {
    filePath: string;
    line: number;
    character: number;
  },
) {
  return invoke<{
    filePath: string;
    line: number;
    character: number;
    result: unknown;
  }>("code_intel_definition", {
    workspaceId,
    filePath: input.filePath,
    line: input.line,
    character: input.character,
  });
}

export async function getCodeIntelReferences(
  workspaceId: string,
  input: {
    filePath: string;
    line: number;
    character: number;
    includeDeclaration?: boolean;
  },
) {
  return invoke<{
    filePath: string;
    line: number;
    character: number;
    includeDeclaration: boolean;
    result: unknown;
  }>("code_intel_references", {
    workspaceId,
    filePath: input.filePath,
    line: input.line,
    character: input.character,
    includeDeclaration: input.includeDeclaration ?? false,
  });
}

export type LspPosition = {
  line: number;
  character: number;
};

export type LspRange = {
  start: LspPosition;
  end: LspPosition;
};

export type LspLocation = {
  uri: string;
  range: LspRange;
};

export async function getOpenCodeLspDefinition(
  workspaceId: string,
  input: {
    fileUri: string;
    line: number;
    character: number;
  },
) {
  return invoke<{
    fileUri: string;
    line: number;
    character: number;
    result: unknown;
  }>("opencode_lsp_definition", {
    workspaceId,
    fileUri: input.fileUri,
    line: input.line,
    character: input.character,
  });
}

export async function getOpenCodeLspReferences(
  workspaceId: string,
  input: {
    fileUri: string;
    line: number;
    character: number;
    includeDeclaration?: boolean;
  },
) {
  return invoke<{
    fileUri: string;
    line: number;
    character: number;
    includeDeclaration: boolean;
    result: unknown;
  }>("opencode_lsp_references", {
    workspaceId,
    fileUri: input.fileUri,
    line: input.line,
    character: input.character,
    includeDeclaration: input.includeDeclaration ?? false,
  });
}

export async function getPromptsList(workspaceId: string): Promise<CustomPromptOption[]> {
  return traceStartupInvoke("prompts_list", workspaceScope(workspaceId), () =>
    invoke<CustomPromptOption[]>("prompts_list", { workspaceId }),
  );
}

export async function getWorkspacePromptsDir(workspaceId: string) {
  return invoke<string>("prompts_workspace_dir", { workspaceId });
}

export async function getGlobalPromptsDir(workspaceId: string) {
  return invoke<string>("prompts_global_dir", { workspaceId });
}

export async function createPrompt(
  workspaceId: string,
  data: {
    scope: "workspace" | "global";
    name: string;
    description?: string | null;
    argumentHint?: string | null;
    content: string;
  },
): Promise<CustomPromptOption> {
  return invoke<CustomPromptOption>("prompts_create", {
    workspaceId,
    scope: data.scope,
    name: data.name,
    description: data.description ?? null,
    argumentHint: data.argumentHint ?? null,
    content: data.content,
  });
}

export async function updatePrompt(
  workspaceId: string,
  data: {
    path: string;
    name: string;
    description?: string | null;
    argumentHint?: string | null;
    content: string;
  },
): Promise<CustomPromptOption> {
  return invoke<CustomPromptOption>("prompts_update", {
    workspaceId,
    path: data.path,
    name: data.name,
    description: data.description ?? null,
    argumentHint: data.argumentHint ?? null,
    content: data.content,
  });
}

export async function deletePrompt(workspaceId: string, path: string): Promise<void> {
  return invoke<void>("prompts_delete", { workspaceId, path });
}

export async function movePrompt(workspaceId: string, data: { path: string; scope: "workspace" | "global" }): Promise<CustomPromptOption> {
  return invoke<CustomPromptOption>("prompts_move", {
    workspaceId,
    path: data.path,
    scope: data.scope,
  });
}

export async function getAppSettings(): Promise<AppSettings> {
  return invoke<AppSettings>("get_app_settings");
}

export async function updateAppSettings(settings: AppSettings): Promise<AppSettings> {
  return invoke<AppSettings>("update_app_settings", { settings });
}

const EMAIL_SEND_ERROR_PREFIX = "EMAIL_SEND_ERROR:";

function normalizeEmailSendError(error: unknown): EmailSendError {
  const message = error instanceof Error ? error.message : String(error);
  if (message.startsWith(EMAIL_SEND_ERROR_PREFIX)) {
    try {
      return JSON.parse(message.slice(EMAIL_SEND_ERROR_PREFIX.length)) as EmailSendError;
    } catch {
      // Fall through to a generic structured error.
    }
  }
  return {
    code: "unknown",
    retryable: false,
    userMessage: message || "Email command failed.",
  };
}

async function invokeEmailCommand<T>(
  command: string,
  payload?: Record<string, unknown>,
): Promise<T> {
  try {
    return await invoke<T>(command, payload);
  } catch (error) {
    throw normalizeEmailSendError(error);
  }
}

export async function getEmailSenderSettings(): Promise<EmailSenderSettingsView> {
  return invokeEmailCommand<EmailSenderSettingsView>("get_email_sender_settings");
}

export async function updateEmailSenderSettings(
  request: UpdateEmailSenderSettingsRequest,
): Promise<EmailSenderSettingsView> {
  return invokeEmailCommand<EmailSenderSettingsView>("update_email_sender_settings", {
    request,
  });
}

export async function sendTestEmail(
  request: SendTestEmailRequest,
): Promise<EmailSendResult> {
  return invokeEmailCommand<EmailSendResult>("send_test_email", { request });
}

export async function sendConversationCompletionEmail(
  request: SendConversationCompletionEmailRequest,
): Promise<EmailSendResult> {
  return invokeEmailCommand<EmailSendResult>("send_conversation_completion_email", { request });
}

export async function getEmailInboundSettings(): Promise<EmailInboundSettingsView> {
  return invoke<EmailInboundSettingsView>("get_email_inbound_settings");
}

export async function updateEmailInboundSettings(
  request: UpdateEmailInboundSettingsRequest,
): Promise<EmailInboundSettingsView> {
  return invoke<EmailInboundSettingsView>("update_email_inbound_settings", { request });
}

export async function getEmailInboundListenerStatus(): Promise<EmailInboundListenerStatus> {
  return invoke<EmailInboundListenerStatus>("get_email_inbound_listener_status");
}

export async function checkEmailInbox(
  request: CheckEmailInboxRequest = {},
): Promise<CheckEmailInboxResult> {
  return invoke<CheckEmailInboxResult>("check_email_inbox", { request });
}

export async function listEmailMailSessions(): Promise<EmailMailSessionList> {
  return invoke<EmailMailSessionList>("list_email_mail_sessions");
}

export async function mutateEmailMailSession(
  request: MutateMailSessionRequest,
): Promise<EmailMailSessionList> {
  return invoke<EmailMailSessionList>("mutate_email_mail_session", { request });
}

export async function claimNextEmailMailCommand(): Promise<ClaimMailCommandResult> {
  return invoke<ClaimMailCommandResult>("claim_next_email_mail_command");
}

export async function completeEmailMailCommand(
  request: CompleteMailCommandRequest,
): Promise<EmailMailSessionList> {
  return invoke<EmailMailSessionList>("complete_email_mail_command", { request });
}

type MenuAcceleratorUpdate = {
  id: string;
  accelerator: string | null;
};

export async function setMenuAccelerators(updates: MenuAcceleratorUpdate[]): Promise<void> {
  return invoke("menu_set_accelerators", { updates });
}

type MenuLabelUpdate = {
  id: string;
  text: string;
};

export async function updateMenuLabels(updates: MenuLabelUpdate[]): Promise<void> {
  return invoke("menu_update_labels", { updates });
}

export type CommitMessageLanguage = "zh" | "en";
export type CommitMessageEngine = EngineType;

export async function getCommitMessagePrompt(
  workspaceId: string,
  language: CommitMessageLanguage = "zh",
  selectedPaths?: string[],
): Promise<string> {
  return invoke("get_commit_message_prompt", { workspaceId, language, selectedPaths });
}

export async function generateCommitMessage(
  workspaceId: string,
  language: CommitMessageLanguage = "zh",
  selectedPaths?: string[],
): Promise<string> {
  return invoke("generate_commit_message", { workspaceId, language, selectedPaths });
}

export async function generateCommitMessageWithEngine(
  workspaceId: string,
  language: CommitMessageLanguage = "zh",
  engine: CommitMessageEngine = "codex",
  selectedPaths?: string[],
): Promise<string> {
  if (engine === "codex") {
    return generateCommitMessage(workspaceId, language, selectedPaths);
  }
  const prompt = await getCommitMessagePrompt(workspaceId, language, selectedPaths);
  const response = await engineSendMessageSync(workspaceId, {
    text: prompt,
    engine,
    autoSession: {
      sessionPurpose: "commit-message",
      visibility: "hidden",
      ownerFeature: "git",
      autoArchive: true,
      createdBy: "system",
    },
  });
  return response.text;
}

export async function listThreadTitles(workspaceId: string): Promise<Record<string, string>> {
  return traceStartupInvoke("list_thread_titles", workspaceScope(workspaceId), () =>
    invoke("list_thread_titles", { workspaceId }),
  );
}

export async function setThreadTitle(workspaceId: string, threadId: string, title: string): Promise<string> {
  return invoke("set_thread_title", { workspaceId, threadId, title });
}

export async function renameThreadTitleKey(workspaceId: string, oldThreadId: string, newThreadId: string): Promise<void> {
  return invoke("rename_thread_title_key", {
    workspaceId,
    oldThreadId,
    newThreadId,
  });
}

export async function generateThreadTitle(workspaceId: string, threadId: string, userMessage: string, preferredLanguage?: "zh" | "en"): Promise<string> {
  return invoke("generate_thread_title", {
    workspaceId,
    threadId,
    userMessage,
    preferredLanguage: preferredLanguage ?? null,
  });
}

/**
 * Get and clear any pending paths that were passed to the app on launch
 * (via drag-drop to app icon or command line arguments)
 */
export async function getPendingOpenPaths(): Promise<string[]> {
  return invoke<string[]>("get_pending_open_paths");
}

export type WindowOpacityApplyResult = {
  requestedOpacity: number;
  appliedOpacity: number;
  applied: boolean;
  platform: string;
  reason: string | null;
};

export function setMainWindowOpacity(
  opacity: number,
): Promise<WindowOpacityApplyResult> {
  return invoke<WindowOpacityApplyResult>("set_main_window_opacity", {
    opacity,
  });
}
