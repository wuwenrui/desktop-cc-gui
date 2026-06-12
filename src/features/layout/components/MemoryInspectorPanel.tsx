/**
 * FanBox 右栏「记忆」面板：项目记忆只读列表 +「打开完整记忆视图」入口。
 *
 * 数据复用现有 projectMemoryFacade.listSummary（与 useProjectMemory 同一数据源，
 * 见 src/features/project-memory/hooks/useProjectMemory.ts），只读不写；
 * 完整视图入口复用现有 onOpenMemory（centerMode = "memory"）。
 *
 * OpenSpec change: add-fanbox-dialogue-cockpit（Decision 3）。新增文件（fork-friendly）。
 */

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ProjectMemoryItem } from "../../../services/tauri";
import { projectMemoryFacade } from "../../project-memory/services/projectMemoryFacade";
import "../../../styles/fanbox-inspector.css";

/** 只读速览只取最近一页，完整浏览走「打开完整记忆视图」。 */
const MEMORY_PREVIEW_PAGE_SIZE = 20;

type MemoryInspectorPanelProps = {
  workspaceId: string | null;
  /** 进入完整记忆视图（现有 onOpenMemory → centerMode "memory"）。 */
  onOpenMemory: () => void;
};

export function MemoryInspectorPanel({
  workspaceId,
  onOpenMemory,
}: MemoryInspectorPanelProps) {
  const { t } = useTranslation();
  const [items, setItems] = useState<ProjectMemoryItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!workspaceId) {
      setItems([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    projectMemoryFacade
      .listSummary({ workspaceId, page: 0, pageSize: MEMORY_PREVIEW_PAGE_SIZE })
      .then((result) => {
        if (!cancelled) {
          setItems(result.items);
        }
      })
      .catch(() => {
        // 只读速览拿不到数据时静默落空态，不打扰主对话流。
        if (!cancelled) {
          setItems([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  return (
    <div className="fanbox-memory-panel">
      <div className="fanbox-panel-title">{t("fanbox.memoryPanel.title")}</div>
      {items.length === 0 ? (
        !loading && (
          <p className="fanbox-panel-empty">{t("fanbox.memoryPanel.empty")}</p>
        )
      ) : (
        <ul className="fanbox-memory-list">
          {items.map((item) => (
            <li key={item.id} className="fanbox-memory-item">
              <strong>{item.title}</strong>
              {item.summary && <p>{item.summary}</p>}
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        className="fanbox-memory-open-full"
        onClick={onOpenMemory}
      >
        {t("fanbox.memoryPanel.open")}
      </button>
    </div>
  );
}
