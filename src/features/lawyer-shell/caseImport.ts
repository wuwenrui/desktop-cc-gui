import { invoke } from "@tauri-apps/api/core";
import {
  CASE_STAGES,
  type CaseStage,
  type NewCaseInput,
} from "./caseRegistry";

/**
 * 案件导入（lawyer-shell）：Rust 命令封装 + 草稿到表单的纯映射。
 *
 * Rust 侧三命令见 `src-tauri/src/case_import/`：
 * - alphabox_sync_roots：列 AlphaBox 已同步资料库
 * - scan_case_candidates：列父目录的一级子目录为候选案件
 * - parse_case_folder：解析单个案件文件夹（纯读取，零写入）
 */

/** AlphaBox 已同步到本地的资料库。 */
export type SyncRoot = {
  localRootPath: string;
  remoteName: string;
  status: string;
};

/** 候选案件目录概况。 */
export type CandidateDir = {
  path: string;
  name: string;
  fileCount: number;
  hasDocx: boolean;
  hasPdf: boolean;
  modifiedAt: string | null;
};

export type Confidence = "high" | "medium" | "low";

/** 解析出的字段：值 + 来源文件 + 置信度。 */
export type FieldDraft = {
  value: string;
  sourceFile: string;
  confidence: Confidence;
};

/** 解析出的当事人（角色原样保留，立场由律师指定）。 */
export type PartyDraft = {
  role: string;
  name: string;
  sourceFile: string;
};

/** `parse_case_folder` 返回的案件草稿。 */
export type CaseDraft = {
  titleSuggestion: string;
  caseNo: FieldDraft | null;
  causeOfAction: FieldDraft | null;
  courtName: FieldDraft | null;
  stageSuggestion: string;
  stageEvidence: string[];
  parties: PartyDraft[];
  scannedFiles: string[];
  skippedPdfCount: number;
  notes: string[];
};

export function listAlphaboxSyncRoots(): Promise<SyncRoot[]> {
  return invoke<SyncRoot[]>("alphabox_sync_roots");
}

export function scanCaseCandidates(parentDir: string): Promise<CandidateDir[]> {
  return invoke<CandidateDir[]>("scan_case_candidates", { parentDir });
}

export function parseCaseFolder(dir: string): Promise<CaseDraft> {
  return invoke<CaseDraft>("parse_case_folder", { dir });
}

// ---- 草稿 → 确认表单 ----

/** 当事人立场：导入确认时由律师指定，不做猜测。 */
export type PartySide = "our" | "opposing" | "none";

export type ImportPartyRow = PartyDraft & { side: PartySide };

/** 各预填字段的来源文件（无来源 = null，界面留空让律师填）。 */
export type ImportSources = {
  caseNo: string | null;
  causeOfAction: string | null;
  courtName: string | null;
};

/** 导入确认表单（可编辑状态）。 */
export type ImportCaseForm = {
  /** 案件材料原目录（即工作区路径，导入不移动文件） */
  dirPath: string;
  title: string;
  caseNo: string;
  causeOfAction: string;
  courtName: string;
  stage: CaseStage;
  stageEvidence: string[];
  parties: ImportPartyRow[];
  sources: ImportSources;
  notes: string[];
  skippedPdfCount: number;
  /** 是否在原目录补齐标准子目录骨架（默认关） */
  createSkeleton: boolean;
};

/** Rust 返回的阶段字符串校验，非法值回退 intake。 */
export function toCaseStage(value: string): CaseStage {
  return (CASE_STAGES as readonly string[]).includes(value)
    ? (value as CaseStage)
    : "intake";
}

/** 纯函数：解析草稿 → 确认表单初始值。 */
export function draftToImportForm(
  dirPath: string,
  draft: CaseDraft,
): ImportCaseForm {
  return {
    dirPath,
    title: draft.titleSuggestion,
    caseNo: draft.caseNo?.value ?? "",
    causeOfAction: draft.causeOfAction?.value ?? "",
    courtName: draft.courtName?.value ?? "",
    stage: toCaseStage(draft.stageSuggestion),
    stageEvidence: [...draft.stageEvidence],
    parties: draft.parties.map((party) => ({ ...party, side: "none" as const })),
    sources: {
      caseNo: draft.caseNo?.sourceFile ?? null,
      causeOfAction: draft.causeOfAction?.sourceFile ?? null,
      courtName: draft.courtName?.sourceFile ?? null,
    },
    notes: [...draft.notes],
    skippedPdfCount: draft.skippedPdfCount,
    createSkeleton: false,
  };
}

/** 取某一立场的当事人名，用「、」连接。 */
export function joinPartyNames(
  parties: readonly ImportPartyRow[],
  side: PartySide,
): string {
  return parties
    .filter((party) => party.side === side)
    .map((party) => party.name)
    .join("、");
}

/** 纯函数：确认表单 → 登记表输入（workspacePath = 原目录）。 */
export function importFormToNewCaseInput(form: ImportCaseForm): NewCaseInput {
  return {
    title: form.title,
    caseNo: form.caseNo.trim() || null,
    parties: {
      our: joinPartyNames(form.parties, "our"),
      opposing: joinPartyNames(form.parties, "opposing"),
    },
    causeOfAction: form.causeOfAction,
    workspacePath: form.dirPath,
    stage: form.stage,
    origin: "imported",
    courtName: form.courtName.trim() || null,
  };
}

/** 有限并发 map（批量解析候选目录用，结果保持原顺序）。 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const workerCount = Math.max(1, Math.min(limit, items.length));
  const workers = Array.from({ length: workerCount }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await fn(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}
