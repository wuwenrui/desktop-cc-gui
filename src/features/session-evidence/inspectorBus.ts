/**
 * FanBox 右栏联动总线：消息摘要块 / casebar → 右栏 tab 切换。
 * 与 `ccgui:select-skill` 同款轻量 window 事件模式。
 *
 * OpenSpec change: add-fanbox-dialogue-cockpit（Decision 2）。新增文件（fork-friendly）。
 */

export type FanboxInspectorTab = "evidence" | "changes" | "memory" | "logs";

export const OPEN_INSPECTOR_EVENT = "ccgui:fanbox-open-inspector";

export type OpenInspectorDetail = {
  tab: FanboxInspectorTab;
};

export function openInspectorTab(tab: FanboxInspectorTab): void {
  window.dispatchEvent(
    new CustomEvent<OpenInspectorDetail>(OPEN_INSPECTOR_EVENT, {
      detail: { tab },
    }),
  );
}
