/**
 * session-evidence 数据层：从 assistant 消息文本中的 tool-call 块推导
 * 「引用了什么 / 改了什么」的用户语言摘要（FanBox 精髓的数据底座）。
 *
 * 只消费 `parseToolCallBlocks` 的产物，不新增协议；流式未完成的块跳过。
 * 引用 = Read / NotebookRead；改动 = Edit / Write / MultiEdit / NotebookEdit。
 * Bash/Grep/Glob 噪音大于信号，v1 不计入。
 *
 * OpenSpec change: add-fanbox-dialogue-cockpit（Decision 1）。新增文件（fork-friendly）。
 */

import { parseUserTextContent } from "../messages/components/CollapsibleUserTextBlock";
import { parseToolCallBlocks } from "../messages/utils/toolCallBlocks";

export type ChangedFile = {
  path: string;
  edits: number;
};

export type TurnSourceSummary = {
  /** Read/NotebookRead 的目标文件，去重，按首次出现排序。 */
  citedFiles: string[];
  /** Edit/Write/... 的目标文件与次数，按 edits 降序。 */
  changedFiles: ChangedFile[];
  totalEdits: number;
};

export type SessionFileActivity = {
  path: string;
  reads: number;
  edits: number;
};

const READ_TOOLS = new Set(["Read", "NotebookRead"]);
const WRITE_TOOLS = new Set(["Edit", "Write", "MultiEdit", "NotebookEdit"]);
const PATH_PARAMS = ["file_path", "notebook_path", "path"];

function extractPath(params: ReadonlyArray<{ name: string; value: string }>): string | null {
  for (const key of PATH_PARAMS) {
    const hit = params.find((p) => p.name === key);
    const value = hit?.value.trim();
    if (value) {
      return value;
    }
  }
  return null;
}

/** 路径短名（展示用）；完整路径放 title。 */
export function fileBasename(path: string): string {
  const normalized = path.replace(/\\/g, "/").replace(/\/+$/, "");
  const idx = normalized.lastIndexOf("/");
  return idx >= 0 ? normalized.slice(idx + 1) : normalized;
}

export function deriveTurnSourceSummary(text: string): TurnSourceSummary {
  const cited: string[] = [];
  const citedSeen = new Set<string>();
  const edits = new Map<string, number>();

  if (text) {
    for (const block of parseToolCallBlocks(text)) {
      if (block.kind !== "tool-call" || !block.complete || !block.tool || !block.params) {
        continue;
      }
      const path = extractPath(block.params);
      if (!path) {
        continue;
      }
      if (READ_TOOLS.has(block.tool)) {
        if (!citedSeen.has(path)) {
          citedSeen.add(path);
          cited.push(path);
        }
      } else if (WRITE_TOOLS.has(block.tool)) {
        edits.set(path, (edits.get(path) ?? 0) + 1);
      }
    }
  }

  const changedFiles = [...edits.entries()]
    .map(([path, count]) => ({ path, edits: count }))
    .sort((a, b) => b.edits - a.edits || a.path.localeCompare(b.path));

  return {
    citedFiles: cited,
    changedFiles,
    totalEdits: changedFiles.reduce((sum, f) => sum + f.edits, 0),
  };
}

/** 摘要是否值得渲染：引用与改动均空 → 不打扰。 */
export function hasSourceSignal(summary: TurnSourceSummary): boolean {
  return summary.citedFiles.length > 0 || summary.changedFiles.length > 0;
}

/** 会话消息的最小输入形态（ConversationItem 联合类型的运行时窄化结果）。 */
export type EvidenceMessage = {
  role: "user" | "assistant";
  text: string;
};

/** 从任意会话条目数组窄化出可推导证据的消息（其余 kind 忽略）。 */
export function pickEvidenceMessages(
  items: ReadonlyArray<unknown>,
): EvidenceMessage[] {
  const result: EvidenceMessage[] = [];
  for (const item of items) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const candidate = item as { role?: unknown; text?: unknown };
    if (
      (candidate.role === "user" || candidate.role === "assistant") &&
      typeof candidate.text === "string" &&
      candidate.text
    ) {
      result.push({ role: candidate.role, text: candidate.text });
    }
  }
  return result;
}

/** 用户消息里的 @文件引用（目录引用不计）。 */
export function deriveUserReferences(text: string): string[] {
  if (!text.includes("@")) {
    return [];
  }
  try {
    return parseUserTextContent(text)
      .references.filter((ref) => !ref.isDirectory && ref.path)
      .map((ref) => ref.path);
  } catch {
    // 解析失败按无引用处理，不阻断渲染。
    return [];
  }
}

/**
 * 跨消息聚合本会话文件活动（casebar 文件视图 / 右栏证据面板共用）。
 * 引用来源 = AI 的 Read 工具调用 + 用户消息的 @文件引用（律师附卷的常见路径）。
 */
export function deriveSessionEvidence(
  messages: ReadonlyArray<EvidenceMessage>,
): SessionFileActivity[] {
  const byPath = new Map<string, SessionFileActivity>();
  const bumpReads = (path: string) => {
    const entry = byPath.get(path) ?? { path, reads: 0, edits: 0 };
    entry.reads += 1;
    byPath.set(path, entry);
  };
  for (const message of messages) {
    if (message.role === "user") {
      for (const path of deriveUserReferences(message.text)) {
        bumpReads(path);
      }
      continue;
    }
    const summary = deriveTurnSourceSummary(message.text);
    for (const path of summary.citedFiles) {
      bumpReads(path);
    }
    for (const changed of summary.changedFiles) {
      const entry = byPath.get(changed.path) ?? { path: changed.path, reads: 0, edits: 0 };
      entry.edits += changed.edits;
      byPath.set(changed.path, entry);
    }
  }
  return [...byPath.values()].sort(
    (a, b) => b.edits - a.edits || b.reads - a.reads || a.path.localeCompare(b.path),
  );
}
