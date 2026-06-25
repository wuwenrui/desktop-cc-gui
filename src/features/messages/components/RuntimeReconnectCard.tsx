import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import GitFork from "lucide-react/dist/esm/icons/git-fork";
import Terminal from "lucide-react/dist/esm/icons/terminal";
import { Button } from "../../../components/ui/button";
import { ensureRuntimeReady } from "../../../services/tauri";
import type { QueuedMessage } from "../../../types";
import {
  normalizeRuntimeReconnectRecoveryResult,
  normalizeRuntimeReconnectErrorMessage,
  type RuntimeReconnectRecoveryCallbackResult,
  type RuntimeReconnectHint,
} from "./runtimeReconnect";

type RuntimeReconnectCardProps = {
  hint: RuntimeReconnectHint;
  workspaceId?: string | null;
  threadId?: string | null;
  onRecoverThreadRuntime?: (
    workspaceId: string,
    threadId: string,
  ) => Promise<RuntimeReconnectRecoveryCallbackResult> | RuntimeReconnectRecoveryCallbackResult;
  retryMessage?: Pick<QueuedMessage, "text" | "images"> | null;
  onRecoverThreadRuntimeAndResend?: (
    workspaceId: string,
    threadId: string,
    message: Pick<QueuedMessage, "text" | "images">,
  ) => Promise<RuntimeReconnectRecoveryCallbackResult> | RuntimeReconnectRecoveryCallbackResult;
  onThreadRecoveryFork?: () => Promise<void> | void;
};

