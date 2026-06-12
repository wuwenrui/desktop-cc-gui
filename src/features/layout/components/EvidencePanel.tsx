/**
 * FanBox 右栏「证据」面板：本会话聚合出的引用来源（AI Read +
 * 用户 @文件引用）与改动热区（edits）只读视图。
 *
 * 数据全部来自 deriveSessionEvidence 纯函数推导，无运行时信号时渲染空态，
 * 不编造事实。
 *
 * OpenSpec change: add-fanbox-dialogue-cockpit（Decision 3）。新增文件（fork-friendly）。
 */

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  deriveSessionEvidence,
  fileBasename,
  pickEvidenceMessages,
} from "../../session-evidence/turnEvidence";
import "../../../styles/fanbox-inspector.css";

type EvidencePanelProps = {
  /** 当前会话消息条目（ConversationItem 联合类型，组件内窄化）。 */
  items: ReadonlyArray<unknown>;
};

export function EvidencePanel({ items }: EvidencePanelProps) {
  const { t } = useTranslation();
  const activity = useMemo(
    () => deriveSessionEvidence(pickEvidenceMessages(items)),
    [items],
  );
  const citedFiles = activity.filter((file) => file.reads > 0);
  const changedFiles = activity.filter((file) => file.edits > 0);

  return (
    <div className="fanbox-evidence-panel">
      <div className="fanbox-panel-title">{t("fanbox.evidence.title")}</div>
      {activity.length === 0 ? (
        <p className="fanbox-panel-empty">{t("fanbox.evidence.empty")}</p>
      ) : (
        <>
          {citedFiles.length > 0 && (
            <section className="fanbox-e-card is-ref">
              <strong>{t("fanbox.evidence.citedTitle")}</strong>
              <ul className="fanbox-e-list">
                {citedFiles.map((file) => (
                  <li key={file.path} title={file.path}>
                    <span className="fanbox-e-file">{fileBasename(file.path)}</span>
                    <span className="fanbox-e-count">
                      {file.reads} {t("fanbox.evidence.readsLabel")}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {changedFiles.length > 0 && (
            <section className="fanbox-e-card is-hot">
              <strong>{t("fanbox.evidence.hotTitle")}</strong>
              <ul className="fanbox-e-list">
                {changedFiles.map((file) => (
                  <li key={file.path} title={file.path}>
                    <span className="fanbox-e-file">{fileBasename(file.path)}</span>
                    <span className="fanbox-e-count">
                      {file.edits} {t("fanbox.evidence.editsLabel")}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
