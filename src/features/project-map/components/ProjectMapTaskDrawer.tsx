import { useTranslation } from "react-i18next";
import CircleX from "lucide-react/dist/esm/icons/circle-x";
import Trash2 from "lucide-react/dist/esm/icons/trash-2";
import X from "lucide-react/dist/esm/icons/x";

import { cn } from "../../../lib/utils";
import {
  formatProjectMapDateTime,
  getProjectMapRunActionLabel,
  getProjectMapRunTargetLabel,
  PROJECT_MAP_ACTIVE_RUN_STATUSES,
} from "../utils/display";
import type { ProjectMapNode, ProjectMapRunMetadata } from "../types";

export function ProjectMapGenerationTaskDrawer({
  activeRun,
  queuedRuns,
  recentRuns,
  nodeIndex,
  onCancelRun,
  onClearFinished,
  onClose,
}: {
  activeRun: ProjectMapRunMetadata | null;
  queuedRuns: ProjectMapRunMetadata[];
  recentRuns: ProjectMapRunMetadata[];
  nodeIndex: Map<string, ProjectMapNode>;
  onCancelRun: (runId: string) => Promise<void>;
  onClearFinished: () => Promise<void>;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const hasClearableRuns = recentRuns.length > 0;

  return (
    <aside
      className="project-map-task-drawer"
      role="dialog"
      aria-modal="false"
      aria-label={t("projectMap.tasks.drawerTitle")}
    >
      <header>
        <div>
          <span className="project-map-eyebrow">{t("projectMap.tasks.eyebrow")}</span>
          <h3>{t("projectMap.tasks.drawerTitle")}</h3>
        </div>
        <button type="button" onClick={onClose} aria-label={t("projectMap.tasks.close")}>
          <X aria-hidden />
        </button>
      </header>
      <section className="project-map-task-active-card">
        <h4>{t("projectMap.tasks.activeTitle")}</h4>
        {activeRun ? (
          <ProjectMapRunCard
            run={activeRun}
            badge={t("projectMap.tasks.activeBadge")}
            mode="active"
            nodeIndex={nodeIndex}
            onCancel={() => void onCancelRun(activeRun.id)}
          />
        ) : (
          <p>{t("projectMap.tasks.emptyActive")}</p>
        )}
      </section>
      <section>
        <h4>{t("projectMap.tasks.queueTitle", { count: queuedRuns.length })}</h4>
        {queuedRuns.length > 0 ? (
          <div className="project-map-task-list">
            {queuedRuns.map((run, index) => (
              <ProjectMapRunCard
                key={run.id}
                run={run}
                badge={t("projectMap.tasks.queueBadge", { index: index + 1 })}
                mode="queue"
                nodeIndex={nodeIndex}
                onCancel={() => void onCancelRun(run.id)}
              />
            ))}
          </div>
        ) : (
          <p>{t("projectMap.tasks.emptyQueue")}</p>
        )}
      </section>
      <section>
        <div className="project-map-task-section-heading">
          <h4>{t("projectMap.tasks.recentTitle")}</h4>
          {hasClearableRuns ? (
            <button
              className="project-map-task-clear"
              type="button"
              onClick={() => void onClearFinished()}
            >
              <Trash2 aria-hidden />
              {t("projectMap.tasks.clearDone")}
            </button>
          ) : null}
        </div>
        {recentRuns.length > 0 ? (
          <div className="project-map-task-list">
            {recentRuns.slice(0, 6).map((run) => (
              <ProjectMapRunCard
                key={`${run.id}-recent`}
                run={run}
                badge={t(`projectMap.tasks.status.${run.status}`)}
                mode="recent"
                nodeIndex={nodeIndex}
              />
            ))}
          </div>
        ) : (
          <p>{t("projectMap.tasks.emptyRecent")}</p>
        )}
      </section>
      <footer>
        <p>{t("projectMap.tasks.closeHint")}</p>
      </footer>
    </aside>
  );
}

function ProjectMapRunCard({
  run,
  badge,
  mode = "recent",
  nodeIndex,
  onCancel,
}: {
  run: ProjectMapRunMetadata;
  badge: string;
  mode?: "active" | "queue" | "recent";
  nodeIndex: Map<string, ProjectMapNode>;
  onCancel?: () => void;
}) {
  const { t } = useTranslation();
  const showProgress = mode === "active" && PROJECT_MAP_ACTIVE_RUN_STATUSES.has(run.status);
  const showCancelButton = Boolean(onCancel) && PROJECT_MAP_ACTIVE_RUN_STATUSES.has(run.status);
  const cancelTitle =
    mode === "active"
      ? t("projectMap.tasks.stop")
      : t("projectMap.tasks.cancel");
  const cancelAriaLabel =
    mode === "active"
      ? t("projectMap.tasks.stopRun", { runId: run.id })
      : t("projectMap.tasks.cancelRun", { runId: run.id });
  const phase = run.phase ?? (run.status === "running" ? "askingAi" : "queued");
  const progress = typeof run.progress === "number" ? run.progress : run.status === "running" ? 45 : 8;
  const latestLog = run.logs?.[run.logs.length - 1] ?? null;
  const actionLabel = getProjectMapRunActionLabel(t, run);
  const targetLabel = getProjectMapRunTargetLabel(t, run, nodeIndex);

  return (
    <article className={cn("project-map-task-card", `status-${run.status}`, `mode-${mode}`)}>
      <div className="project-map-task-card-head">
        <span>{badge}</span>
        <strong className="project-map-task-action">{actionLabel}</strong>
        <code className="project-map-task-run-id">{run.id}</code>
        {showCancelButton ? (
          <button
            className="project-map-task-cancel"
            type="button"
            onClick={onCancel}
            aria-label={cancelAriaLabel}
            title={cancelTitle}
          >
            <CircleX aria-hidden />
          </button>
        ) : null}
      </div>
      <div className="project-map-task-target">
        <span>{t("projectMap.tasks.target")}</span>
        <strong title={targetLabel}>{targetLabel}</strong>
      </div>
      {showProgress ? (
        <div className="project-map-task-progress" aria-label={t("projectMap.tasks.progressAria")}>
          <span style={{ width: `${Math.max(8, Math.min(100, progress))}%` }} />
        </div>
      ) : null}
      {mode === "active" ? (
        <p className="project-map-task-phase">
          {t(`projectMap.tasks.phase.${phase}`)}
        </p>
      ) : null}
      {latestLog ? (
        <p className="project-map-task-log">
          {formatProjectMapDateTime(latestLog.at)} · {latestLog.message}
        </p>
      ) : null}
      <dl>
        <div>
          <dt>{t("projectMap.tasks.engineModel")}</dt>
          <dd>{run.engine} / {run.model}</dd>
        </div>
        <div>
          <dt>{t("projectMap.confirmation.scope")}</dt>
          <dd>{run.scope}</dd>
        </div>
        {run.failureCategory ? (
          <div>
            <dt>{t("projectMap.tasks.failureCategory.label")}</dt>
            <dd>{t(`projectMap.tasks.failureCategory.${run.failureCategory}`)}</dd>
          </div>
        ) : null}
        <div>
          <dt>{t("projectMap.tasks.startedAt")}</dt>
          <dd>{formatProjectMapDateTime(run.startedAt)}</dd>
        </div>
        {run.threadId ? (
          <div>
            <dt>{t("projectMap.tasks.threadId")}</dt>
            <dd>{run.threadId}</dd>
          </div>
        ) : null}
      </dl>
      <code>{run.writePath ?? "-"}</code>
      {run.error ? <p className="project-map-task-error">{run.error}</p> : null}
      {run.organizerResult ? (
        <div className="project-map-task-organizer-result">
          <p>
            {t("projectMap.tasks.organizerSummary", {
              candidates: run.organizerResult.candidateCount,
              skipped: run.organizerResult.skippedCount,
              unsafe: run.organizerResult.unsafeCount,
            })}
          </p>
          {run.organizerResult.skips?.length ? (
            <div>
              <strong>{t("projectMap.tasks.organizerSkipped")}</strong>
              <ul>
                {run.organizerResult.skips.slice(0, 4).map((item) => (
                  <li key={`skip-${item.nodeId}`}>
                    {item.title}: {item.reason}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {run.organizerResult.unsafe?.length ? (
            <div>
              <strong>{t("projectMap.tasks.organizerUnsafe")}</strong>
              <ul>
                {run.organizerResult.unsafe.slice(0, 4).map((item) => (
                  <li key={`unsafe-${item.nodeId}`}>
                    {item.title}: {item.reason}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
