import type { UiMode } from "../../types";

/**
 * 律师模式导航白名单（lawyer-shell）。
 *
 * Sidebar 的主导航与设置下拉项各自带一个稳定的 NavEntryId；
 * `uiMode === "lawyer"` 时只渲染白名单内的项，开发者模式全量渲染。
 * 设计依据：openspec/changes/add-lawyer-mode-shell/specs/lawyer-mode-shell/spec.md。
 */
export type NavEntryId =
  // 主导航
  | "home-chat"
  | "kanban"
  | "global-search"
  | "skill-market"
  | "lawhub"
  | "cases"
  // 设置下拉
  | "quick-skills"
  | "lock"
  | "spec-hub"
  | "memory"
  | "git-history"
  | "environment"
  | "release-notes"
  | "settings";

/**
 * 律师模式可见项：我的案件（置顶）、Skill 市场、lawhub、设置。
 * 锁屏 / 环境依赖 / 发行说明 属于非开发者向的通用功能，一并保留
 * （环境依赖是 fork 能力锚点，律师装引擎依赖也需要它）。
 */
export const LAWYER_VISIBLE_NAV: readonly NavEntryId[] = [
  "cases",
  "skill-market",
  "lawhub",
  "settings",
  "lock",
  "environment",
  "release-notes",
] as const;

const lawyerVisibleNavSet: ReadonlySet<NavEntryId> = new Set(LAWYER_VISIBLE_NAV);

/** 判断某导航项在给定界面模式下是否可见。 */
export function isNavVisible(
  uiMode: UiMode | undefined,
  entryId: NavEntryId,
): boolean {
  if (uiMode !== "lawyer") {
    return true;
  }
  return lawyerVisibleNavSet.has(entryId);
}
