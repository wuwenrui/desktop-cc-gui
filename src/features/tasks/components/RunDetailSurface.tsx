import { useTranslation } from "react-i18next";
import type { TaskRunRecord } from "../types";
import { hasActiveRunConflict } from "../utils/taskRunProjection";
import { describeTaskRunSurface } from "../utils/taskRunSurface";

type RunDetailSurfaceProps = {
  run: TaskRunRecord;
  comparisonRuns?: TaskRunRecord[];
  className?: string;
  onOpenConversation?: (threadId: string) => void;
  onOpenOrchestrationTask?: (taskId: string) => void;
  onRetryRun?: (run: TaskRunRecord) => void;
  onResumeRun?: (run: TaskRunRecord) => void;
  onCancelRun?: (run: TaskRunRecord) => void;
  onForkRun?: (run: TaskRunRecord) => void;
};

export function formatTaskRunTime(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "";
  }
  return new Date(value).toLocaleString();
}

export function RunDetailSurface({
  run,
  comparisonRuns = [],
  className = "",
  onOpenConversation,
  onOpenOrchestrationTask,
  onRetryRun,
  onResumeRun,
  onCancelRun,
  onForkRun,
}: RunDetailSurfaceProps) {
  const { t } = useTranslation();
  const surface = describeTaskRunSurface(run);
  const availableActions = new Set(run.availableRecoveryActions);
  const hasDuplicateConflict = hasActiveRunConflict(comparisonRuns, run.task.taskId, run.runId);
  const canOpenConversation = Boolean(run.linkedThreadId && onOpenConversation);
  const canRetry = Boolean(onRetryRun && availableActions.has("retry")) && !hasDuplicateConflict;
  const canResume = Boolean(onResumeRun && availableActions.has("resume"));
  const canCancel = Boolean(onCancelRun && availableActions.has("cancel"));
  const canFork = Boolean(onForkRun && availableActions.has("fork_new_run")) && !hasDuplicateConflict;
  const orchestrationTaskId =
    run.task.source === "orchestration"
      ? run.task.orchestrationTaskId ?? run.task.taskId
      : null;
  const canOpenOrchestrationTask = Boolean(orchestrationTaskId && onOpenOrchestrationTask);
  const detailClassName = [
    "task-center__detail",
    `task-center__detail--${surface.severity}`,
    className,
  ].filter(Boolean).join(" ");

  return (
    <article className={detailClassName}>
      <div className="task-center__detail-head">
        <div>
          <p className="task-center__eyebrow">{run.runId}</p>
          <h3>{run.task.title || run.task.taskId}</h3>
          <p className="task-center__detail-hint">{t(surface.hintKey)}</p>
        </div>
        <span className={`task-center__badge task-center__badge--${surface.severity}`}>
          {t(`taskCenter.status.${run.status}`, run.status)}
        </span>
      </div>
      <dl className="task-center__facts">
        <div>
          <dt>{t("taskCenter.trigger", "Trigger")}</dt>
          <dd>{run.trigger}</dd>
        </div>
        <div>
          <dt>{t("taskCenter.updatedAt", "Updated")}</dt>
          <dd>{formatTaskRunTime(run.updatedAt)}</dd>
        </div>
        <div>
          <dt>{t("taskCenter.currentStep", "Current step")}</dt>
          <dd>{run.currentStep || t("taskCenter.unavailable", "Unavailable")}</dd>
        </div>
        <div>
          <dt>{t("taskCenter.latestOutput", "Latest output")}</dt>
          <dd>{run.latestOutputSummary || t("taskCenter.unavailable", "Unavailable")}</dd>
        </div>
        <div>
          <dt>{t("taskCenter.diagnostics", "Diagnostics")}</dt>
          <dd>
            {run.blockedReason ||
              run.failureReason ||
              t("taskCenter.unavailable", "Unavailable")}
          </dd>
        </div>
        <div>
          <dt>{t("taskCenter.artifacts", "Artifacts")}</dt>
          <dd>
            {run.artifacts.length > 0
              ? run.artifacts.map((artifact) => artifact.label).join(", ")
              : t("taskCenter.noArtifacts", "No artifacts yet")}
          </dd>
        </div>
        <div>
          <dt>{t("taskCenter.browserEvidence", "Evidence")}</dt>
          <dd>
            {run.browserEvidence ? (
              <span title={run.browserEvidence.url}>
                {run.browserEvidence.title || run.browserEvidence.url}
                {" · "}
                {t(
                  `taskCenter.browserEvidenceState.${run.browserEvidence.state}`,
                  run.browserEvidence.state,
                )}
                {run.browserEvidence.codeCandidates?.length
                  ? ` · ${run.browserEvidence.codeCandidates.length} ${t("taskCenter.browserEvidenceCandidates", "candidates")}`
                  : ""}
                {run.browserEvidence.diagnostics?.length
                  ? ` · ${run.browserEvidence.diagnostics[0]}`
                  : ""}
              </span>
            ) : (
              t("taskCenter.noBrowserEvidence", "No linked evidence yet")
            )}
          </dd>
        </div>
      </dl>
      <div className="task-center__actions">
        {canOpenConversation ? (
          <button
            type="button"
            onClick={() => {
              if (run.linkedThreadId) {
                onOpenConversation?.(run.linkedThreadId);
              }
            }}
          >
            {t("taskCenter.action.openConversation", "Open conversation")}
          </button>
        ) : null}
        {canOpenOrchestrationTask ? (
          <button
            type="button"
            onClick={() => {
              if (orchestrationTaskId) {
                onOpenOrchestrationTask?.(orchestrationTaskId);
              }
            }}
          >
            {t("taskCenter.action.openOrchestrationTask", "Open source task")}
          </button>
        ) : null}
        {canRetry ? (
          <button type="button" onClick={() => onRetryRun?.(run)}>
            {t("taskCenter.action.retry", "Retry")}
          </button>
        ) : null}
        {canResume ? (
          <button type="button" onClick={() => onResumeRun?.(run)}>
            {t("taskCenter.action.resume", "Resume")}
          </button>
        ) : null}
        {canCancel ? (
          <button type="button" onClick={() => onCancelRun?.(run)}>
            {t("taskCenter.action.cancel", "Cancel")}
          </button>
        ) : null}
        {canFork ? (
          <button type="button" onClick={() => onForkRun?.(run)}>
            {t("taskCenter.action.fork", "Fork new run")}
          </button>
        ) : null}
      </div>
    </article>
  );
}
