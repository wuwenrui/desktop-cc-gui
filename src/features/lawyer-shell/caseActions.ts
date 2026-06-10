import { dispatchSelectSkill } from "../lawhub/pptSkill";
import type { CaseStage } from "./caseRegistry";

/**
 * 案件相关常量与快捷动作（lawyer-shell）。
 *
 * 快捷动作复用既有 `SELECT_SKILL_EVENT` 桥（`src/features/lawhub/pptSkill.ts`，
 * Composer 在 `Composer.tsx` 监听后附加 skill chip）。skill 文件
 * （卷宗梳理 / 民事起诉状 / 证据清单）由另一分支提供，本模块按名引用。
 */

/** 案件阶段中文标签（卡片徽章用）。 */
export const CASE_STAGE_LABELS: Record<CaseStage, string> = {
  intake: "接案",
  filing_prep: "立案准备",
  filed: "已立案",
  in_trial: "庭审中",
  judgment: "已判决",
  enforcement: "执行中",
  closed: "已结案",
};

/** 新建案件标准目录骨架（T0.3 采样定稿前的缺省值，见总计划 §4.1②）。 */
export const CASE_DIR_SKELETON: readonly string[] = [
  "起诉材料",
  "证据材料",
  "文书",
  "沟通记录",
  "庭审",
  "结案",
] as const;

export type CaseQuickActionId = "organize-dossier" | "draft-document" | "organize-evidence";

export type CaseQuickAction = {
  id: CaseQuickActionId;
  /** 按钮文案 */
  label: string;
  /** 引用的 skill 名（与 skill 文件 frontmatter `name` 一致） */
  skillName: string;
};

export const CASE_QUICK_ACTIONS: readonly CaseQuickAction[] = [
  { id: "organize-dossier", label: "梳理卷宗", skillName: "卷宗梳理" },
  { id: "draft-document", label: "起草文书", skillName: "民事起诉状" },
  { id: "organize-evidence", label: "整理证据", skillName: "证据清单" },
] as const;

/**
 * 接线点：打开工作区后 Composer 需要时间挂载才能收到 SELECT_SKILL_EVENT。
 * 这里用单次延迟派发兜底（不可重复派发——Composer 的 handleSelectSkill 是
 * toggle 语义，双发会取消选中）。若后续有「composer 就绪」事件，应改为
 * 事件握手。
 */
export const SKILL_DISPATCH_DELAY_MS = 600;

export function dispatchCaseSkillDeferred(
  skillName: string,
  delayMs: number = SKILL_DISPATCH_DELAY_MS,
): void {
  if (typeof window === "undefined") {
    return;
  }
  window.setTimeout(() => {
    dispatchSelectSkill(skillName);
  }, delayMs);
}
