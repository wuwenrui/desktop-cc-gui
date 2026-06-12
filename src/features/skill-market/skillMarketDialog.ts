/**
 * Skill 市场弹窗的共享打开触发器。
 *
 * 弹窗实例由 `SkillMarketNavItem` 持有；侧栏 lawhub「添加技能」等其他入口
 * 通过本事件打开同一个弹窗（OpenSpec add-lawhub-skill-group-structure-preview
 * Decision 4），与 `ccgui:select-skill` 同样的轻量 window 事件模式。
 *
 * 新增文件（fork-friendly）。
 */

export const OPEN_SKILL_MARKET_EVENT = "ccgui:open-skill-market";

export function openSkillMarketDialog(): void {
  window.dispatchEvent(new CustomEvent(OPEN_SKILL_MARKET_EVENT));
}
