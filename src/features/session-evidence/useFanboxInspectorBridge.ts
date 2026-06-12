/**
 * FanBox 右栏联动桥：监听 inspectorBus 的 OPEN_INSPECTOR_EVENT，
 * 把消息侧的语义 tab（evidence/changes/memory/logs）映射成右栏
 * filePanelMode（evidence/git/memoryInspector/activity）并请求展开右栏。
 *
 * 由 filePanelMode 状态持有方（app-shell 层）挂载。
 *
 * OpenSpec change: add-fanbox-dialogue-cockpit（Decision 2/3）。新增文件（fork-friendly）。
 */

import { useEffect, useRef } from "react";
import {
  OPEN_INSPECTOR_EVENT,
  type FanboxInspectorTab,
  type OpenInspectorDetail,
} from "./inspectorBus";

/** 右栏面板态：changes 复用现有 git 面板，logs 复用现有 activity 面板。 */
export type InspectorPanelMode = "evidence" | "git" | "memoryInspector" | "activity";

export function mapInspectorTabToPanelMode(tab: FanboxInspectorTab): InspectorPanelMode {
  switch (tab) {
    case "changes":
      return "git";
    case "memory":
      return "memoryInspector";
    case "logs":
      return "activity";
    case "evidence":
      return "evidence";
  }
}

export function useFanboxInspectorBridge(
  openPanel: (mode: InspectorPanelMode) => void,
): void {
  // 回调走 ref，避免持有方每次 render 都重建监听器。
  const openPanelRef = useRef(openPanel);
  openPanelRef.current = openPanel;

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<OpenInspectorDetail>).detail;
      if (!detail?.tab) {
        return;
      }
      openPanelRef.current(mapInspectorTabToPanelMode(detail.tab));
    };
    window.addEventListener(OPEN_INSPECTOR_EVENT, handler);
    return () => window.removeEventListener(OPEN_INSPECTOR_EVENT, handler);
  }, []);
}
