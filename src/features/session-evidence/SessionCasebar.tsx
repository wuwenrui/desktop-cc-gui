import "./session-casebar.css";
import { useTranslation } from "react-i18next";
import { SessionWorkspaceTree } from "./SessionWorkspaceTree";
import {
  fileBasename,
  type SessionFileActivity,
  type TurnSourceSummary,
} from "./turnEvidence";

/**
 * 会话区 casebar：标题 + 对话/文件/证据三视图切换（FanBox Decision 4）。
 * 纯展示组件：视图态由挂载方持有（组件局部 state，不进全局 centerMode）。
 *
 * OpenSpec change: add-fanbox-dialogue-cockpit。新增文件（fork-friendly）。
 */

export type CasebarView = "chat" | "files" | "evidence";

export function SessionCasebar({
  title,
  view,
  onViewChange,
}: {
  title: string;
  view: CasebarView;
  onViewChange: (view: CasebarView) => void;
}) {
  const { t } = useTranslation();
  const views: Array<{ id: CasebarView; label: string }> = [
    { id: "chat", label: t("fanbox.casebar.viewChat") },
    { id: "files", label: t("fanbox.casebar.viewFiles") },
    { id: "evidence", label: t("fanbox.casebar.viewEvidence") },
  ];
  return (
    <div className="session-casebar">
      <div className="session-casebar-title" title={title}>
        {title}
      </div>
      <div className="session-casebar-switch" role="tablist" aria-label="会话视图">
        {views.map((v) => (
          <button
            key={v.id}
            type="button"
            role="tab"
            aria-selected={view === v.id}
            className={view === v.id ? "is-active" : ""}
            onClick={() => onViewChange(v.id)}
          >
            {v.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * 文件视图（双区）：
 * 上区 = 本会话文件活动卡（edits 降序，热度标记）；
 * 下区 = 完整工作区文件树（传入 workspaceFiles 时出现），树中同步热度标记。
 */
export function SessionFilesBoard({
  activities,
  workspaceFiles,
  workspaceDirectories,
  onOpenFile,
}: {
  activities: SessionFileActivity[];
  workspaceFiles?: string[];
  workspaceDirectories?: string[];
  onOpenFile?: (path: string) => void;
}) {
  const { t } = useTranslation();
  const showWorkspaceTree = workspaceFiles !== undefined;
  return (
    <div className="session-board">
      {showWorkspaceTree && (
        <div className="session-board-section">
          {t("fanbox.casebar.sessionSection")}
        </div>
      )}
      {activities.length === 0 ? (
        <p className="session-board-empty">{t("fanbox.casebar.filesEmpty")}</p>
      ) : (
        activities.map((file) => (
          <div className="session-file-card" key={file.path}>
            <i
              className={`session-file-mark${file.edits > 0 ? " is-hot" : ""}`}
              aria-hidden
            />
            <div className="session-file-main">
              <strong title={file.path}>{fileBasename(file.path)}</strong>
              <p>
                {file.reads > 0 && (
                  <span>
                    {file.reads} {t("fanbox.evidence.readsLabel")}
                  </span>
                )}
                {file.edits > 0 && (
                  <span className="is-hot">
                    {file.edits} {t("fanbox.evidence.editsLabel")}
                  </span>
                )}
              </p>
            </div>
            {file.edits > 0 && <b className="session-file-num">{file.edits}</b>}
          </div>
        ))
      )}
      {showWorkspaceTree && (
        <>
          <div className="session-board-section">
            {t("fanbox.casebar.workspaceSection")}
          </div>
          <SessionWorkspaceTree
            files={workspaceFiles}
            directories={workspaceDirectories ?? []}
            activities={activities}
            onOpenFile={onOpenFile}
          />
        </>
      )}
    </div>
  );
}

/** 证据视图：最近一次有信号的 AI 回复摘要。 */
export function SessionEvidenceBoard({
  latest,
}: {
  latest: TurnSourceSummary | null;
}) {
  const { t } = useTranslation();
  if (!latest) {
    return (
      <div className="session-board">
        <p className="session-board-empty">{t("fanbox.casebar.evidenceEmpty")}</p>
      </div>
    );
  }
  return (
    <div className="session-board">
      <div className="session-fact-card">
        <strong>{t("fanbox.casebar.latestReply")}</strong>
        {latest.citedFiles.length > 0 && (
          <p>
            {t("fanbox.summary.cited")}：
            {latest.citedFiles.map(fileBasename).join("、")}
          </p>
        )}
        {latest.changedFiles.length > 0 && (
          <p>
            {t("fanbox.summary.changed")}：
            {latest.changedFiles
              .map((f) => `${fileBasename(f.path)} ×${f.edits}`)
              .join("、")}
          </p>
        )}
      </div>
    </div>
  );
}
