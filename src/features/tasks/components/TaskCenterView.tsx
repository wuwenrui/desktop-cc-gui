import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TaskRunRecord, TaskRunStatus } from "../types";
import {
  OPEN_TASK_RUN_EVENT,
  dispatchOpenOrchestrationTaskEvent,
  readOpenTaskRunEvent,
} from "../../agent-orchestration/utils/navigationEvents";
import { hasActiveRunConflict } from "../utils/taskRunProjection";
import {
  compareTaskRunSurfacePriority,
  describeTaskRunSurface,
} from "../utils/taskRunSurface";

type TaskCenterViewProps = {
  runs: TaskRunRecord[];
  workspaceId?: string | null;
  onOpenConversation?: (threadId: string) => void;
  onRetryRun?: (run: TaskRunRecord) => void;
  onResumeRun?: (run: TaskRunRecord) => void;
  onCancelRun?: (run: TaskRunRecord) => void;
  onForkRun?: (run: TaskRunRecord) => void;
  onOpenOrchestrationTask?: (taskId: string) => void;
};

const STATUS_ORDER: TaskRunStatus[] = [
  "queued",
  "planning",
  "running",
  "waiting_input",
  "blocked",
  "failed",
  "completed",
  "canceled",
];

function formatRunTime(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "";
  }
  return new Date(value).toLocaleString();
}