export function RuntimeReconnectCard({
  hint,
  workspaceId = null,
  threadId = null,
  onRecoverThreadRuntime,
  retryMessage = null,
  onRecoverThreadRuntimeAndResend,
  onThreadRecoveryFork,
}: RuntimeReconnectCardProps) {
  const { t } = useTranslation();
  const [isReconnectRunning, setIsReconnectRunning] = useState(false);
  const [reconnectStatus, setReconnectStatus] = useState<
    "idle" | "error" | "restored" | "forked" | "fresh"
  >("idle");
  const [lastAction, setLastAction] = useState<"reconnect" | "resend">("reconnect");
  const [reconnectErrorDetail, setReconnectErrorDetail] = useState<string | null>(null);
  const requiresThreadRecovery =
    hint.reason === "thread-not-found" || hint.reason === "session-not-found";
  const retryMessageUnavailable =
    !retryMessage ||
    (!retryMessage.text.trim() && (retryMessage.images?.length ?? 0) === 0);
  const reconnectUnavailable = requiresThreadRecovery
    ? !workspaceId || !threadId || !onRecoverThreadRuntime
    : !workspaceId;
  const resendUnavailable = requiresThreadRecovery
    ? !onThreadRecoveryFork
    : reconnectUnavailable ||
      retryMessageUnavailable ||
      !threadId ||
      !onRecoverThreadRuntimeAndResend;
  const retryMessageSignature = retryMessage
    ? JSON.stringify([retryMessage.text, retryMessage.images ?? []])
    : "none";
  const isTransientCleanup = hint.tone === "transient";

  useEffect(() => {
    setIsReconnectRunning(false);
    setReconnectStatus("idle");
    setLastAction("reconnect");
    setReconnectErrorDetail(null);
  }, [hint.rawMessage, retryMessageSignature, threadId, workspaceId]);

  const handleReconnectRuntime = useCallback(async (mode: "reconnect" | "resend") => {
    if (isReconnectRunning) {
      return;
    }
    const activeWorkspaceId = workspaceId;
    const activeThreadId = threadId;
    if (!activeWorkspaceId && !(mode === "resend" && requiresThreadRecovery)) {
      return;
    }
    if (mode === "resend" && requiresThreadRecovery) {
      if (!onThreadRecoveryFork || resendUnavailable) {
        return;
      }
      setIsReconnectRunning(true);
      setReconnectStatus("idle");
      setLastAction(mode);
      setReconnectErrorDetail(null);
      try {
        await onThreadRecoveryFork();
      } catch (error) {
        setReconnectStatus("error");
        setReconnectErrorDetail(normalizeRuntimeReconnectErrorMessage(error));
      } finally {
        setIsReconnectRunning(false);
      }
      return;
    }
    if (mode === "resend" && (resendUnavailable || !retryMessage || !threadId)) {
      return;
    }
    if (!activeWorkspaceId) {
      return;
    }
    setIsReconnectRunning(true);
    setReconnectStatus("idle");
    setLastAction(mode);
    setReconnectErrorDetail(null);
    try {
      if (requiresThreadRecovery) {
        if (!activeThreadId) {
          setReconnectStatus("error");
          setReconnectErrorDetail(
            t("messages.threadRecoveryUnavailable"),
          );
          return;
        }
        await ensureRuntimeReady(activeWorkspaceId);
        if (mode === "resend") {
          if (!onRecoverThreadRuntimeAndResend || !retryMessage) {
            setReconnectStatus("error");
            setReconnectErrorDetail(t("messages.threadRecoveryResendUnavailable"));
            return;
          }
          const resentThreadId = await onRecoverThreadRuntimeAndResend(
            activeWorkspaceId,
            activeThreadId,
            retryMessage,
          );
          const resentResult = normalizeRuntimeReconnectRecoveryResult(resentThreadId);
          if (resentResult.kind === "failed") {
            setReconnectStatus("error");
            setReconnectErrorDetail(t("messages.threadRecoveryRecoverFailed"));
            return;
          }
          if (resentResult.kind === "forked") {
            setReconnectStatus("forked");
            setReconnectErrorDetail(t("messages.threadRecoveryForkedResent"));
            return;
          }
          if (resentResult.kind === "fresh") {
            setReconnectStatus("fresh");
            setReconnectErrorDetail(t("messages.threadRecoveryFreshResent"));
            return;
          }
          setReconnectStatus("restored");
          setReconnectErrorDetail(t("messages.threadRecoveryRestoredAndResent"));
          return;
        }
        if (!onRecoverThreadRuntime) {
          setReconnectStatus("error");
          setReconnectErrorDetail(
            t("messages.threadRecoveryUnavailable"),
          );
          return;
        }
        const recoveredThreadId = await onRecoverThreadRuntime(activeWorkspaceId, activeThreadId);
        const recoveredResult = normalizeRuntimeReconnectRecoveryResult(recoveredThreadId);
        if (recoveredResult.kind === "failed") {
          setReconnectStatus("error");
          setReconnectErrorDetail(t("messages.threadRecoveryRecoverFailed"));
          return;
        }
        if (recoveredResult.kind === "forked") {
          setReconnectStatus("forked");
          setReconnectErrorDetail(t("messages.threadRecoveryForkedFallbackRequired"));
          return;
        }
        if (recoveredResult.kind === "fresh") {
          setReconnectStatus("fresh");
          setReconnectErrorDetail(t("messages.threadRecoveryFreshFallbackRequired"));
          return;
        }
        setReconnectStatus("restored");
        setReconnectErrorDetail(t("messages.threadRecoveryRestoredDetail"));
        return;
      }
      await ensureRuntimeReady(activeWorkspaceId);
      if (mode === "resend") {
        if (!activeThreadId || !retryMessage || !onRecoverThreadRuntimeAndResend) {
          setReconnectStatus("error");
          setReconnectErrorDetail(t("messages.runtimeReconnectResendUnavailable"));
          return;
        }
        const resentThreadId = await onRecoverThreadRuntimeAndResend(
          activeWorkspaceId,
          activeThreadId,
          retryMessage,
        );
        const resentResult = normalizeRuntimeReconnectRecoveryResult(resentThreadId);
        if (resentResult.kind === "failed") {
          setReconnectStatus("error");
          setReconnectErrorDetail(t("messages.runtimeReconnectRecoverFailed"));
          return;
        }
        if (resentResult.kind === "forked") {
          setReconnectStatus("forked");
          setReconnectErrorDetail(t("messages.threadRecoveryForkedResent"));
          return;
        }
        if (resentResult.kind === "fresh") {
          setReconnectStatus("fresh");
          setReconnectErrorDetail(t("messages.runtimeReconnectFreshResent"));
          return;
        }
        setReconnectStatus("restored");
        setReconnectErrorDetail(t("messages.runtimeReconnectRestoredAndResent"));
        return;
      }
      if (activeThreadId && onRecoverThreadRuntime) {
        const recoveredThreadId = await onRecoverThreadRuntime(activeWorkspaceId, activeThreadId);
        const recoveredResult = normalizeRuntimeReconnectRecoveryResult(recoveredThreadId);
        if (recoveredResult.kind === "failed") {
          setReconnectStatus("error");
          setReconnectErrorDetail(t("messages.runtimeReconnectRecoverFailed"));
          return;
        }
        if (recoveredResult.kind === "forked") {
          setReconnectStatus("forked");
          setReconnectErrorDetail(t("messages.threadRecoveryForkedFallbackRequired"));
          return;
        }
        if (recoveredResult.kind === "fresh") {
          setReconnectStatus("fresh");
          setReconnectErrorDetail(t("messages.runtimeReconnectFreshContinuation"));
          return;
        }
      }
      setReconnectStatus("restored");
      setReconnectErrorDetail(t("messages.runtimeReconnectRestoredDetail"));
    } catch (error) {
      setReconnectStatus("error");
      setReconnectErrorDetail(normalizeRuntimeReconnectErrorMessage(error));
    } finally {
      setIsReconnectRunning(false);
    }
  }, [
    isReconnectRunning,
    onRecoverThreadRuntime,
    onRecoverThreadRuntimeAndResend,
    onThreadRecoveryFork,
    requiresThreadRecovery,
    resendUnavailable,
    retryMessage,
    t,
    threadId,
    workspaceId,
  ]);

  const description = requiresThreadRecovery
    ? t("messages.threadRecoveryThreadNotFound")
    : isTransientCleanup
      ? t("messages.runtimeReconnectTransientCleanup")
    : hint.reason === "recovery-quarantined"
      ? t("messages.runtimeReconnectQuarantined")
    : hint.reason === "runtime-ended"
      ? t("messages.runtimeReconnectEnded")
    : hint.reason === "broken-pipe"
      ? t("messages.runtimeReconnectBrokenPipe")
    : hint.reason === "stopping-runtime-race"
      ? t("messages.runtimeReconnectStoppingRace")
      : t("messages.runtimeReconnectWorkspaceNotConnected");
  const title = requiresThreadRecovery
    ? t("messages.threadRecoveryTitle")
    : isTransientCleanup
      ? t("messages.runtimeReconnectTransientTitle")
      : t("messages.runtimeReconnectTitle");
  const recoveryRecommendation = requiresThreadRecovery
    ? t("messages.threadRecoveryRecommendation")
    : null;
  const recoveryDetailLabel = requiresThreadRecovery
    ? t("messages.threadRecoveryDetailLabel")
    : null;
  const reconnectActionLabel = isReconnectRunning && lastAction === "reconnect"
    ? requiresThreadRecovery
      ? t("messages.threadRecoveryRunning")
      : t("messages.runtimeReconnectRunning")
    : requiresThreadRecovery
      ? t("messages.threadRecoveryAction")
      : t("messages.runtimeReconnectAction");
  const resendActionLabel = isReconnectRunning && lastAction === "resend"
    ? requiresThreadRecovery
      ? t("messages.threadRecoveryResendRunning")
      : t("messages.runtimeReconnectResendRunning")
    : requiresThreadRecovery
      ? t("messages.threadRecoveryForkAction")
      : t("messages.runtimeReconnectResendAction");
  const showReconnectAction =
    !requiresThreadRecovery || (Boolean(onRecoverThreadRuntime) && resendUnavailable);
  const showReconnectUnavailable = showReconnectAction && reconnectUnavailable;
  const unavailableLabel = requiresThreadRecovery
    ? t("messages.threadRecoveryUnavailable")
    : t("messages.runtimeReconnectUnavailable");
  const failedLabel = requiresThreadRecovery
    ? t("messages.threadRecoveryFailed")
    : t("messages.runtimeReconnectFailed");
  const showDiagnosticDetail = !isTransientCleanup;

  return (
    <div
      className={`message-runtime-recovery-card${isTransientCleanup ? " is-transient" : ""}`}
      role="group"
      aria-label={title}
    >
      <div className="message-runtime-recovery-header">
        <Terminal className="message-runtime-recovery-icon" size={15} aria-hidden />
        <div className="message-runtime-recovery-copy">
          <div className="message-runtime-recovery-title">{title}</div>
          <div className="message-runtime-recovery-description">{description}</div>
        </div>
        <div className="message-runtime-recovery-actions">
          {showReconnectAction ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="message-runtime-recovery-button"
              onClick={() => {
                void handleReconnectRuntime("reconnect");
              }}
              disabled={reconnectUnavailable || isReconnectRunning}
            >
              {reconnectActionLabel}
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            className="message-runtime-recovery-button"
            onClick={() => {
              void handleReconnectRuntime("resend");
            }}
            disabled={resendUnavailable || isReconnectRunning}
          >
            {requiresThreadRecovery ? (
              <GitFork className="message-runtime-recovery-button-icon" size={14} aria-hidden />
            ) : null}
            {resendActionLabel}
          </Button>
        </div>
      </div>
      {recoveryRecommendation ? (
        <div className="message-runtime-recovery-recommendation">
          {recoveryRecommendation}
        </div>
      ) : null}
      {showDiagnosticDetail ? (
        <div className="message-runtime-recovery-detail">
          {recoveryDetailLabel ? (
            <span className="message-runtime-recovery-detail-label">
              {recoveryDetailLabel}
            </span>
          ) : null}
          <span>{hint.rawMessage}</span>
        </div>
      ) : null}
      {showReconnectUnavailable ? (
        <div className="message-runtime-recovery-status is-error" aria-live="polite">
          {unavailableLabel}
        </div>
      ) : null}
      {!reconnectUnavailable && resendUnavailable ? (
        <div className="message-runtime-recovery-detail" aria-live="polite">
          {requiresThreadRecovery
            ? t("messages.threadRecoveryResendUnavailable")
            : t("messages.runtimeReconnectResendUnavailable")}
        </div>
      ) : null}
      {reconnectStatus === "error" ? (
        <>
          <div className="message-runtime-recovery-status is-error" aria-live="polite">{failedLabel}</div>
          {reconnectErrorDetail ? (
            <div className="message-runtime-recovery-detail">{reconnectErrorDetail}</div>
          ) : null}
        </>
      ) : null}
      {reconnectStatus === "restored" && reconnectErrorDetail ? (
        <>
          <div className="message-runtime-recovery-status is-success" aria-live="polite">
            {requiresThreadRecovery
              ? t("messages.threadRecoveryRestored")
              : t("messages.runtimeReconnectRestored")}
          </div>
          <div className="message-runtime-recovery-detail">{reconnectErrorDetail}</div>
        </>
      ) : null}
      {reconnectStatus === "fresh" && reconnectErrorDetail ? (
        <div className="message-runtime-recovery-detail" aria-live="polite">
          {reconnectErrorDetail}
        </div>
      ) : null}
      {reconnectStatus === "forked" && reconnectErrorDetail ? (
        <div className="message-runtime-recovery-detail" aria-live="polite">
          {reconnectErrorDetail}
        </div>
      ) : null}
    </div>
  );
}
