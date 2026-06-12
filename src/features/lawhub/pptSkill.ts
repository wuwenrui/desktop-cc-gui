/**
 * lawhub「制作 PPT」与对话框 skill 选择之间的轻量桥接。
 *
 * 侧栏（Sidebar）离 Composer 很远，无法直接调 handleSelectSkill。这里用一个
 * window CustomEvent 把「触发某个 skill」从任意位置传给 Composer（Composer 监听
 * 后调用 handleSelectSkill，附加 skill chip，不展开/暴露提示词正文）。
 *
 * 事件名与 useInputHistoryStore 的 CustomEvent 用法一致（项目既有惯例）。
 */
export const SELECT_SKILL_EVENT = "ccgui:select-skill";

/** 与 bundled skill `skills/制作PPT.md` 的 frontmatter `name` 一致。 */
export const PPT_SKILL_NAME = "制作PPT";
/** 与 bundled skill `skills/文件转Markdown.md` 的 frontmatter `name` 一致。 */
export const FILE_TO_MARKDOWN_SKILL_NAME = "文件转Markdown";
/** 与 bundled skill `skills/视觉OCR.md` 的 frontmatter `name` 一致。 */
export const VISION_OCR_SKILL_NAME = "视觉OCR";
/** 与 bundled skill `skills/制作技能.md` 的 frontmatter `name` 一致。 */
export const MAKE_SKILL_SKILL_NAME = "制作技能";

export type SelectSkillEventDetail = { name: string };

/** 派发「选择某 skill」事件；Composer 监听后附加为 chip。 */
export function dispatchSelectSkill(name: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<SelectSkillEventDetail>(SELECT_SKILL_EVENT, {
      detail: { name },
    }),
  );
}

/** 触发「制作 PPT」skill（lawhub 菜单按钮用）。 */
export function triggerPptSkill(): void {
  dispatchSelectSkill(PPT_SKILL_NAME);
}

/** 触发「文件转 Markdown」skill（lawhub 菜单按钮用）。 */
export function triggerFileToMarkdownSkill(): void {
  dispatchSelectSkill(FILE_TO_MARKDOWN_SKILL_NAME);
}

/** 触发「视觉 OCR」skill（lawhub 菜单按钮用）。 */
export function triggerVisionOcrSkill(): void {
  dispatchSelectSkill(VISION_OCR_SKILL_NAME);
}

/** 触发「制作技能」skill（lawhub 菜单按钮用）。 */
export function triggerMakeSkillSkill(): void {
  dispatchSelectSkill(MAKE_SKILL_SKILL_NAME);
}
