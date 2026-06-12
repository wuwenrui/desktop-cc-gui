import type { SkillFileEntry } from "./skillTree";

/**
 * 技能元信息提取：把 SKILL.md / 文件树翻译成用户语言的概览数据。
 *
 * - description：frontmatter 里的「什么时候用」，概览简介与侧栏悬浮提示共用
 * - 能力清单：sub-skills/ 下的文件名去掉序号与后缀，即「这个技能能做什么」
 * - 示例说法：description 中文引号内的触发例句（"帮我阅卷分析刑事案件"）
 *
 * 纯函数，无依赖（fork-friendly 新增文件）。
 */

/** 从 SKILL.md 全文提取 frontmatter 的 description（支持单行与 >/| 折叠块）。 */
export function parseSkillDescription(content: string): string | null {
  const lines = content.split(/\r?\n/);
  if (lines[0]?.trim() !== "---") {
    return null;
  }
  let end = -1;
  for (let i = 1; i < lines.length; i += 1) {
    if (lines[i].trim() === "---") {
      end = i;
      break;
    }
  }
  if (end < 0) {
    return null;
  }
  for (let i = 1; i < end; i += 1) {
    const matched = lines[i].match(/^description:\s*(.*)$/);
    if (!matched) {
      continue;
    }
    const inline = matched[1].trim();
    if (inline && !/^[>|][+-]?$/.test(inline)) {
      return stripWrappingQuotes(inline);
    }
    const block: string[] = [];
    for (let j = i + 1; j < end; j += 1) {
      if (!/^\s/.test(lines[j])) {
        break;
      }
      block.push(lines[j].trim());
    }
    const joined = block.join(" ").trim();
    return joined || null;
  }
  return null;
}

function stripWrappingQuotes(value: string): string {
  return value.replace(/^["']/, "").replace(/["']$/, "");
}

/** 子技能文件名 → 用户语言的能力名：去序号前缀、去 _SKILL/.md 后缀。 */
export function cleanCapabilityName(fileName: string): string {
  return fileName
    .replace(/\.md$/i, "")
    .replace(/_?SKILL$/i, "")
    .replace(/^\d+[_-]?/, "")
    .replace(/[_-]+$/, "");
}

export type SkillCapability = {
  /** 用户语言的能力名（文件名清洗后）。 */
  label: string;
  /** 子技能文件相对路径（点击取介绍用）。 */
  path: string;
};

/** 从文件树推导「能做什么」清单（sub-skills/ 下的 md，按文件名数字序）。 */
export function deriveCapabilities(
  entries: ReadonlyArray<SkillFileEntry>,
): SkillCapability[] {
  return entries
    .filter((entry) => !entry.is_dir && /^sub-skills\/[^/]+\.md$/i.test(entry.path))
    .sort((a, b) => a.path.localeCompare(b.path, "zh-Hans-CN", { numeric: true }))
    .map((entry) => ({
      label: cleanCapabilityName(entry.path.slice("sub-skills/".length)),
      path: entry.path,
    }))
    .filter((capability) => Boolean(capability.label));
}

/**
 * 子技能介绍：优先 frontmatter description；没有 frontmatter 时取正文
 * 前几行非标题文本（截断）。
 */
export function deriveSubSkillIntro(content: string, max = 240): string {
  const description = parseSkillDescription(content);
  if (description) {
    return summarizeDescription(description, max);
  }
  const body = content.replace(/^---[\s\S]*?\n---/, "");
  const lines = body
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
  return summarizeDescription(lines.slice(0, 6).join(" "), max);
}

/** 从 description 提取引号内的示例说法（中文“”与 ASCII "" 都支持；去重，最多 6 条）。 */
export function extractExamplePhrases(description: string): string[] {
  const result: string[] = [];
  const seen = new Set<string>();
  const patterns = [/“([^”]{2,30})”/g, /"([^"]{2,30})"/g];
  for (const pattern of patterns) {
    for (const matched of description.matchAll(pattern)) {
      const phrase = matched[1].trim();
      if (!phrase || seen.has(phrase)) {
        continue;
      }
      seen.add(phrase);
      result.push(phrase);
      if (result.length >= 6) {
        return result;
      }
    }
  }
  return result;
}

/** 简介压缩成单行悬浮提示（默认 90 字截断）。 */
export function summarizeDescription(description: string, max = 90): string {
  const flattened = description.replace(/\s+/g, " ").trim();
  return flattened.length > max ? `${flattened.slice(0, max)}…` : flattened;
}
