import { useCallback, useEffect, useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { QRCode } from "antd";
import type { WorkspaceInfo } from "@/types";
import {
  createWechatBridgeManualSubscriptionOrder,
  getNewapiEntitlementAccount,
  getNewapiEntitlements,
  getWechatBridgeStatus,
  getWechatBridgeSubscriptionPlans,
  resetWechatBridgeLogin,
  resetWechatBridgeRebindSecretWithCode,
  runWechatBridgeDiagnostics,
  saveNewapiEntitlementAccount,
  sendWechatBridgeRebindRecoveryCode,
  sendWechatBridgeVerificationPrompt,
  setWechatBridgeRebindSecret,
  startWechatBridge,
  stopWechatBridge,
  type NewapiEntitlementAccount,
  type NewapiEntitlements,
  type NewapiSubscriptionPlanDto,
  type NewapiWechatBridgeManualSubscriptionOrder,
  type WeChatBridgeDiagnosticCheck,
  type WeChatBridgeDiagnostics,
  type WeChatBridgeDiagnosticState,
  type WeChatBridgePhase,
  type WeChatBridgeStatus,
} from "@/services/tauri";

type WeChatBridgeSettingsProps = {
  t: (key: string) => string;
  activeWorkspace: WorkspaceInfo | null;
  keepOnlineEnabled?: boolean;
  onKeepOnlineChange?: (enabled: boolean) => Promise<void>;
};

type WeChatBridgeAction =
  | "start"
  | "stop"
  | "refresh"
  | "diagnostics"
  | "reset"
  | "rebindRecovery"
  | "resetRebindSecret"
  | "saveRebindSecret"
  | "probe"
  | "subscribe"
  | "confirmPayment"
  | "account"
  | "keepOnline"
  | null;

const WECLAW_INSTALL_GUIDE_URL =
  "https://github.com/fastclaw-ai/weclaw/blob/main/README_CN.md#快速开始";

const MODEL_SITE_URL = "https://model.codingrui.work";

const WECHAT_BRIDGE_TEST_MESSAGE = "连接测试：请只回复 OK。";

const PHASE_LABEL_KEYS: Record<WeChatBridgePhase, string> = {
  not_ready: "settings.wechatBridgePhaseNotReady",
  stopped: "settings.wechatBridgePhaseStopped",
  starting: "settings.wechatBridgePhaseStarting",
  waiting_scan: "settings.wechatBridgePhaseWaitingScan",
  running: "settings.wechatBridgePhaseRunning",
  error: "settings.wechatBridgePhaseError",
};

const DIAGNOSTIC_LABEL_KEYS: Record<string, string> = {
  component: "settings.wechatBridgeDiagnosticComponent",
  daemon: "settings.wechatBridgeDiagnosticDaemon",
  bridge: "settings.wechatBridgeDiagnosticBridge",
  weclaw: "settings.wechatBridgeDiagnosticWeclaw",
  weclawSync: "settings.wechatBridgeDiagnosticWeclawSync",
  scan: "settings.wechatBridgeDiagnosticScan",
};

function phaseTone(phase: WeChatBridgePhase): "muted" | "good" | "warn" | "bad" {
  if (phase === "running") {
    return "good";
  }
  if (phase === "waiting_scan" || phase === "starting") {
    return "warn";
  }
  if (phase === "error" || phase === "not_ready") {
    return "bad";
  }
  return "muted";
}

function diagnosticStateLabel(
  t: (key: string) => string,
  state: WeChatBridgeDiagnosticState,
) {
  if (state === "pass") {
    return t("settings.wechatBridgeDiagnosticsPassed");
  }
  return t("settings.wechatBridgeDiagnosticsNeedsAction");
}

function diagnosticStateTone(state: WeChatBridgeDiagnosticState) {
  if (state === "pass") {
    return "good";
  }
  if (state === "warn") {
    return "warn";
  }
  return "bad";
}

function testInstructionKey(phase: WeChatBridgePhase) {
  if (phase === "waiting_scan" || phase === "starting") {
    return "settings.wechatBridgeTestWaitingScan";
  }
  if (phase === "running") {
    return "settings.wechatBridgeTestRunning";
  }
  return "settings.wechatBridgeTestIdle";
}

function activityDecisionKey(decision: string) {
  if (decision === "allow") {
    return "settings.wechatBridgeActivityAllow";
  }
  if (decision === "deny") {
    return "settings.wechatBridgeActivityDeny";
  }
  return "settings.wechatBridgeActivityError";
}

function activityEmptyKey(status: WeChatBridgeStatus | null) {
  return status?.hasLocalSmokeActivity
    ? "settings.wechatBridgeActivitySmokeOnly"
    : "settings.wechatBridgeActivityEmpty";
}

function syncStatusKey(status: WeChatBridgeStatus | null) {
  if (!status?.weclawRunning || status.weclawSyncAgeSecs == null) {
    return null;
  }
  return status.weclawSyncFresh
    ? "settings.wechatBridgeSyncFresh"
    : "settings.wechatBridgeSyncStale";
}

function isNewapiMissingError(error: string | null) {
  if (!error) {
    return false;
  }
  const normalized = error.toLowerCase();
  return (
    error.includes("未配置 new-api") ||
    error.includes("未配置模型站点账号 Key") ||
    (normalized.includes("new-api") && normalized.includes("not configured")) ||
    (normalized.includes("model-site key") && normalized.includes("not configured"))
  );
}

function formatTemplate(template: string, values: Record<string, string>) {
  return Object.entries(values).reduce(
    (next, [key, value]) => next.replaceAll(`{{${key}}}`, value),
    template,
  );
}

function entitlementAccountSourceLabel(
  t: (key: string) => string,
  source: string | null | undefined,
) {
  if (source === "provider") {
    return t("settings.wechatBridgeAccountSourceProvider");
  }
  if (source === "claude_settings") {
    return t("settings.wechatBridgeAccountSourceClaudeSettings");
  }
  return t("settings.wechatBridgeAccountSourceExplicit");
}

function boundAccountValue(t: (key: string) => string, status: WeChatBridgeStatus | null) {
  if (status?.boundWechatUserId) {
    return status.boundWechatUserId;
  }
  if (status?.boundWechatBotId) {
    return status.boundWechatBotId;
  }
  if (status?.wechatBound) {
    return t("settings.wechatBridgeBoundUnknown");
  }
  return t("settings.wechatBridgeNoBoundAccount");
}

function recentMessageValue(t: (key: string) => string, status: WeChatBridgeStatus | null) {
  if (status?.lastActivity) {
    return t(activityDecisionKey(status.lastActivity.decision));
  }
  if (status?.hasLocalSmokeActivity) {
    return t(activityEmptyKey(status));
  }
  return t("settings.wechatBridgeNoRecentMessage");
}

function hasVerifiedTextReply(status: WeChatBridgeStatus | null) {
  return status?.lastActivity?.decision === "allow";
}

function hasVerifiedMedia(status: WeChatBridgeStatus | null) {
  return status?.lastMediaActivity?.status === "saved";
}

function hasVerifiedQuote(status: WeChatBridgeStatus | null) {
  const quoteStatus = status?.lastQuoteActivity?.status;
  return status?.lastQuoteActivity != null && (quoteStatus == null || quoteStatus === "parsed");
}

function hasCompletedRealVerification(status: WeChatBridgeStatus | null) {
  return (
    hasVerifiedTextReply(status)
    && hasVerifiedMedia(status)
    && hasVerifiedQuote(status)
  );
}

export function WeChatBridgeSettings({
  t,
  activeWorkspace,
  keepOnlineEnabled = false,
  onKeepOnlineChange = async () => {},
}: WeChatBridgeSettingsProps) {
  const [status, setStatus] = useState<WeChatBridgeStatus | null>(null);
  const [action, setAction] = useState<WeChatBridgeAction>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [diagnostics, setDiagnostics] = useState<WeChatBridgeDiagnostics | null>(
    null,
  );
  const [entitlements, setEntitlements] = useState<NewapiEntitlements | null>(null);
  const [entitlementAccount, setEntitlementAccount] =
    useState<NewapiEntitlementAccount | null>(null);
  const [subscriptionPlans, setSubscriptionPlans] = useState<NewapiSubscriptionPlanDto[]>([]);
  const [subscriptionOrder, setSubscriptionOrder] =
    useState<NewapiWechatBridgeManualSubscriptionOrder | null>(null);
  const [subscriptionOrderNotice, setSubscriptionOrderNotice] = useState<string | null>(null);
  const [entitlementError, setEntitlementError] = useState<string | null>(null);
  const [accountFormOpen, setAccountFormOpen] = useState(false);
  const [accountBaseUrlDraft, setAccountBaseUrlDraft] = useState(MODEL_SITE_URL);
  const [accountApiKeyDraft, setAccountApiKeyDraft] = useState("");
  const [rebindPanelOpen, setRebindPanelOpen] = useState(false);
  const [rebindSecretDraft, setRebindSecretDraft] = useState("");
  const [rebindSecretConfirmDraft, setRebindSecretConfirmDraft] = useState("");
  const [rebindRecoveryOpen, setRebindRecoveryOpen] = useState(false);
  const [rebindRecoveryCodeDraft, setRebindRecoveryCodeDraft] = useState("");
  const [rebindRecoveryNewSecretDraft, setRebindRecoveryNewSecretDraft] = useState("");

  const refreshStatus = useCallback(async () => {
    setAction("refresh");
    setError(null);
    try {
      const next = await getWechatBridgeStatus();
      setStatus(next);
      setDiagnostics(null);
      setError(next.lastError ?? null);
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : String(statusError));
    } finally {
      setAction(null);
    }
  }, []);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  const refreshEntitlementAccount = useCallback(async () => {
    try {
      const next = await getNewapiEntitlementAccount();
      setEntitlementAccount(next);
      setAccountBaseUrlDraft(next.baseUrl || MODEL_SITE_URL);
    } catch (accountError) {
      setError(accountError instanceof Error ? accountError.message : String(accountError));
      setEntitlementAccount({
        baseUrl: MODEL_SITE_URL,
        hasToken: false,
        tokenPreview: null,
        source: "missing",
      });
    }
  }, []);

  useEffect(() => {
    void refreshEntitlementAccount();
  }, [refreshEntitlementAccount]);

  const refreshEntitlements = useCallback(async () => {
    setEntitlementError(null);
    try {
      const [nextEntitlements, nextPlans] = await Promise.all([
        getNewapiEntitlements(),
        getWechatBridgeSubscriptionPlans(),
      ]);
      setEntitlements(nextEntitlements);
      setSubscriptionPlans(nextPlans);
    } catch (entitlementFetchError) {
      setEntitlementError(
        entitlementFetchError instanceof Error
          ? entitlementFetchError.message
          : String(entitlementFetchError),
      );
      setEntitlements(null);
      setSubscriptionPlans([]);
    }
  }, []);

  useEffect(() => {
    void refreshEntitlements();
  }, [refreshEntitlements]);

  const handleCreateSubscriptionOrder = useCallback(async () => {
    const plan = subscriptionPlans[0]?.plan;
    if (!plan?.id) {
      setEntitlementError(t("settings.wechatBridgeNoSubscriptionPlan"));
      return;
    }
    setAction("subscribe");
    setError(null);
    setCopied(null);
    setEntitlementError(null);
    setSubscriptionOrderNotice(null);
    try {
      const order = await createWechatBridgeManualSubscriptionOrder({
        planId: plan.id,
        paymentMethod: "manual_wechat",
      });
      setSubscriptionOrder(order);
    } catch (subscribeError) {
      setEntitlementError(
        subscribeError instanceof Error ? subscribeError.message : String(subscribeError),
      );
    } finally {
      setAction(null);
    }
  }, [subscriptionPlans, t]);

  const handleCheckSubscriptionPayment = useCallback(async () => {
    setAction("confirmPayment");
    setError(null);
    setCopied(null);
    setEntitlementError(null);
    setSubscriptionOrderNotice(null);
    try {
      const next = await getNewapiEntitlements();
      setEntitlements(next);
      if (next.features?.wechat_bridge === true) {
        setSubscriptionOrder(null);
        setCopied(t("settings.wechatBridgeSubscriptionConfirmed"));
        return;
      }
      setSubscriptionOrderNotice(t("settings.wechatBridgeSubscriptionPendingConfirm"));
    } catch (paymentCheckError) {
      setEntitlementError(
        paymentCheckError instanceof Error
          ? paymentCheckError.message
          : String(paymentCheckError),
      );
    } finally {
      setAction(null);
    }
  }, [t]);

  const handleOpenAccountForm = useCallback(() => {
    setAccountBaseUrlDraft(entitlementAccount?.baseUrl || MODEL_SITE_URL);
    setAccountApiKeyDraft("");
    setAccountFormOpen(true);
    setEntitlementError(null);
  }, [entitlementAccount?.baseUrl]);

  const handleSaveAccount = useCallback(async () => {
    setAction("account");
    setError(null);
    setCopied(null);
    setEntitlementError(null);
    try {
      const next = await saveNewapiEntitlementAccount({
        baseUrl: accountBaseUrlDraft,
        apiKey: accountApiKeyDraft,
      });
      setEntitlementAccount(next);
      setAccountBaseUrlDraft(next.baseUrl || MODEL_SITE_URL);
      setAccountApiKeyDraft("");
      setAccountFormOpen(false);
      setCopied(t("settings.wechatBridgeModelSiteKeySaved"));
      await refreshEntitlements();
    } catch (accountError) {
      const message = accountError instanceof Error ? accountError.message : String(accountError);
      setEntitlementError(`${t("settings.wechatBridgeModelSiteKeySaveFailed")}: ${message}`);
    } finally {
      setAction(null);
    }
  }, [accountApiKeyDraft, accountBaseUrlDraft, refreshEntitlements, t]);

  const handleStart = useCallback(async () => {
    setAction("start");
    setError(null);
    setCopied(null);
    try {
      const next = await startWechatBridge({
        workspaceId: activeWorkspace?.id ?? null,
      });
      setStatus(next);
      setDiagnostics(null);
      setError(next.lastError ?? null);
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : String(startError));
    } finally {
      setAction(null);
    }
  }, [activeWorkspace?.id]);

  const handleKeepOnlineChange = useCallback(
    async (enabled: boolean) => {
      setAction("keepOnline");
      setError(null);
      setCopied(null);
      try {
        await onKeepOnlineChange(enabled);
        if (enabled) {
          const next = await startWechatBridge({
            workspaceId: activeWorkspace?.id ?? null,
          });
          setStatus(next);
          setDiagnostics(null);
          setError(next.lastError ?? null);
        }
      } catch (keepOnlineError) {
        setError(
          keepOnlineError instanceof Error
            ? keepOnlineError.message
            : String(keepOnlineError),
        );
      } finally {
        setAction(null);
      }
    },
    [activeWorkspace?.id, onKeepOnlineChange],
  );

  const handleStop = useCallback(async () => {
    setAction("stop");
    setError(null);
    setCopied(null);
    try {
      const next = await stopWechatBridge();
      setStatus(next);
      setDiagnostics(null);
      setError(next.lastError ?? null);
    } catch (stopError) {
      setError(stopError instanceof Error ? stopError.message : String(stopError));
    } finally {
      setAction(null);
    }
  }, []);

  const handleOpenRebindPanel = useCallback(() => {
    setRebindPanelOpen(true);
    setRebindRecoveryOpen(false);
    setCopied(null);
    setError(null);
  }, []);

  const handleSaveRebindSecret = useCallback(async () => {
    const secret = rebindSecretDraft.trim();
    if (secret !== rebindSecretConfirmDraft.trim()) {
      setError(t("settings.wechatBridgeRebindSecretMismatch"));
      return;
    }
    setAction("saveRebindSecret");
    setError(null);
    setCopied(null);
    try {
      const next = await setWechatBridgeRebindSecret({ secret });
      setStatus(next);
      setDiagnostics(null);
      setCopied(t("settings.wechatBridgeRebindSecretSaved"));
      setRebindSecretDraft("");
      setRebindSecretConfirmDraft("");
      setError(next.lastError ?? null);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : String(saveError));
    } finally {
      setAction(null);
    }
  }, [rebindSecretConfirmDraft, rebindSecretDraft, t]);

  const handleResetLogin = useCallback(async () => {
    const secret = rebindSecretDraft.trim();
    setAction("reset");
    setError(null);
    setCopied(null);
    setDiagnostics(null);
    try {
      const next = await resetWechatBridgeLogin({
        workspaceId: activeWorkspace?.id ?? null,
        rebindSecret: secret,
      });
      setStatus(next);
      setRebindPanelOpen(false);
      setRebindRecoveryOpen(false);
      setRebindSecretDraft("");
      setError(next.lastError ?? null);
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : String(resetError));
    } finally {
      setAction(null);
    }
  }, [activeWorkspace?.id, rebindSecretDraft]);

  const handleSendRebindRecoveryCode = useCallback(async () => {
    setAction("rebindRecovery");
    setError(null);
    setCopied(null);
    try {
      const next = await sendWechatBridgeRebindRecoveryCode();
      setStatus(next);
      setRebindRecoveryOpen(true);
      setCopied(t("settings.wechatBridgeRebindRecoverySent"));
      setError(next.lastError ?? null);
    } catch (recoveryError) {
      setError(recoveryError instanceof Error ? recoveryError.message : String(recoveryError));
    } finally {
      setAction(null);
    }
  }, [t]);

  const handleResetRebindSecretWithCode = useCallback(async () => {
    setAction("resetRebindSecret");
    setError(null);
    setCopied(null);
    try {
      const next = await resetWechatBridgeRebindSecretWithCode({
        code: rebindRecoveryCodeDraft.trim(),
        newSecret: rebindRecoveryNewSecretDraft.trim(),
      });
      setStatus(next);
      setCopied(t("settings.wechatBridgeRebindRecoveryResetDone"));
      setRebindRecoveryCodeDraft("");
      setRebindRecoveryNewSecretDraft("");
      setRebindRecoveryOpen(false);
      setError(next.lastError ?? null);
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : String(resetError));
    } finally {
      setAction(null);
    }
  }, [rebindRecoveryCodeDraft, rebindRecoveryNewSecretDraft, t]);

  const handleSendProbe = useCallback(async () => {
    if (!window.confirm(t("settings.wechatBridgeSendProbeConfirm"))) {
      return;
    }
    setAction("probe");
    setError(null);
    setCopied(null);
    setDiagnostics(null);
    try {
      const next = await sendWechatBridgeVerificationPrompt({
        workspaceId: activeWorkspace?.id ?? null,
      });
      setStatus(next);
      setCopied(t("settings.wechatBridgeProbeSent"));
      setError(next.lastError ?? null);
    } catch (probeError) {
      setError(probeError instanceof Error ? probeError.message : String(probeError));
    } finally {
      setAction(null);
    }
  }, [activeWorkspace?.id, t]);

  const handleCopy = useCallback(
    async (value: string) => {
      try {
        await navigator.clipboard.writeText(value);
        setCopied(t("settings.wechatBridgeCopied"));
      } catch {
        setError(t("settings.wechatBridgeCopyFailed"));
      }
    },
    [t],
  );

  const handleInstallGuide = useCallback(async () => {
    try {
      await openUrl(WECLAW_INSTALL_GUIDE_URL);
    } catch {
      setError(t("settings.wechatBridgeInstallOpenFailed"));
    }
  }, [t]);

  const handleDiagnostics = useCallback(async () => {
    setAction("diagnostics");
    setError(null);
    setCopied(null);
    try {
      const next = await runWechatBridgeDiagnostics();
      setDiagnostics(next);
      setStatus(next.status);
      setError(next.status.lastError ?? null);
    } catch (diagnosticsError) {
      setError(
        diagnosticsError instanceof Error
          ? diagnosticsError.message
          : String(diagnosticsError),
      );
    } finally {
      setAction(null);
    }
  }, []);

  const phase = status?.phase ?? "stopped";
  const tone = phaseTone(phase);
  const isBusy = action != null;
  const rebindSecretConfigured = status?.rebindSecretConfigured === true;
  const rebindSecretDraftReady = rebindSecretDraft.trim().length >= 6;
  const rebindSecretSetupReady =
    rebindSecretDraftReady && rebindSecretConfirmDraft.trim().length >= 6;
  const rebindRecoveryReady =
    rebindRecoveryCodeDraft.trim().length > 0
    && rebindRecoveryNewSecretDraft.trim().length >= 6;
  const hasBoundWechatAccount =
    status?.wechatBound === true ||
    Boolean(status?.boundWechatUserId || status?.boundWechatBotId);
  const showStop = status?.bridgeRunning || status?.weclawRunning;
  const showResetLogin =
    phase === "running" &&
    status?.weclawRunning === true &&
    hasBoundWechatAccount;
  const showSendProbe = showResetLogin && !hasVerifiedTextReply(status);
  const showInstallGuide = status?.weclawAvailable === false;
  const shouldShowQr =
    phase === "waiting_scan" &&
    !hasBoundWechatAccount &&
    rebindSecretConfigured;
  const qrContent = shouldShowQr ? status?.qrText ?? status?.loginUrl ?? null : null;
  const loginUrl = status?.loginUrl ?? null;
  const syncKey = status?.weclawSyncFresh ? null : syncStatusKey(status);
  const boundValue = boundAccountValue(t, status);
  const recentValue = recentMessageValue(t, status);
  const showTestPanel = !hasVerifiedTextReply(status);
  const wechatEntitled = entitlements?.features?.wechat_bridge === true;
  const currentEntitlement = entitlements?.entitlements?.wechat_bridge;
  const firstPlan = subscriptionPlans[0]?.plan;
  const newapiMissing = isNewapiMissingError(entitlementError);
  const entitlementRequestFailed = entitlementError != null && !newapiMissing;
  const accountMissing = entitlementAccount?.hasToken === false;
  const shouldConfigureAccount = newapiMissing || accountMissing;
  const entitlementLoading = entitlements == null && entitlementError == null;
  const canStartBridge =
    rebindSecretConfigured
    && !shouldConfigureAccount
    && !entitlementRequestFailed
    && !entitlementLoading;
  const subscriptionHelp = currentEntitlement?.plan_title
    ? `${currentEntitlement.plan_title} · ${t("settings.wechatBridgeEntitlementExpiresAt")} ${new Date(currentEntitlement.expires_at * 1000).toLocaleString()}`
    : shouldConfigureAccount
      ? t("settings.wechatBridgeNewapiMissingHelp")
      : entitlementRequestFailed
        ? t("settings.wechatBridgeEntitlementRequestFailedHelp")
        : firstPlan?.title
          ? `${firstPlan.title} · ¥${Number(firstPlan.price_amount ?? 0).toFixed(2)}`
          : t("settings.wechatBridgeNoSubscriptionPlan");
  const accountHelp = entitlementAccount?.hasToken
    ? formatTemplate(t("settings.wechatBridgeAccountConfigured"), {
        source: entitlementAccountSourceLabel(t, entitlementAccount.source),
        token: entitlementAccount.tokenPreview ?? t("settings.wechatBridgeAccountTokenConfigured"),
      })
    : t("settings.wechatBridgeAccountMissing");

  useEffect(() => {
    const shouldPollStartup = phase === "starting" || phase === "waiting_scan";
    const shouldPollRealVerification =
      phase === "running" && !hasCompletedRealVerification(status);
    if (!shouldPollStartup && !shouldPollRealVerification) {
      return;
    }
    const intervalId = window.setInterval(() => {
      void refreshStatus();
    }, 2000);
    return () => {
      window.clearInterval(intervalId);
    };
  }, [phase, refreshStatus, status]);

  return (
    <div className="settings-field wechat-bridge-settings">
      <div className="settings-field-label">{t("settings.wechatBridgeTitle")}</div>
      <div className="settings-help">{t("settings.wechatBridgeDescription")}</div>

      <div
        className={`wechat-bridge-account ${entitlementAccount?.hasToken ? "is-good" : "is-warn"}`}
      >
        <div>
          <div className="wechat-bridge-subscription-title">
            {t("settings.wechatBridgeAccountTitle")}
          </div>
          <div className="settings-help">{accountHelp}</div>
        </div>
        {entitlementAccount?.hasToken ? (
          <button
            type="button"
            className="ghost settings-button-compact"
            onClick={handleOpenAccountForm}
            disabled={isBusy}
          >
            {t("settings.wechatBridgeChangeModelSiteKey")}
          </button>
        ) : null}
      </div>
      {accountFormOpen ? (
        <div className="wechat-bridge-account-form">
          <label className="settings-field">
            <span className="settings-field-label">
              {t("settings.wechatBridgeModelSiteBaseUrl")}
            </span>
            <input
              aria-label={t("settings.wechatBridgeModelSiteBaseUrl")}
              className="settings-input"
              value={accountBaseUrlDraft}
              onChange={(event) => setAccountBaseUrlDraft(event.target.value)}
            />
          </label>
          <label className="settings-field">
            <span className="settings-field-label">
              {t("settings.wechatBridgeModelSiteApiKey")}
            </span>
            <input
              aria-label={t("settings.wechatBridgeModelSiteApiKey")}
              className="settings-input"
              type="password"
              value={accountApiKeyDraft}
              onChange={(event) => setAccountApiKeyDraft(event.target.value)}
            />
          </label>
          <button
            type="button"
            className="primary settings-button-compact"
            onClick={() => {
              void handleSaveAccount();
            }}
            disabled={isBusy || accountApiKeyDraft.trim().length === 0}
          >
            {action === "account"
              ? t("settings.wechatBridgeSavingModelSiteKey")
              : t("settings.wechatBridgeSaveModelSiteKey")}
          </button>
        </div>
      ) : null}

      <div className={`wechat-bridge-subscription ${wechatEntitled ? "is-good" : "is-warn"}`}>
        <div>
          <div className="wechat-bridge-subscription-title">
            {wechatEntitled
              ? t("settings.wechatBridgeEntitlementActive")
              : t("settings.wechatBridgeEntitlementInactive")}
          </div>
          <div className="settings-help">
            {subscriptionHelp}
          </div>
        </div>
        {!wechatEntitled ? (
          shouldConfigureAccount ? (
            <button
              type="button"
              className="primary settings-button-compact"
              onClick={handleOpenAccountForm}
              disabled={isBusy}
            >
              {t("settings.wechatBridgeConfigureModelSiteKey")}
            </button>
          ) : entitlementRequestFailed ? (
            <button
              type="button"
              className="ghost settings-button-compact"
              onClick={() => {
                void refreshEntitlements();
              }}
              disabled={isBusy}
            >
              {t("settings.refresh")}
            </button>
          ) : (
            <button
              type="button"
              className="primary settings-button-compact"
              onClick={() => {
                void handleCreateSubscriptionOrder();
              }}
              disabled={isBusy || subscriptionPlans.length === 0}
            >
              {action === "subscribe"
                ? t("settings.running")
                : t("settings.wechatBridgeSubscribe")}
            </button>
          )
        ) : (
          <button
            type="button"
            className="ghost settings-button-compact"
            onClick={() => {
              void refreshEntitlements();
            }}
            disabled={isBusy}
          >
            {t("settings.refresh")}
          </button>
        )}
      </div>
      {subscriptionOrder ? (
        <div className="wechat-bridge-subscription-order">
          <div className="settings-field-label">
            {t("settings.wechatBridgeSubscriptionOrderTitle")}
          </div>
          <div className="settings-help">
            {t("settings.wechatBridgeSubscriptionOrderHelp")}
          </div>
          {subscriptionOrder.qr_url ? (
            <img
              className="wechat-bridge-subscription-qr"
              src={subscriptionOrder.qr_url}
              alt={t("settings.wechatBridgeSubscriptionQrAlt")}
            />
          ) : null}
          <div className="wechat-bridge-subscription-order-meta">
            <span>{t("settings.wechatBridgeSubscriptionTradeNo")}</span>
            <code>{subscriptionOrder.trade_no}</code>
            <span>{t("settings.wechatBridgeSubscriptionMoney")}</span>
            <strong>¥{subscriptionOrder.money.toFixed(2)}</strong>
          </div>
          <div className="wechat-bridge-subscription-order-actions">
            <button
              type="button"
              className="primary settings-button-compact"
              onClick={() => {
                void handleCheckSubscriptionPayment();
              }}
              disabled={isBusy}
            >
              {action === "confirmPayment"
                ? t("settings.wechatBridgeSubscriptionChecking")
                : t("settings.wechatBridgeSubscriptionPaidCheck")}
            </button>
          </div>
          {subscriptionOrderNotice ? (
            <div className="settings-help">{subscriptionOrderNotice}</div>
          ) : null}
        </div>
      ) : null}
      {entitlementError && !newapiMissing ? (
        <div className="settings-error" role="alert">
          {entitlementError}
        </div>
      ) : null}

      {!rebindSecretConfigured ? (
        <div className="wechat-bridge-account is-warn">
          <div>
            <div className="wechat-bridge-subscription-title">
              {t("settings.wechatBridgeRebindSecretTitle")}
            </div>
            <div className="settings-help">
              {t("settings.wechatBridgeRebindSecretDescription")}
            </div>
            <div className="settings-help">
              {t("settings.wechatBridgeRebindSecretRequired")}
            </div>
          </div>
          <div className="wechat-bridge-account-form">
            <label className="settings-field">
              <span className="settings-field-label">
                {t("settings.wechatBridgeRebindSecretInput")}
              </span>
              <input
                aria-label={t("settings.wechatBridgeRebindSecretInput")}
                className="settings-input"
                type="password"
                value={rebindSecretDraft}
                onChange={(event) => setRebindSecretDraft(event.target.value)}
              />
            </label>
            <label className="settings-field">
              <span className="settings-field-label">
                {t("settings.wechatBridgeRebindSecretConfirmInput")}
              </span>
              <input
                aria-label={t("settings.wechatBridgeRebindSecretConfirmInput")}
                className="settings-input"
                type="password"
                value={rebindSecretConfirmDraft}
                onChange={(event) => setRebindSecretConfirmDraft(event.target.value)}
              />
            </label>
            <button
              type="button"
              className="primary settings-button-compact"
              onClick={() => {
                void handleSaveRebindSecret();
              }}
              disabled={isBusy || !rebindSecretSetupReady}
            >
              {action === "saveRebindSecret"
                ? t("settings.running")
                : t("settings.wechatBridgeRebindSecretSave")}
            </button>
          </div>
        </div>
      ) : null}

      <div className={`wechat-bridge-status is-${tone}`}>
        <span className="wechat-bridge-status-dot" aria-hidden />
        <div>
          <div className="wechat-bridge-status-title">
            {t(PHASE_LABEL_KEYS[phase])}
          </div>
          <div className="wechat-bridge-status-subtitle">
            {boundValue}
          </div>
          <div className="wechat-bridge-status-meta">
            <span>{t("settings.wechatBridgeTargetWorkspace")}</span>
            <strong>{activeWorkspace?.name ?? t("settings.wechatBridgeNoWorkspace")}</strong>
            <span>{t("settings.wechatBridgeRecentMessage")}</span>
            <strong>{recentValue}</strong>
          </div>
        </div>
      </div>
      {syncKey ? (
        <div
          className={`wechat-bridge-sync-status ${status?.weclawSyncFresh ? "is-good" : "is-warn"}`}
        >
          {t(syncKey)}
        </div>
      ) : null}

      {showInstallGuide ? (
        <div className="wechat-bridge-recovery">
          <div className="settings-help">{t("settings.wechatBridgeInstallHelp")}</div>
          <button
            type="button"
            className="primary settings-button-compact"
            onClick={() => {
              void handleInstallGuide();
            }}
          >
            {t("settings.wechatBridgeInstallGuide")}
          </button>
        </div>
      ) : null}

      <div className="settings-toggle-row">
        <div>
          <div className="settings-toggle-title">
            {t("settings.wechatBridgeKeepOnlineTitle")}
          </div>
          <div className="settings-toggle-subtitle">
            {t("settings.wechatBridgeKeepOnlineDescription")}
          </div>
        </div>
        <input
          type="checkbox"
          aria-label={t("settings.wechatBridgeKeepOnlineTitle")}
          checked={keepOnlineEnabled}
          disabled={isBusy}
          onChange={(event) => {
            void handleKeepOnlineChange(event.currentTarget.checked);
          }}
        />
      </div>

      <div className="settings-field-row">
        {showStop ? (
          <button
            type="button"
            className="ghost settings-button-compact"
            onClick={() => {
              void handleStop();
            }}
            disabled={isBusy}
          >
            {action === "stop"
              ? t("settings.running")
              : t("settings.wechatBridgeStop")}
          </button>
        ) : showInstallGuide ? null : (
          <button
            type="button"
            className="primary settings-button-compact"
            onClick={() => {
              void handleStart();
            }}
            disabled={isBusy || !canStartBridge}
          >
            {action === "start"
              ? t("settings.running")
              : t("settings.wechatBridgeStart")}
          </button>
        )}
        <button
          type="button"
          className="ghost settings-button-compact"
          onClick={() => {
            void refreshStatus();
          }}
          disabled={isBusy}
        >
          {t("settings.refresh")}
        </button>
        {showResetLogin ? (
          <button
            type="button"
            className="ghost settings-button-compact"
            onClick={handleOpenRebindPanel}
            disabled={isBusy}
          >
            {action === "reset"
              ? t("settings.running")
              : t("settings.wechatBridgeRebind")}
          </button>
        ) : null}
        {showSendProbe ? (
          <button
            type="button"
            className="ghost settings-button-compact"
            onClick={() => {
              void handleSendProbe();
            }}
            disabled={isBusy}
          >
            {action === "probe"
              ? t("settings.running")
              : t("settings.wechatBridgeSendProbe")}
          </button>
        ) : null}
        <button
          type="button"
          className="ghost settings-button-compact"
          onClick={() => {
            void handleDiagnostics();
          }}
          disabled={isBusy}
        >
          {action === "diagnostics"
            ? t("settings.running")
            : t("settings.wechatBridgeDiagnostics")}
        </button>
      </div>

      {rebindPanelOpen ? (
        <div className="wechat-bridge-recovery">
          <label className="settings-field">
            <span className="settings-field-label">
              {t("settings.wechatBridgeRebindSecretInput")}
            </span>
            <input
              aria-label={t("settings.wechatBridgeRebindSecretInput")}
              className="settings-input"
              type="password"
              value={rebindSecretDraft}
              onChange={(event) => setRebindSecretDraft(event.target.value)}
            />
          </label>
          <div className="settings-field-row">
            <button
              type="button"
              className="primary settings-button-compact"
              onClick={() => {
                void handleResetLogin();
              }}
              disabled={isBusy || !rebindSecretDraftReady}
            >
              {action === "reset"
                ? t("settings.running")
                : t("settings.wechatBridgeRebindSecretContinue")}
            </button>
            <button
              type="button"
              className="ghost settings-button-compact"
              onClick={() => {
                setRebindPanelOpen(false);
                setRebindRecoveryOpen(false);
                setRebindSecretDraft("");
              }}
              disabled={isBusy}
            >
              {t("settings.wechatBridgeRebindSecretCancel")}
            </button>
            <button
              type="button"
              className="ghost settings-button-compact"
              onClick={() => {
                void handleSendRebindRecoveryCode();
              }}
              disabled={isBusy}
            >
              {action === "rebindRecovery"
                ? t("settings.running")
                : t("settings.wechatBridgeRebindForgotSecret")}
            </button>
          </div>
        </div>
      ) : null}

      {rebindRecoveryOpen ? (
        <div className="wechat-bridge-account-form">
          <label className="settings-field">
            <span className="settings-field-label">
              {t("settings.wechatBridgeRebindRecoveryCode")}
            </span>
            <input
              aria-label={t("settings.wechatBridgeRebindRecoveryCode")}
              className="settings-input"
              value={rebindRecoveryCodeDraft}
              onChange={(event) => setRebindRecoveryCodeDraft(event.target.value)}
            />
          </label>
          <label className="settings-field">
            <span className="settings-field-label">
              {t("settings.wechatBridgeRebindRecoveryNewSecret")}
            </span>
            <input
              aria-label={t("settings.wechatBridgeRebindRecoveryNewSecret")}
              className="settings-input"
              type="password"
              value={rebindRecoveryNewSecretDraft}
              onChange={(event) => setRebindRecoveryNewSecretDraft(event.target.value)}
            />
          </label>
          <button
            type="button"
            className="primary settings-button-compact"
            onClick={() => {
              void handleResetRebindSecretWithCode();
            }}
            disabled={isBusy || !rebindRecoveryReady}
          >
            {action === "resetRebindSecret"
              ? t("settings.running")
              : t("settings.wechatBridgeRebindRecoveryReset")}
          </button>
        </div>
      ) : null}

      {qrContent ? (
        <div className="wechat-bridge-qr-panel">
          <div className="settings-field-label">
            {t("settings.wechatBridgeQrTitle")}
          </div>
          {loginUrl ? (
            <div className="wechat-bridge-qr-code">
              <QRCode
                value={loginUrl}
                type="svg"
                bordered={false}
                errorLevel="M"
                data-testid="wechat-login-qrcode"
              />
            </div>
          ) : null}
          {!loginUrl ? <pre className="wechat-bridge-qr-text">{qrContent}</pre> : null}
          <button
            type="button"
            className="ghost settings-button-compact"
            onClick={() => {
              void handleCopy(qrContent);
            }}
          >
            {loginUrl ? t("settings.wechatBridgeCopyLoginLink") : t("settings.copy")}
          </button>
        </div>
      ) : null}

      {showTestPanel ? (
        <div className="wechat-bridge-test-panel">
          <div className="settings-field-label">
            {t("settings.wechatBridgeTestTitle")}
          </div>
          <div className="settings-help">{t(testInstructionKey(phase))}</div>
          <div className="wechat-bridge-test-message">
            <span className="wechat-bridge-test-message-label">
              {t("settings.wechatBridgeTestMessageLabel")}
            </span>
            <code>{WECHAT_BRIDGE_TEST_MESSAGE}</code>
            <button
              type="button"
              className="ghost settings-button-compact"
              onClick={() => {
                void handleCopy(WECHAT_BRIDGE_TEST_MESSAGE);
              }}
            >
              {t("settings.wechatBridgeCopyTestMessage")}
            </button>
          </div>
        </div>
      ) : null}

      {diagnostics ? (
        <div className="wechat-bridge-diagnostics">
          {diagnostics.checks.map((check: WeChatBridgeDiagnosticCheck) => (
            <div className="wechat-bridge-diagnostic-row" key={check.key}>
              <span
                className={`wechat-bridge-diagnostic-dot is-${diagnosticStateTone(check.state)}`}
                aria-hidden
              />
              <div className="wechat-bridge-diagnostic-main">
                <div className="wechat-bridge-diagnostic-title">
                  {t(DIAGNOSTIC_LABEL_KEYS[check.key] ?? check.key)}
                </div>
                {check.detail ? (
                  <div className="wechat-bridge-diagnostic-detail">
                    {check.detail}
                  </div>
                ) : null}
              </div>
              <div className="wechat-bridge-diagnostic-state">
                {diagnosticStateLabel(t, check.state)}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {copied ? <div className="settings-help">{copied}</div> : null}
      {error ? (
        <div className="settings-error" role="alert">
          {error}
        </div>
      ) : null}
    </div>
  );
}
