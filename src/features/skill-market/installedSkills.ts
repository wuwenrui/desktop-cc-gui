/**
 * 已装 skill 索引的展示辅助：排序 + 安装完成广播。
 *
 * 数据源是 Rust `market_list_installed`（`~/.claude/skills/.skillhub-installed.json`）。
 * 排序规则（OpenSpec add-lawhub-skill-group-structure-preview）：
 * - 无 installed_at 的旧条目排前，按名称序
 * - 有 installed_at 的按时间升序（先装在前），同刻按名称序
 *
 * 新增文件（fork-friendly）：纯函数 + window 事件，无上游改动。
 */

import type { InstalledEntry, InstalledIndex } from "./api";

export type InstalledSkillItem = {
  name: string;
  /** 侧栏展示名：display_name 缺失时回落 name。 */
  displayName: string;
  entry: InstalledEntry;
};

export function sortInstalledSkills(index: InstalledIndex): InstalledSkillItem[] {
  return Object.entries(index)
    .map(([name, entry]) => ({
      name,
      displayName: entry.display_name?.trim() ? entry.display_name : name,
      entry,
    }))
    .sort((a, b) => {
      const ta = a.entry.installed_at;
      const tb = b.entry.installed_at;
      if (ta == null && tb == null) {
        return a.name.localeCompare(b.name);
      }
      if (ta == null) {
        return -1;
      }
      if (tb == null) {
        return 1;
      }
      if (ta !== tb) {
        return ta - tb;
      }
      return a.name.localeCompare(b.name);
    });
}

export function getInstalledSkillDisplayName(
  index: InstalledIndex | Record<string, { display_name?: string | null }> | null | undefined,
  name: string,
): string | undefined {
  const key = name.trim();
  if (!key) {
    return undefined;
  }
  const displayName = index?.[key]?.display_name?.trim();
  return displayName || undefined;
}

/** 市场安装成功后的广播事件：侧栏技能组监听并刷新。 */
export const SKILL_INSTALLED_EVENT = "ccgui:skill-market-installed";

export function notifySkillInstalled(name: string): void {
  window.dispatchEvent(
    new CustomEvent<{ name: string }>(SKILL_INSTALLED_EVENT, {
      detail: { name },
    }),
  );
}