export function TaskCenterView({
  runs,
  workspaceId = null,
  onOpenConversation,
  onRetryRun,
  onResumeRun,
  onCancelRun,
  onForkRun,
  onOpenOrchestrationTask,
}: TaskCenterViewProps) {
  const { t } = useTranslation();
  const [statusFilter, setStatusFilter] = useState<TaskRunStatus | "all">("all");
  const [engineFilter, setEngineFilter] = useState<TaskRunRecord["engine"] | "all">("all");
  const [openedFromRunLink, setOpenedFromRunLink] = useState(false);
  const workspaceRuns = useMemo(
    () =>
      runs
        .filter((run) => !workspaceId || run.task.workspaceId === workspaceId)
        .sort(compareTaskRunSurfacePriority),
    [runs, workspaceId],
  );
  const filteredRuns = workspaceRuns.filter(
    (run) =>
      (statusFilter === "all" || run.status === statusFilter) &&
      (engineFilter === "all" || run.engine === engineFilter),
  );
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const selectedRun =
    filteredRuns.find((run) => run.runId === selectedRunId) ?? filteredRuns[0] ?? null;
  useEffect(() => {
    const handleOpenTaskRun = (event: Event) => {
      const runId = readOpenTaskRunEvent(event);
      if (!runId || !workspaceRuns.some((run) => run.runId === runId)) {
        return;
      }
      setSelectedRunId(runId);
      setOpenedFromRunLink(true);
    };

    window.addEventListener(OPEN_TASK_RUN_EVENT, handleOpenTaskRun);
    return () => {
      window.removeEventListener(OPEN_TASK_RUN_EVENT, handleOpenTaskRun);
    };
  }, [workspaceRuns]);
  const hasDuplicateConflict = selectedRun
    ? hasActiveRunConflict(workspaceRuns, selectedRun.task.taskId, selectedRun.runId)
    : false;
  const availableActions = new Set(selectedRun?.availableRecoveryActions ?? []);
  const canOpenConversation = Boolean(selectedRun?.linkedThreadId && onOpenConversation);
  const canRetry =
    Boolean(selectedRun && onRetryRun && availableActions.has("retry")) && !hasDuplicateConflict;
  const canResume = Boolean(selectedRun && onResumeRun && availableActions.has("resume"));
  const canCancel = Boolean(selectedRun && onCancelRun && availableActions.has("cancel"));
  const canFork =
    Boolean(selectedRun && onForkRun && availableActions.has("fork_new_run")) && !hasDuplicateConflict;
  const orchestrationTaskId =
    selectedRun?.task.source === "orchestration"
      ? selectedRun.task.orchestrationTaskId ?? selectedRun.task.taskId
      : null;
  const canOpenOrchestrationTask = Boolean(orchestrationTaskId);
  const selectedRunSurface = selectedRun ? describeTaskRunSurface(selectedRun) : null;
  const highlightedRuns = filteredRuns.filter((run) => describeTaskRunSurface(run).needsAttention).length;

  return (
    <section className="task-center" aria-label={t("taskCenter.title")}>
      <header className="task-center__header">
        <div>
          <p className="task-center__eyebrow">{t("taskCenter.eyebrow")}</p>
          <h2>{t("taskCenter.title")}</h2>
          <p className="task-center__summary">
            {t("taskCenter.summary", {
              total: filteredRuns.length,
              attention: highlightedRuns,
            })}
          </p>
        </div>
        <div className="task-center__filters">
          <label>
            {t("taskCenter.statusFilter")}
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as TaskRunStatus | "all")}
            >
              <option value="all">{t("taskCenter.filterAll")}</option>
              {STATUS_ORDER.map((status) => (
                <option key={status} value={status}>
                  {t(`taskCenter.status.${status}`)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("taskCenter.engineFilter")}
            <select
              value={engineFilter}
              onChange={(event) =>
                setEngineFilter(event.target.value as TaskRunRecord["engine"] | "all")
              }
            >
              <option value="all">{t("taskCenter.filterAll")}</option>
              <option value="codex">Codex</option>
              <option value="claude">Claude Code</option>
              <option value="gemini">Gemini</option>
            </select>
          </label>
        </div>
      </header>

      {openedFromRunLink && selectedRun ? (
        <p className="task-center__context-banner" role="status">
          {t("taskCenter.openedFromProjectMap")}
        </p>
      ) : null}

      <div className="task-center__body">
        <div className="task-center__list">
          {filteredRuns.length === 0 ? (
            <p className="task-center__empty">{t("taskCenter.empty")}</p>
          ) : (
            filteredRuns.map((run) => (
              (() => {
                const surface = describeTaskRunSurface(run);
                const runSummary = surface.summary || t("taskCenter.unavailable");
                return (
                  <button
                    key={run.runId}
                    type="button"
                    className={`task-center__run task-center__run--${surface.severity} ${selectedRun?.runId === run.runId ? "is-selected" : ""}`}
                    onClick={() => {
                      setSelectedRunId(run.runId);
                      setOpenedFromRunLink(false);
                    }}
                  >
                    <span className="task-center__run-topline">
                      <span className="task-center__run-title">{run.task.title || run.task.taskId}</span>
                      <span className={`task-center__badge task-center__badge--${surface.severity}`}>
                        {t(`taskCenter.status.${run.status}`)}
                      </span>
                    </span>
                    <span className="task-center__run-meta">
                      {run.engine} · {formatRunTime(run.updatedAt)}
                    </span>
                    <span className="task-center__run-summary">{runSummary}</span>
                    <span className="task-center__run-hint">{t(surface.hintKey)}</span>
                  </button>
                );
              })()
            ))
          )}
        </div>

        {selectedRun ? (
          <article className={`task-center__detail task-center__detail--${selectedRunSurface?.severity ?? "muted"}`}>
            <div className="task-center__detail-head">
              <div>
                <p className="task-center__eyebrow">{selectedRun.runId}</p>
                <h3>{selectedRun.task.title || selectedRun.task.taskId}</h3>
                <p className="task-center__detail-hint">
                  {selectedRunSurface ? t(selectedRunSurface.hintKey) : null}
                </p>
              </div>
              <span className={`task-center__badge task-center__badge--${selectedRunSurface?.severity ?? "muted"}`}>
                {t(`taskCenter.status.${selectedRun.status}`)}
              </span>
            </div>
            <dl className="task-center__facts">
              <div>
                <dt>{t("taskCenter.trigger")}</dt>
                <dd>{selectedRun.trigger}</dd>
              </div>
              <div>
                <dt>{t("taskCenter.updatedAt")}</dt>
                <dd>{formatRunTime(selectedRun.updatedAt)}</dd>
              </div>
              <div>
                <dt>{t("taskCenter.currentStep")}</dt>
                <dd>{selectedRun.currentStep || t("taskCenter.unavailable")}</dd>
              </div>
              <div>
                <dt>{t("taskCenter.latestOutput")}</dt>
                <dd>{selectedRun.latestOutputSummary || t("taskCenter.unavailable")}</dd>
              </div>
              <div>
                <dt>{t("taskCenter.diagnostics")}</dt>
                <dd>
                  {selectedRun.blockedReason ||
                    selectedRun.failureReason ||
                    t("taskCenter.unavailable")}
                </dd>
              </div>
              <div>
                <dt>{t("taskCenter.artifacts")}</dt>
                <dd>
                  {selectedRun.artifacts.length > 0
                    ? selectedRun.artifacts.map((artifact) => artifact.label).join(", ")
                    : t("taskCenter.noArtifacts")}
                </dd>
              </div>
              <div>
                <dt>{t("taskCenter.browserEvidence")}</dt>
                <dd>
                  {selectedRun.browserEvidence ? (
                    <span title={selectedRun.browserEvidence.url}>
                      {selectedRun.browserEvidence.title || selectedRun.browserEvidence.url}
                      {" · "}
                      {t(`taskCenter.browserEvidenceState.${selectedRun.browserEvidence.state}`)}
                      {selectedRun.browserEvidence.codeCandidates?.length
                        ? ` · ${selectedRun.browserEvidence.codeCandidates.length} candidates`
                        : ""}
                      {selectedRun.browserEvidence.diagnostics?.length
                        ? ` · ${selectedRun.browserEvidence.diagnostics[0]}`
                        : ""}
                    </span>
                  ) : (
                    t("taskCenter.noBrowserEvidence")
                  )}
                </dd>
              </div>
            </dl>
            <div className="task-center__actions">
              {canOpenConversation ? (
                <button
                  type="button"
                  onClick={() => {
                    if (selectedRun.linkedThreadId) {
                      onOpenConversation?.(selectedRun.linkedThreadId);
                    }
                  }}
                >
                  {t("taskCenter.action.openConversation")}
                </button>
              ) : null}
              {canOpenOrchestrationTask ? (
                <button
                  type="button"
                  onClick={() => {
                    if (!orchestrationTaskId) {
                      return;
                    }
                    if (onOpenOrchestrationTask) {
                      onOpenOrchestrationTask(orchestrationTaskId);
                      return;
                    }
                    dispatchOpenOrchestrationTaskEvent(orchestrationTaskId);
                  }}
                >
                  {t("taskCenter.action.openOrchestrationTask")}
                </button>
              ) : null}
              {canRetry ? (
                <button type="button" onClick={() => onRetryRun?.(selectedRun)}>
                  {t("taskCenter.action.retry")}
                </button>
              ) : null}
              {canResume ? (
                <button type="button" onClick={() => onResumeRun?.(selectedRun)}>
                  {t("taskCenter.action.resume")}
                </button>
              ) : null}
              {canCancel ? (
                <button type="button" onClick={() => onCancelRun?.(selectedRun)}>
                  {t("taskCenter.action.cancel")}
                </button>
              ) : null}
              {canFork ? (
                <button type="button" onClick={() => onForkRun?.(selectedRun)}>
                  {t("taskCenter.action.fork")}
                </button>
              ) : null}
            </div>
          </article>
        ) : null}
      </div>
    </section>
  );
}
