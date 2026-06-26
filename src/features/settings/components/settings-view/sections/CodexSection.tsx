import { useEffect, useMemo, useRef, useState } from "react";
import Stethoscope from "lucide-react/dist/esm/icons/stethoscope";
import { Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs";
import type {
  AppSettings,
  CliInstallAction,
  CliInstallEngine,
  CliInstallPlan,
  CliInstallProgressEvent,
  CliInstallResult,
  CodexDoctorResult,
  CodexLaunchProfilePreview,
  WorkspaceInfo,
  WorkspaceSettings,
} from "@/types";
import {
  getCliInstallPlan,
  previewCodexLaunchProfile,
  runCliInstaller,
} from "@/services/tauri";
import { subscribeCliInstallerEvents } from "@/services/events";
import { ComputerUseStatusCard } from "@/features/computer-use/components/ComputerUseStatusCard";
import { ENABLE_COMPUTER_USE_BRIDGE } from "@/features/computer-use/constants";

type DoctorState = {
  status: "idle" | "running" | "done" | "error";
  result: CodexDoctorResult | null;
  error?: string | null;
};

type CodexSectionProps = {
  active: boolean;
  t: (key: string) => string;
  appSettings: AppSettings;
  onUpdateAppSettings: (next: AppSettings) => Promise<void>;
  claudePathDraft: string;
  setClaudePathDraft: (value: string) => void;
  claudeDirty: boolean;
  handleBrowseClaude: () => Promise<void>;
  handleSaveClaudeSettings: () => Promise<void>;
  handleRunClaudeDoctor: () => Promise<void>;
  claudeDoctorState: DoctorState;
  codexPathDraft: string;
  setCodexPathDraft: (value: string) => void;
  codexArgsDraft: string;
  setCodexArgsDraft: (value: string) => void;
  codexDirty: boolean;
  handleBrowseCodex: () => Promise<void>;
  handleSaveCodexSettings: () => Promise<void>;
  isSavingSettings: boolean;
  handleRunDoctor: () => Promise<void>;
  doctorState: DoctorState;
  remoteHostDraft: string;
  setRemoteHostDraft: (value: string) => void;
  remoteTokenDraft: string;
  setRemoteTokenDraft: (value: string) => void;
  handleCommitRemoteHost: () => Promise<void>;
  handleCommitRemoteToken: () => Promise<void>;
  onInstallerDoctorResult: (
    engine: CliInstallEngine,
    result: CodexDoctorResult | null,
  ) => void;
  workspaces?: WorkspaceInfo[];
  activeWorkspace?: WorkspaceInfo | null;
  onUpdateWorkspaceCodexBin?: (
    id: string,
    codexBin: string | null,
  ) => Promise<void>;
  onUpdateWorkspaceSettings?: (
    id: string,
    settings: Partial<WorkspaceSettings>,
  ) => Promise<void>;
};

type InstallerState = {
  status: "idle" | "planning" | "ready" | "running" | "done" | "error";
  engine: CliInstallEngine | null;
  action: CliInstallAction | null;
  plan: CliInstallPlan | null;
  result: CliInstallResult | null;
  error: string | null;
  progressRunId: string | null;
  logLines: InstallerLogLine[];
  startedAtMs: number | null;
  lastEventAtMs: number | null;
};

type InstallerLogLine = {
  id: string;
  phase: CliInstallProgressEvent["phase"];
  stream: CliInstallProgressEvent["stream"];
  message: string;
  receivedAtMs: number;
};

type PreviewState = {
  status: "idle" | "running" | "done";
  result: CodexLaunchProfilePreview | null;
  error: string | null;
};

const MAX_INSTALLER_LOG_LINES = 120;
type CliValidationTab = "codex" | "claude";

// Deprecated: Gemini CLI and OpenCode CLI validation entries are intentionally hidden.
const DEPRECATED_CLI_VALIDATION_ENGINES = new Set(["gemini", "opencode"]);

type DoctorResultCardProps = {
  t: (key: string) => string;
  state: DoctorState;
  successTitleKey: string;
  errorTitleKey: string;
  showAppServer: boolean;
};

function DoctorResultCard({
  t,
  state,
  successTitleKey,
  errorTitleKey,
  showAppServer,
}: DoctorResultCardProps) {
  if (!state.result) {
    return null;
  }

  const debugEnvVars = state.result.debug?.envVars ?? {};
  const debugExtraSearchPaths = state.result.debug?.extraSearchPaths ?? [];
  const debugProxySnapshot = state.result.debug?.proxyEnvSnapshot ?? null;
  const configuredProxyEntries = Object.entries(
    state.result.proxyEnvSnapshot ?? {},
  ).filter(([, value]) => typeof value === "string" && value.trim().length > 0);
  const environmentDiagnosis = state.result.environmentDiagnosis;
  const shouldShowEnvironmentDiagnosis =
    Boolean(environmentDiagnosis?.category) &&
    environmentDiagnosis?.category !== "resolved";
  const networkDiagnosis = state.result.networkDiagnosis;
  const shouldShowNetworkDiagnosis =
    Boolean(networkDiagnosis?.category) && networkDiagnosis?.category !== "unknown";

  return (
    <div className={`settings-doctor ${state.result.ok ? "ok" : "error"}`}>
      <div className="settings-doctor-title">
        {state.result.ok ? t(successTitleKey) : t(errorTitleKey)}
      </div>
      <div className="settings-doctor-body">
        <div>
          {t("settings.versionLabel")}{" "}
          {state.result.version ?? t("git.unknown")}
        </div>
        {showAppServer ? (
          <div>
            {t("settings.appServerLabel")}{" "}
            {state.result.appServerOk
              ? t("settings.statusOk")
              : t("settings.statusFailed")}
          </div>
        ) : null}
        {state.result.appServerProbeStatus && showAppServer ? (
          <div>
            <strong>{t("settings.doctorAppServerProbe")}:</strong>{" "}
            {state.result.appServerProbeStatus}
          </div>
        ) : null}
        {state.result.resolvedBinaryPath ? (
          <div>
            <strong>{t("settings.doctorResolvedBinary")}:</strong>{" "}
            {state.result.resolvedBinaryPath}
          </div>
        ) : null}
        {state.result.wrapperKind ? (
          <div>
            <strong>{t("settings.doctorWrapperKind")}:</strong>{" "}
            {state.result.wrapperKind}
          </div>
        ) : null}
        {state.result.fallbackRetried ? (
          <div>
            <strong>{t("settings.doctorWrapperFallbackRetry")}:</strong>{" "}
            {t("settings.doctorAttempted")}
          </div>
        ) : null}
        {shouldShowEnvironmentDiagnosis ? (
          <div>
            <strong>{t("settings.doctorEnvironmentDiagnosis")}:</strong>{" "}
            {environmentDiagnosis?.category}
            {environmentDiagnosis?.message
              ? ` · ${environmentDiagnosis.message}`
              : ""}
          </div>
        ) : null}
        {shouldShowNetworkDiagnosis ? (
          <div>
            <strong>{t("settings.doctorNetworkDiagnosis")}:</strong>{" "}
            {networkDiagnosis?.category}
          </div>
        ) : null}
        {configuredProxyEntries.length > 0 ? (
          <div>
            <strong>{t("settings.doctorProxyEnvironment")}:</strong>{" "}
            {configuredProxyEntries
              .map(([key, value]) => `${key}=${value ?? t("settings.notSet")}`)
              .join(" · ")}
          </div>
        ) : null}
        <div>
          {t("settings.nodeLabel")}{" "}
          {state.result.nodeOk
            ? `${t("settings.statusOk")} (${state.result.nodeVersion ?? t("git.unknown")})`
            : t("settings.statusMissing")}
        </div>
        {state.result.details ? <div>{state.result.details}</div> : null}
        {state.result.nodeDetails ? (
          <div>{state.result.nodeDetails}</div>
        ) : null}
        {state.result.path ? (
          <div className="settings-doctor-path">
            {t("settings.pathLabel")} {state.result.path}
          </div>
        ) : null}
        {state.result.debug ? (
          <details className="settings-doctor-debug">
            <summary
              style={{
                cursor: "pointer",
                marginTop: "8px",
                fontWeight: "bold",
              }}
            >
              {t("settings.doctorDebugInfo")} (
              {t("settings.doctorClickToExpand")})
            </summary>
            <div
              style={{
                marginTop: "8px",
                fontSize: "12px",
                fontFamily: "monospace",
                whiteSpace: "pre-wrap",
                wordBreak: "break-all",
              }}
            >
              <div>
                <strong>{t("settings.doctorPlatform")}:</strong>{" "}
                {state.result.debug.platform} ({state.result.debug.arch})
              </div>
              <div>
                <strong>{t("settings.doctorResolvedBinary")}:</strong>{" "}
                {state.result.debug.resolvedBinaryPath ??
                  t("settings.notFound")}
              </div>
              <div>
                <strong>{t("settings.doctorWrapperKind")}:</strong>{" "}
                {state.result.debug.wrapperKind ?? t("settings.statusUnknown")}
              </div>
              <div>
                <strong>{t("settings.doctorPathUsed")}:</strong>{" "}
                {state.result.debug.pathEnvUsed ?? t("settings.notSet")}
              </div>
              <div>
                <strong>{t("settings.doctorClaudeFound")}:</strong>{" "}
                {state.result.debug.claudeFound ?? t("settings.notFound")}
              </div>
              <div>
                <strong>{t("settings.doctorCodexFound")}:</strong>{" "}
                {state.result.debug.codexFound ?? t("settings.notFound")}
              </div>
              <div>
                <strong>{t("settings.doctorClaudeStandardWhich")}:</strong>{" "}
                {state.result.debug.claudeStandardWhich ??
                  t("settings.notFound")}
              </div>
              <div>
                <strong>{t("settings.doctorCodexStandardWhich")}:</strong>{" "}
                {state.result.debug.codexStandardWhich ??
                  t("settings.notFound")}
              </div>
              {debugProxySnapshot ? (
                <>
                  <div style={{ marginTop: "8px" }}>
                    <strong>{t("settings.doctorProxyEnvironment")}:</strong>
                  </div>
                  {Object.entries(debugProxySnapshot).map(([key, value]) => (
                    <div key={key} style={{ marginLeft: "12px" }}>
                      <strong>{key}:</strong> {value ?? t("settings.notSet")}
                    </div>
                  ))}
                </>
              ) : null}
              <div style={{ marginTop: "8px" }}>
                <strong>{t("settings.doctorEnvironmentVariables")}:</strong>
              </div>
              {Object.entries(debugEnvVars).map(([key, value]) => (
                <div key={key} style={{ marginLeft: "12px" }}>
                  <strong>{key}:</strong> {value ?? t("settings.notSet")}
                </div>
              ))}
              <div style={{ marginTop: "8px" }}>
                <strong>{t("settings.doctorExtraSearchPaths")}:</strong>
              </div>
              {debugExtraSearchPaths.map((pathEntry, index) => (
                <div key={index} style={{ marginLeft: "12px" }}>
                  {pathEntry.path}{" "}
                  {pathEntry.exists
                    ? pathEntry.isDir
                      ? "✓"
                      : "✓ (file)"
                    : "✗"}{" "}
                  {pathEntry.hasCodexCmd ? (
                    <span style={{ color: "green" }}>
                      [{t("settings.doctorBinaryMarkerCodexCmd")}]
                    </span>
                  ) : null}
                  {pathEntry.hasClaudeCmd ? (
                    <span style={{ color: "green" }}>
                      [{t("settings.doctorBinaryMarkerClaudeCmd")}]
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          </details>
        ) : null}
      </div>
    </div>
  );
}

type LaunchPreviewCardProps = {
  t: (key: string) => string;
  state: PreviewState;
};

function formatArgumentList(
  t: (key: string) => string,
  args: string[],
): string {
  return args.length > 0 ? args.join(" ") : t("settings.codexLaunchNoArguments");
}

function formatExecutableSource(t: (key: string) => string, source: string) {
  if (source === "draft") {
    return t("settings.codexLaunchExecutableDraft");
  }
  if (source === "global") {
    return t("settings.codexWorkspaceExecutableGlobal");
  }
  if (source === "path") {
    return t("settings.codexWorkspaceExecutablePath");
  }
  return t("settings.codexWorkspaceExecutableOverride");
}

function formatArgumentsSource(t: (key: string) => string, source: string) {
  switch (source) {
    case "draft":
      return t("settings.codexLaunchArgumentsDraft");
    case "global":
      return t("settings.codexWorkspaceArgsGlobal");
    case "parent-workspace":
      return t("settings.codexWorkspaceArgsParent");
    case "default":
      return t("settings.codexWorkspaceArgsDefault");
    default:
      return t("settings.codexWorkspaceArgsOverride");
  }
}

function LaunchPreviewCard({ t, state }: LaunchPreviewCardProps) {
  if (state.status === "idle") {
    return null;
  }
  if (state.status === "running") {
    return (
      <div className="settings-doctor">
        <div className="settings-doctor-title">
          {t("settings.previewingLaunch")}
        </div>
      </div>
    );
  }
  if (state.error) {
    return (
      <div className="settings-doctor error">
        <div className="settings-doctor-title">
          {t("settings.codexLaunchPreviewIssueTitle")}
        </div>
        <div className="settings-doctor-body">{state.error}</div>
      </div>
    );
  }
  if (!state.result) {
    return null;
  }
  return (
    <div className={`settings-doctor ${state.result.ok ? "ok" : "error"}`}>
      <div className="settings-doctor-title">
        {state.result.ok
          ? t("settings.codexLaunchPreviewTitle")
          : t("settings.codexLaunchPreviewIssueTitle")}
      </div>
      <div className="settings-doctor-body">
        <div>
          <strong>{t("settings.codexLaunchResolvedExecutable")}:</strong>{" "}
          {state.result.resolvedExecutable}
        </div>
        <div>
          <strong>{t("settings.codexLaunchWrapperKind")}:</strong>{" "}
          {state.result.wrapperKind}
        </div>
        <div>
          <strong>{t("settings.codexLaunchUserArguments")}:</strong>{" "}
          {formatArgumentList(t, state.result.userArguments)}
        </div>
        <div>
          <strong>{t("settings.codexLaunchInjectedArguments")}:</strong>{" "}
          {formatArgumentList(t, state.result.injectedArguments)}
        </div>
        <div>
          <strong>{t("settings.codexWorkspaceSourceLabel")}:</strong>{" "}
          {formatExecutableSource(t, state.result.executableSource)} /{" "}
          {formatArgumentsSource(t, state.result.argumentsSource)}
        </div>
        {state.result.pathEnvUsed ? (
          <div className="settings-doctor-path">
            {t("settings.codexLaunchPathEnv")} {state.result.pathEnvUsed}
          </div>
        ) : null}
        {state.result.details ? <div>{state.result.details}</div> : null}
        {state.result.nextLaunchOnly ? (
          <div>{t("settings.codexLaunchNextLaunchOnly")}</div>
        ) : null}
      </div>
    </div>
  );
}

function resolveInstallerAction(
  doctorResult: CodexDoctorResult | null,
): CliInstallAction {
  return doctorResult?.ok ? "updateLatest" : "installLatest";
}

function normalizeErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function normalizeDraftValue(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function createInstallerRunId(engine: CliInstallEngine): string {
  return `${engine}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatDurationMs(durationMs: number | null): string {
  if (durationMs === null) {
    return "-";
  }
  if (durationMs < 1000) {
    return `${durationMs}ms`;
  }
  return `${Math.round(durationMs / 100) / 10}s`;
}

function appendInstallerLog(
  lines: InstallerLogLine[],
  event: CliInstallProgressEvent,
): InstallerLogLine[] {
  if (!event.message && event.phase !== "finished") {
    return lines;
  }
  const message = event.message ?? `exitCode=${event.exitCode ?? "unknown"}`;
  const nextLine: InstallerLogLine = {
    id: `${event.runId}-${event.phase}-${Date.now()}-${lines.length}`,
    phase: event.phase,
    stream: event.stream,
    message,
    receivedAtMs: Date.now(),
  };
  return [...lines, nextLine].slice(-MAX_INSTALLER_LOG_LINES);
}

export function CodexSection({
  active,
  t,
  appSettings,
  onUpdateAppSettings,
  claudePathDraft,
  setClaudePathDraft,
  claudeDirty,
  handleBrowseClaude,
  handleSaveClaudeSettings,
  handleRunClaudeDoctor,
  claudeDoctorState,
  codexPathDraft,
  setCodexPathDraft,
  codexArgsDraft,
  setCodexArgsDraft,
  codexDirty,
  handleBrowseCodex,
  handleSaveCodexSettings,
  isSavingSettings,
  handleRunDoctor,
  doctorState,
  remoteHostDraft,
  setRemoteHostDraft,
  remoteTokenDraft,
  setRemoteTokenDraft,
  handleCommitRemoteHost,
  handleCommitRemoteToken,
  onInstallerDoctorResult,
  workspaces = [],
  activeWorkspace = null,
  onUpdateWorkspaceCodexBin,
  onUpdateWorkspaceSettings,
}: CodexSectionProps) {
  const [activeTab, setActiveTab] = useState<CliValidationTab>("codex");
  const [installerState, setInstallerState] = useState<InstallerState>({
    status: "idle",
    engine: null,
    action: null,
    plan: null,
    result: null,
    error: null,
    progressRunId: null,
    logLines: [],
    startedAtMs: null,
    lastEventAtMs: null,
  });
  const [installerNowMs, setInstallerNowMs] = useState(() => Date.now());
  const installPlanRequestSeqRef = useRef(0);
  const [globalPreviewState, setGlobalPreviewState] = useState<PreviewState>({
    status: "idle",
    result: null,
    error: null,
  });
  const [workspacePreviewState, setWorkspacePreviewState] =
    useState<PreviewState>({
      status: "idle",
      result: null,
      error: null,
    });
  const [workspaceSaveState, setWorkspaceSaveState] = useState<{
    status: "idle" | "saving" | "saved" | "error";
    message: string | null;
  }>({ status: "idle", message: null });
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(
    activeWorkspace?.id ?? null,
  );
  const [workspaceCodexPathDraft, setWorkspaceCodexPathDraft] = useState("");
  const [workspaceCodexArgsDraft, setWorkspaceCodexArgsDraft] = useState("");
  const selectedWorkspace = useMemo(() => {
    if (workspaces.length === 0) {
      return null;
    }
    return (
      workspaces.find((workspace) => workspace.id === selectedWorkspaceId) ??
      activeWorkspace ??
      workspaces[0] ??
      null
    );
  }, [activeWorkspace, selectedWorkspaceId, workspaces]);
  const parentWorkspace = useMemo(() => {
    if (!selectedWorkspace?.parentId) {
      return null;
    }
    return (
      workspaces.find(
        (workspace) => workspace.id === selectedWorkspace.parentId,
      ) ?? null
    );
  }, [selectedWorkspace?.parentId, workspaces]);
  const nextWorkspaceCodexBin = normalizeDraftValue(workspaceCodexPathDraft);
  const nextWorkspaceCodexArgs = normalizeDraftValue(workspaceCodexArgsDraft);
  const nextGlobalCodexBin = normalizeDraftValue(codexPathDraft);
  const nextGlobalCodexArgs = normalizeDraftValue(codexArgsDraft);
  const globalCodexBinPreviewDraft =
    nextGlobalCodexBin !== (appSettings.codexBin ?? null)
      ? codexPathDraft.trim()
      : null;
  const globalCodexArgsPreviewDraft =
    nextGlobalCodexArgs !== (appSettings.codexArgs ?? null)
      ? codexArgsDraft.trim()
      : null;
  const workspaceLaunchDirty =
    !!selectedWorkspace &&
    (nextWorkspaceCodexBin !== (selectedWorkspace.codex_bin ?? null) ||
      nextWorkspaceCodexArgs !==
        (selectedWorkspace.settings.codexArgs ?? null));
  const workspaceExecutableSource = nextWorkspaceCodexBin
    ? t("settings.codexWorkspaceExecutableOverride")
    : appSettings.codexBin
      ? t("settings.codexWorkspaceExecutableGlobal")
      : t("settings.codexWorkspaceExecutablePath");
  const workspaceArgumentsSource = nextWorkspaceCodexArgs
    ? t("settings.codexWorkspaceArgsOverride")
    : selectedWorkspace?.kind === "worktree" && parentWorkspace?.settings.codexArgs
      ? t("settings.codexWorkspaceArgsParent")
      : appSettings.codexArgs
        ? t("settings.codexWorkspaceArgsGlobal")
        : t("settings.codexWorkspaceArgsDefault");

  useEffect(() => {
    return subscribeCliInstallerEvents((event) => {
      setInstallerState((current) => {
        if (current.progressRunId !== event.runId) {
          return current;
        }
        return {
          ...current,
          logLines: appendInstallerLog(current.logLines, event),
          lastEventAtMs: Date.now(),
        };
      });
    });
  }, []);

  useEffect(() => {
    if (workspaces.length === 0) {
      setSelectedWorkspaceId(null);
      return;
    }
    setSelectedWorkspaceId((current) => {
      if (current && workspaces.some((workspace) => workspace.id === current)) {
        return current;
      }
      return activeWorkspace?.id ?? workspaces[0]?.id ?? null;
    });
  }, [activeWorkspace?.id, workspaces]);

  useEffect(() => {
    setWorkspaceCodexPathDraft(selectedWorkspace?.codex_bin ?? "");
    setWorkspaceCodexArgsDraft(selectedWorkspace?.settings.codexArgs ?? "");
    setWorkspacePreviewState({ status: "idle", result: null, error: null });
    setWorkspaceSaveState({ status: "idle", message: null });
  }, [selectedWorkspace?.id, selectedWorkspace?.codex_bin, selectedWorkspace?.settings.codexArgs]);

  useEffect(() => {
    if (installerState.status !== "running") {
      return;
    }
    const interval = window.setInterval(() => {
      setInstallerNowMs(Date.now());
    }, 1_000);
    return () => {
      window.clearInterval(interval);
    };
  }, [installerState.status]);

  const requestInstallPlan = async (
    engine: CliInstallEngine,
    doctorResult: CodexDoctorResult | null,
  ) => {
    const action = resolveInstallerAction(doctorResult);
    const requestSeq = installPlanRequestSeqRef.current + 1;
    installPlanRequestSeqRef.current = requestSeq;
    setInstallerState({
      status: "planning",
      engine,
      action,
      plan: null,
      result: null,
      error: null,
      progressRunId: null,
      logLines: [],
      startedAtMs: null,
      lastEventAtMs: null,
    });
    try {
      const plan = await getCliInstallPlan(engine, action, "npmGlobal");
      if (installPlanRequestSeqRef.current !== requestSeq) {
        return;
      }
      setInstallerState({
        status: "ready",
        engine,
        action,
        plan,
        result: null,
        error: null,
        progressRunId: null,
        logLines: [],
        startedAtMs: null,
        lastEventAtMs: null,
      });
    } catch (error) {
      if (installPlanRequestSeqRef.current !== requestSeq) {
        return;
      }
      setInstallerState({
        status: "error",
        engine,
        action,
        plan: null,
        result: null,
        error: normalizeErrorMessage(error),
        progressRunId: null,
        logLines: [],
        startedAtMs: null,
        lastEventAtMs: null,
      });
    }
  };

  const confirmInstallRun = async () => {
    const { engine, action, plan } = installerState;
    if (!engine || !action || !plan || !plan.canRun) {
      return;
    }
    const runId = createInstallerRunId(engine);
    const startedAtMs = Date.now();
    setInstallerNowMs(startedAtMs);
    setInstallerState((current) => ({
      ...current,
      status: "running",
      error: null,
      result: null,
      progressRunId: runId,
      logLines: [],
      startedAtMs,
      lastEventAtMs: startedAtMs,
    }));
    try {
      const result = await runCliInstaller(
        engine,
        action,
        plan.strategy,
        runId,
      );
      onInstallerDoctorResult(engine, result.doctorResult);
      setInstallerState((current) => ({
        ...current,
        status: "done",
        result,
        error: null,
      }));
    } catch (error) {
      setInstallerState((current) => ({
        ...current,
        status: "error",
        error: normalizeErrorMessage(error),
      }));
    }
  };

  const handlePreviewGlobalLaunch = async () => {
    setGlobalPreviewState({ status: "running", result: null, error: null });
    try {
      const result = await previewCodexLaunchProfile({
        codexBin: globalCodexBinPreviewDraft,
        codexArgs: globalCodexArgsPreviewDraft,
        workspaceId: null,
        useWorkspaceDraft: false,
      });
      setGlobalPreviewState({ status: "done", result, error: null });
    } catch (error) {
      setGlobalPreviewState({
        status: "done",
        result: null,
        error: normalizeErrorMessage(error),
      });
    }
  };

  const handlePreviewWorkspaceLaunch = async () => {
    if (!selectedWorkspace) {
      return;
    }
    setWorkspacePreviewState({ status: "running", result: null, error: null });
    try {
      const result = await previewCodexLaunchProfile({
        codexBin: nextWorkspaceCodexBin,
        codexArgs: nextWorkspaceCodexArgs,
        workspaceId: selectedWorkspace.id,
        useWorkspaceDraft: true,
      });
      setWorkspacePreviewState({ status: "done", result, error: null });
    } catch (error) {
      setWorkspacePreviewState({
        status: "done",
        result: null,
        error: normalizeErrorMessage(error),
      });
    }
  };

  const handleSaveWorkspaceLaunch = async () => {
    if (!selectedWorkspace || !onUpdateWorkspaceCodexBin || !onUpdateWorkspaceSettings) {
      return;
    }
    const previousCodexBin = selectedWorkspace.codex_bin ?? null;
    setWorkspaceSaveState({ status: "saving", message: null });
    try {
      if (nextWorkspaceCodexBin !== previousCodexBin) {
        await onUpdateWorkspaceCodexBin(selectedWorkspace.id, nextWorkspaceCodexBin);
      }
      if (nextWorkspaceCodexArgs !== (selectedWorkspace.settings.codexArgs ?? null)) {
        await onUpdateWorkspaceSettings(selectedWorkspace.id, {
          codexArgs: nextWorkspaceCodexArgs,
        });
      }
      setWorkspaceSaveState({
        status: "saved",
        message: t("settings.codexLaunchNextLaunchOnly"),
      });
    } catch (error) {
      if (nextWorkspaceCodexBin !== previousCodexBin) {
        await onUpdateWorkspaceCodexBin(selectedWorkspace.id, previousCodexBin).catch(
          () => undefined,
        );
      }
      setWorkspaceSaveState({
        status: "error",
        message: `${t("settings.codexWorkspaceSaveFailed")}: ${normalizeErrorMessage(error)}`,
      });
    }
  };

  if (!active) {
    return null;
  }

  return (
    <section className="settings-section">
      <div className="settings-section-title">
        {t("settings.cliValidationTitle")}
      </div>
      <div className="settings-section-subtitle">
        {t("settings.cliValidationDescription")}
      </div>

      <div className="settings-field">
        <div className="settings-field-label">
          {t("settings.cliExecutionBackendTitle")}
        </div>
        <div className="settings-help">
          {t("settings.cliExecutionBackendDescription")}
        </div>
      </div>

      <div className="settings-field">
        <label className="settings-field-label" htmlFor="backend-mode">
          {t("settings.backendMode")}
        </label>
        <select
          id="backend-mode"
          className="settings-select"
          value={appSettings.backendMode}
          onChange={(event) =>
            void onUpdateAppSettings({
              ...appSettings,
              backendMode: event.target.value as AppSettings["backendMode"],
            })
          }
        >
          <option value="local">{t("settings.backendLocal")}</option>
          <option value="remote">{t("settings.backendRemote")}</option>
        </select>
        <div className="settings-help">{t("settings.backendRemoteDesc")}</div>
      </div>

      {appSettings.backendMode === "remote" ? (
        <div className="settings-field">
          <div className="settings-field-label">
            {t("settings.remoteBackend")}
          </div>
          <div className="settings-field-row">
            <input
              className="settings-input settings-input--compact"
              value={remoteHostDraft}
              placeholder="127.0.0.1:4732"
              onChange={(event) => setRemoteHostDraft(event.target.value)}
              onBlur={() => {
                void handleCommitRemoteHost();
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void handleCommitRemoteHost();
                }
              }}
              aria-label={t("settings.remoteBackendHostAriaLabel")}
            />
            <input
              type="password"
              className="settings-input settings-input--compact"
              value={remoteTokenDraft}
              placeholder={t("settings.remoteBackendToken")}
              onChange={(event) => setRemoteTokenDraft(event.target.value)}
              onBlur={() => {
                void handleCommitRemoteToken();
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void handleCommitRemoteToken();
                }
              }}
              aria-label={t("settings.remoteBackendTokenAriaLabel")}
            />
          </div>
          <div className="settings-help">{t("settings.remoteBackendDesc")}</div>
        </div>
      ) : null}

      <Tabs
        value={activeTab}
        onValueChange={(value) => {
          if (DEPRECATED_CLI_VALIDATION_ENGINES.has(value)) {
            setActiveTab("codex");
            return;
          }
          setActiveTab(value === "claude" ? "claude" : "codex");
        }}
      >
        <TabsList>
          <TabsTab value="codex">{t("settings.cliValidationTabCodex")}</TabsTab>
          <TabsTab value="claude">
            {t("settings.cliValidationTabClaudeCode")}
          </TabsTab>
        </TabsList>

        <TabsPanel value="codex">
          <div className="settings-field">
            <div className="settings-field-label">
              {t("settings.codexLaunchConfigurationTitle")}
            </div>
            <div className="settings-help">
              {t("settings.codexLaunchConfigurationDescription")}
            </div>
            <label className="settings-field-label" htmlFor="codex-path">
              {t("settings.defaultCodexPath")}
            </label>
            <div className="settings-field-row">
              <input
                id="codex-path"
                className="settings-input"
                value={codexPathDraft}
                placeholder={t("settings.codexPlaceholder")}
                onChange={(event) => setCodexPathDraft(event.target.value)}
              />
              <button
                type="button"
                className="ghost"
                onClick={() => void handleBrowseCodex()}
              >
                {t("settings.browse")}
              </button>
              <button
                type="button"
                className="ghost"
                onClick={() => setCodexPathDraft("")}
              >
                {t("settings.usePath")}
              </button>
            </div>
            <div className="settings-help">
              {t("settings.pathResolutionDesc")}
            </div>

            <label className="settings-field-label" htmlFor="codex-args">
              {t("settings.defaultCodexArgs")}
            </label>
            <div className="settings-field-row">
              <input
                id="codex-args"
                className="settings-input"
                value={codexArgsDraft}
                placeholder={t("settings.codexArgsPlaceholder")}
                onChange={(event) => setCodexArgsDraft(event.target.value)}
              />
              <button
                type="button"
                className="ghost"
                onClick={() => setCodexArgsDraft("")}
              >
                {t("settings.clear")}
              </button>
            </div>
            <div className="settings-help">
              {t("settings.codexArgsDesc")}{" "}
              <code>{t("settings.appServer")}</code>
              {t("settings.codexArgsDescSuffix")}
            </div>
            <div className="settings-help">
              {t("settings.codexLaunchNextLaunchOnly")}
            </div>
            <div className="settings-field-actions">
              <button
                type="button"
                className="ghost settings-button-compact"
                onClick={() => {
                  void handlePreviewGlobalLaunch();
                }}
                disabled={globalPreviewState.status === "running"}
              >
                <Stethoscope aria-hidden />
                {globalPreviewState.status === "running"
                  ? t("settings.previewingLaunch")
                  : t("settings.previewLaunch")}
              </button>
              {codexDirty ? (
                <button
                  type="button"
                  className="primary"
                  onClick={() => {
                    void handleSaveCodexSettings();
                  }}
                  disabled={isSavingSettings}
                >
                  {isSavingSettings ? t("settings.saving") : t("common.save")}
                </button>
              ) : null}
              <button
                type="button"
                className="ghost settings-button-compact"
                onClick={() => {
                  void handleRunDoctor();
                }}
                disabled={doctorState.status === "running"}
              >
                <Stethoscope aria-hidden />
                {doctorState.status === "running"
                  ? t("settings.running")
                  : t("settings.runDoctor")}
              </button>
              <button
                type="button"
                className="ghost settings-button-compact"
                onClick={() => {
                  void requestInstallPlan("codex", doctorState.result);
                }}
                disabled={
                  installerState.status === "planning" ||
                  installerState.status === "running"
                }
              >
                {resolveInstallerAction(doctorState.result) === "installLatest"
                  ? t("settings.cliInstallLatest")
                  : t("settings.cliUpdateLatest")}
              </button>
            </div>

            <LaunchPreviewCard t={t} state={globalPreviewState} />

            <DoctorResultCard
              t={t}
              state={doctorState}
              successTitleKey="settings.codexLooksGood"
              errorTitleKey="settings.codexIssueDetected"
              showAppServer
            />
          </div>

          <div className="settings-field">
            <div className="settings-field-label">
              {t("settings.codexWorkspaceLaunchConfigurationTitle")}
            </div>
            <div className="settings-help">
              {t("settings.codexWorkspaceLaunchConfigurationDescription")}
            </div>
            {workspaces.length > 0 && selectedWorkspace ? (
              <>
                <label
                  className="settings-field-label"
                  htmlFor="codex-workspace-select"
                >
                  {t("settings.codexWorkspaceSelect")}
                </label>
                <select
                  id="codex-workspace-select"
                  className="settings-select"
                  value={selectedWorkspace.id}
                  onChange={(event) => setSelectedWorkspaceId(event.target.value)}
                >
                  {workspaces.map((workspace) => (
                    <option key={workspace.id} value={workspace.id}>
                      {workspace.name}
                    </option>
                  ))}
                </select>

                <label
                  className="settings-field-label"
                  htmlFor="codex-workspace-path"
                >
                  {t("settings.codexWorkspacePath")}
                </label>
                <input
                  id="codex-workspace-path"
                  className="settings-input"
                  value={workspaceCodexPathDraft}
                  placeholder={t("settings.codexWorkspaceInheritPath")}
                  onChange={(event) =>
                    setWorkspaceCodexPathDraft(event.target.value)
                  }
                />
                <label
                  className="settings-field-label"
                  htmlFor="codex-workspace-args"
                >
                  {t("settings.codexWorkspaceArgs")}
                </label>
                <input
                  id="codex-workspace-args"
                  className="settings-input"
                  value={workspaceCodexArgsDraft}
                  placeholder={t("settings.codexWorkspaceInheritArgs")}
                  onChange={(event) =>
                    setWorkspaceCodexArgsDraft(event.target.value)
                  }
                />
                <div className="settings-help">
                  {t("settings.codexWorkspaceSourceLabel")}{" "}
                  {workspaceExecutableSource} / {workspaceArgumentsSource}
                </div>
                <div className="settings-field-actions">
                  <button
                    type="button"
                    className="ghost settings-button-compact"
                    onClick={() => {
                      void handlePreviewWorkspaceLaunch();
                    }}
                    disabled={workspacePreviewState.status === "running"}
                  >
                    <Stethoscope aria-hidden />
                    {workspacePreviewState.status === "running"
                      ? t("settings.previewingLaunch")
                      : t("settings.previewLaunch")}
                  </button>
                  {workspaceLaunchDirty ? (
                    <button
                      type="button"
                      className="primary"
                      onClick={() => {
                        void handleSaveWorkspaceLaunch();
                      }}
                      disabled={workspaceSaveState.status === "saving"}
                    >
                      {workspaceSaveState.status === "saving"
                        ? t("settings.saving")
                        : t("settings.codexWorkspaceSave")}
                    </button>
                  ) : null}
                </div>
                {workspaceSaveState.message ? (
                  <div
                    className={
                      workspaceSaveState.status === "error"
                        ? "settings-error"
                        : "settings-help"
                    }
                  >
                    {workspaceSaveState.message}
                  </div>
                ) : null}
                <LaunchPreviewCard t={t} state={workspacePreviewState} />
              </>
            ) : (
              <div className="settings-empty">
                {t("settings.codexWorkspaceNoWorkspaces")}
              </div>
            )}
          </div>

          {ENABLE_COMPUTER_USE_BRIDGE ? <ComputerUseStatusCard /> : null}
        </TabsPanel>

        <TabsPanel value="claude">
          <div className="settings-field">
            <label className="settings-field-label" htmlFor="claude-path">
              {t("settings.defaultClaudePath")}
            </label>
            <div className="settings-field-row">
              <input
                id="claude-path"
                className="settings-input"
                value={claudePathDraft}
                placeholder={t("settings.claudePlaceholder")}
                onChange={(event) => setClaudePathDraft(event.target.value)}
              />
              <button
                type="button"
                className="ghost"
                onClick={() => void handleBrowseClaude()}
              >
                {t("settings.browse")}
              </button>
              <button
                type="button"
                className="ghost"
                onClick={() => setClaudePathDraft("")}
              >
                {t("settings.usePath")}
              </button>
            </div>
            <div className="settings-help">
              {t("settings.pathResolutionDesc")}
            </div>
            <div className="settings-field-actions">
              {claudeDirty ? (
                <button
                  type="button"
                  className="primary"
                  onClick={() => {
                    void handleSaveClaudeSettings();
                  }}
                  disabled={isSavingSettings}
                >
                  {isSavingSettings ? t("settings.saving") : t("common.save")}
                </button>
              ) : null}
              <button
                type="button"
                className="ghost settings-button-compact"
                onClick={() => {
                  void handleRunClaudeDoctor();
                }}
                disabled={claudeDoctorState.status === "running"}
              >
                <Stethoscope aria-hidden />
                {claudeDoctorState.status === "running"
                  ? t("settings.running")
                  : t("settings.runClaudeDoctor")}
              </button>
              <button
                type="button"
                className="ghost settings-button-compact"
                onClick={() => {
                  void requestInstallPlan("claude", claudeDoctorState.result);
                }}
                disabled={
                  installerState.status === "planning" ||
                  installerState.status === "running"
                }
              >
                {resolveInstallerAction(claudeDoctorState.result) ===
                "installLatest"
                  ? t("settings.cliInstallLatest")
                  : t("settings.cliUpdateLatest")}
              </button>
            </div>

            <DoctorResultCard
              t={t}
              state={claudeDoctorState}
              successTitleKey="settings.claudeLooksGood"
              errorTitleKey="settings.claudeIssueDetected"
              showAppServer={false}
            />
          </div>
        </TabsPanel>

      </Tabs>

      {installerState.status !== "idle" ? (
        <div className="settings-doctor">
          <div className="settings-doctor-title">
            {t("settings.cliInstallerTitle")}
          </div>
          <div className="settings-doctor-body">
            {installerState.status === "planning" ? (
              <div>{t("settings.cliInstallerPlanning")}</div>
            ) : null}
            {installerState.plan ? (
              <>
                <div>
                  <strong>{t("settings.cliInstallerEngine")}:</strong>{" "}
                  {installerState.plan.engine}
                </div>
                <div>
                  <strong>{t("settings.cliInstallerAction")}:</strong>{" "}
                  {installerState.plan.action}
                </div>
                <div>
                  <strong>{t("settings.cliInstallerBackend")}:</strong>{" "}
                  {installerState.plan.backend}
                </div>
                <div>
                  <strong>{t("settings.cliInstallerPlatform")}:</strong>{" "}
                  {installerState.plan.platform}
                </div>
                <div>
                  <strong>{t("settings.cliInstallerCommand")}:</strong>{" "}
                  <code>{installerState.plan.commandPreview.join(" ")}</code>
                </div>
                {installerState.plan.warnings.map((warning) => (
                  <div key={warning}>{warning}</div>
                ))}
                {installerState.plan.blockers.map((blocker) => (
                  <div key={blocker}>{blocker}</div>
                ))}
                {installerState.plan.manualFallback ? (
                  <div>
                    <strong>{t("settings.cliInstallerManualFallback")}:</strong>{" "}
                    <code>{installerState.plan.manualFallback}</code>
                  </div>
                ) : null}
                <div className="settings-field-actions">
                  <button
                    type="button"
                    className="primary"
                    disabled={
                      !installerState.plan.canRun ||
                      installerState.status === "running"
                    }
                    onClick={() => {
                      void confirmInstallRun();
                    }}
                  >
                    {installerState.status === "running"
                      ? t("settings.cliInstallerRunning")
                      : t("settings.cliInstallerConfirm")}
                  </button>
                  <button
                    type="button"
                    className="ghost"
                    disabled={installerState.status === "running"}
                    onClick={() => {
                      installPlanRequestSeqRef.current += 1;
                      setInstallerState({
                        status: "idle",
                        engine: null,
                        action: null,
                        plan: null,
                        result: null,
                        error: null,
                        progressRunId: null,
                        logLines: [],
                        startedAtMs: null,
                        lastEventAtMs: null,
                      });
                    }}
                  >
                    {t("common.cancel")}
                  </button>
                </div>
              </>
            ) : null}
            {installerState.status === "running" ||
            installerState.logLines.length > 0 ? (
              <div className="settings-installer-log">
                <div className="settings-installer-log-meta">
                  <span>{t("settings.cliInstallerLiveLog")}</span>
                  <span>
                    {t("settings.cliInstallerElapsed")}{" "}
                    {formatDurationMs(
                      installerState.startedAtMs
                        ? (installerState.status === "running"
                            ? installerNowMs
                            : (installerState.lastEventAtMs ??
                              installerNowMs)) - installerState.startedAtMs
                        : null,
                    )}
                  </span>
                </div>
                {installerState.logLines.length > 0 ? (
                  <pre className="settings-installer-log-output">
                    {installerState.logLines
                      .map((line) => {
                        const stream = line.stream
                          ? `${line.stream}`
                          : line.phase;
                        return `[${stream}] ${line.message}`;
                      })
                      .join("\n")}
                  </pre>
                ) : (
                  <div>{t("settings.cliInstallerWaitingForOutput")}</div>
                )}
              </div>
            ) : null}
            {installerState.result ? (
              <div
                className={
                  installerState.result.ok
                    ? "settings-doctor ok"
                    : "settings-doctor error"
                }
              >
                <div className="settings-doctor-title">
                  {installerState.result.ok
                    ? t("settings.cliInstallerSucceeded")
                    : t("settings.cliInstallerFailed")}
                </div>
                <div>
                  {t("settings.cliInstallerExitCode")}{" "}
                  {installerState.result.exitCode ??
                    t("settings.statusUnknown")}
                </div>
                {installerState.result.details ? (
                  <div>{installerState.result.details}</div>
                ) : null}
                {installerState.result.stdoutSummary ? (
                  <pre className="settings-doctor-path">
                    {installerState.result.stdoutSummary}
                  </pre>
                ) : null}
                {installerState.result.stderrSummary ? (
                  <pre className="settings-doctor-path">
                    {installerState.result.stderrSummary}
                  </pre>
                ) : null}
              </div>
            ) : null}
            {installerState.error ? (
              <div className="settings-doctor error">
                {installerState.error}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
