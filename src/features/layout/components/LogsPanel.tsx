/**
 * FanBox 右栏「日志」面板外壳：顶部终端降级说明卡 +「展开终端」入口，
 * 下方嵌入现有 activity 面板内容（children，由组装点穿入，内容本身不改）。
 *
 * 终端从主交互降级为排障入口（spec: terminal is demoted, not removed）。
 *
 * OpenSpec change: add-fanbox-dialogue-cockpit（Decision 3）。新增文件（fork-friendly）。
 */

import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import "../../../styles/fanbox-inspector.css";

type LogsPanelProps = {
  /** 复用现有终端开关（buildTerminalDockNode 的 onToggleTerminal）。 */
  onToggleTerminal: () => void;
  /** 现有 activity 面板内容节点。 */
  children: ReactNode;
};

export function LogsPanel({ onToggleTerminal, children }: LogsPanelProps) {
  const { t } = useTranslation();
  return (
    <div className="fanbox-logs-panel">
      <div className="fanbox-logs-note">
        <p>{t("fanbox.logs.terminalNote")}</p>
        <button
          type="button"
          className="fanbox-logs-open-terminal"
          onClick={onToggleTerminal}
        >
          {t("fanbox.logs.openTerminal")}
        </button>
      </div>
      <div className="fanbox-logs-body">{children}</div>
    </div>
  );
}
