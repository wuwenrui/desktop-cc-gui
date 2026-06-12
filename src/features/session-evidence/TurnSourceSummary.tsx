import "./turn-source-summary.css";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { openInspectorTab } from "./inspectorBus";
import {
  deriveTurnSourceSummary,
  fileBasename,
  hasSourceSignal,
} from "./turnEvidence";

/**
 * AI 回复来源摘要块：assistant 气泡尾部的「引用文件 / 改动热区」卡片。
 * 纯推导展示（deriveTurnSourceSummary），无信号不渲染（不打扰原则）；
 * 点击卡片通过 inspectorBus 联动右栏对应 tab。
 *
 * 视觉对照 docs/2026-06-12-fanbox-cockpit-redesign/方案原型.html
 * 的 .source-grid / .source-card。
 *
 * OpenSpec change: add-fanbox-dialogue-cockpit（Decision 1/2）。新增文件（fork-friendly）。
 */

/** 引用卡正文里最多预览的文件名个数，其余进 title 全列表。 */
const MAX_CITED_PREVIEW = 3;

export function TurnSourceSummary({ text }: { text: string }) {
  const { t } = useTranslation();
  const summary = useMemo(() => deriveTurnSourceSummary(text), [text]);

  if (!hasSourceSignal(summary)) {
    return null;
  }

  const citedPreview = summary.citedFiles
    .slice(0, MAX_CITED_PREVIEW)
    .map(fileBasename)
    .join("、");
  const topChanged = summary.changedFiles[0] ?? null;

  return (
    <div className="turn-source-grid">
      {summary.citedFiles.length > 0 && (
        <button
          type="button"
          className="turn-source-card is-ref"
          title={summary.citedFiles.join("\n")}
          onClick={() => openInspectorTab("evidence")}
        >
          <span className="turn-source-card-head">{t("fanbox.summary.cited")}</span>
          <span className="turn-source-card-main">
            {t("fanbox.summary.citedCount", { count: summary.citedFiles.length })}
          </span>
          <span className="turn-source-card-sub">{citedPreview}</span>
          <span className="turn-source-card-go" aria-hidden>
            {t("fanbox.summary.view")} →
          </span>
        </button>
      )}
      {topChanged && (
        <button
          type="button"
          className="turn-source-card is-hot"
          title={summary.changedFiles
            .map((file) => `${file.path} ×${file.edits}`)
            .join("\n")}
          onClick={() => openInspectorTab("changes")}
        >
          <span className="turn-source-card-head">{t("fanbox.summary.changed")}</span>
          <span className="turn-source-card-main">
            {t("fanbox.summary.changedCount", { count: summary.totalEdits })}
          </span>
          <span className="turn-source-card-sub">{fileBasename(topChanged.path)}</span>
          <span className="turn-source-card-go" aria-hidden>
            {t("fanbox.summary.view")} →
          </span>
        </button>
      )}
    </div>
  );
}
