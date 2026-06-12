/**
 * FanBox 右栏四文字 tab（证据/改动/记忆/日志）+「···」折叠现有图标 PanelTabs。
 * 改动映射现有 git 面板、日志映射现有 activity 面板（不新造重复状态）；
 * 现有图标 tabs 全部保留在「更多」展开行里（能力不破坏）。
 *
 * 视觉对照 docs/2026-06-12-fanbox-cockpit-redesign/方案原型.html 的 .insp-tabs
 * （文字 tab + 彩色圆点 + 下划线激活态）。
 *
 * OpenSpec change: add-fanbox-dialogue-cockpit（Decision 3）。新增文件（fork-friendly）。
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { PanelTabs, type PanelToolbarTabId } from "./PanelTabs";
import "../../../styles/fanbox-inspector.css";

type FanboxTabKey = "evidence" | "changes" | "memory" | "logs";

type FanboxTabDef = {
  key: FanboxTabKey;
  /** 点击后切到的右栏面板 id（changes→git、logs→activity 复用现有面板）。 */
  panelId: PanelToolbarTabId;
  i18nKey: string;
};

const FANBOX_TABS: readonly FanboxTabDef[] = [
  { key: "evidence", panelId: "evidence", i18nKey: "fanbox.tabs.evidence" },
  { key: "changes", panelId: "git", i18nKey: "fanbox.tabs.changes" },
  { key: "memory", panelId: "memoryInspector", i18nKey: "fanbox.tabs.memory" },
  { key: "logs", panelId: "activity", i18nKey: "fanbox.tabs.logs" },
];

/** 激活态推导：git→改动、activity→日志；files/search 等其他面板时四 tab 均不高亮。 */
export function resolveActiveFanboxTab(active: PanelToolbarTabId): FanboxTabKey | null {
  switch (active) {
    case "evidence":
      return "evidence";
    case "git":
      return "changes";
    case "memoryInspector":
      return "memory";
    case "activity":
      return "logs";
    default:
      return null;
  }
}

type FanBoxPanelTabsProps = {
  active: PanelToolbarTabId;
  onSelect: (id: PanelToolbarTabId) => void;
  liveStates?: Partial<Record<PanelToolbarTabId, boolean>>;
  visibleTabs?: Partial<Record<PanelToolbarTabId, boolean>>;
};

export function FanBoxPanelTabs({
  active,
  onSelect,
  liveStates,
  visibleTabs,
}: FanBoxPanelTabsProps) {
  const { t } = useTranslation();
  const [moreOpen, setMoreOpen] = useState(false);
  const activeKey = resolveActiveFanboxTab(active);

  return (
    <div className="fanbox-insp-tabs-wrap">
      <div className="fanbox-insp-tabs" role="tablist" aria-label="FanBox panels">
        {FANBOX_TABS.map((tab) => {
          const isActive = activeKey === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`fanbox-insp-tab${isActive ? " is-active" : ""}`}
              data-fanbox-tab={tab.key}
              data-tauri-drag-region="false"
              onClick={() => onSelect(tab.panelId)}
            >
              <span className={`fanbox-insp-dot is-${tab.key}`} aria-hidden />
              {t(tab.i18nKey)}
            </button>
          );
        })}
        <button
          type="button"
          className={`fanbox-insp-more${moreOpen ? " is-open" : ""}`}
          aria-label={t("fanbox.tabs.more")}
          aria-expanded={moreOpen}
          data-tauri-drag-region="false"
          onClick={() => setMoreOpen((open) => !open)}
        >
          &middot;&middot;&middot;
        </button>
      </div>
      {moreOpen && (
        <div className="fanbox-insp-overflow">
          <PanelTabs
            active={active}
            onSelect={onSelect}
            liveStates={liveStates}
            visibleTabs={visibleTabs}
          />
        </div>
      )}
    </div>
  );
}
