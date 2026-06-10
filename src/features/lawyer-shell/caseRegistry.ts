import {
  getClientStoreSync,
  writeClientStoreValue,
} from "../../services/clientStorage";

/**
 * 本地案件登记表（lawyer-shell）。
 *
 * 持久化复用既有 client store 机制（`app` store，Tauri `client_store_read`/
 * `client_store_write` 落盘），key 为 `lawyerCases`。纯函数 + 薄读写层，
 * 便于单测；不接 lawhub case_id（P0 再绑，见 proposal Boundary）。
 */

/** 案件阶段，与 lawhub 契约一致的枚举字符串。 */
export type CaseStage =
  | "intake"
  | "filing_prep"
  | "filed"
  | "in_trial"
  | "judgment"
  | "enforcement"
  | "closed";

export const CASE_STAGES: readonly CaseStage[] = [
  "intake",
  "filing_prep",
  "filed",
  "in_trial",
  "judgment",
  "enforcement",
  "closed",
] as const;

export type CaseParties = {
  /** 我方当事人 */
  our: string;
  /** 对方当事人 */
  opposing: string;
};

export type CaseRecord = {
  id: string;
  /** 案件名 */
  title: string;
  /** 案号，立案前可空 */
  caseNo: string | null;
  parties: CaseParties;
  /** 案由 */
  causeOfAction: string;
  stage: CaseStage;
  workspacePath: string;
  /** ISO 8601 */
  createdAt: string;
  /** ISO 8601 */
  updatedAt: string;
  /** ISO 8601，卡片「最近打开」展示用 */
  lastOpenedAt: string | null;
};

export const CASE_REGISTRY_STORE = "app" as const;
export const CASE_REGISTRY_KEY = "lawyerCases";

export type NewCaseInput = {
  title: string;
  caseNo?: string | null;
  parties: CaseParties;
  causeOfAction: string;
  workspacePath: string;
};

function generateCaseId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `case-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function isCaseStage(value: unknown): value is CaseStage {
  return typeof value === "string" && (CASE_STAGES as readonly string[]).includes(value);
}

/** 单条记录合法性校验：非法记录在加载时被丢弃，注册表损坏不致崩溃。 */
function isCaseRecord(value: unknown): value is CaseRecord {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === "string" &&
    typeof record.title === "string" &&
    typeof record.workspacePath === "string" &&
    isCaseStage(record.stage) &&
    typeof record.parties === "object" &&
    record.parties !== null
  );
}

/** 纯函数：从原始存储值解析案件列表（容忍缺失/损坏）。 */
export function parseCaseList(raw: unknown): CaseRecord[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.filter(isCaseRecord);
}

/** 纯函数：创建一条新案件记录（不落盘）。 */
export function createCaseRecord(
  input: NewCaseInput,
  now: Date = new Date(),
): CaseRecord {
  const timestamp = now.toISOString();
  return {
    id: generateCaseId(),
    title: input.title.trim(),
    caseNo: input.caseNo?.trim() || null,
    parties: {
      our: input.parties.our.trim(),
      opposing: input.parties.opposing.trim(),
    },
    causeOfAction: input.causeOfAction.trim(),
    stage: "intake",
    workspacePath: input.workspacePath,
    createdAt: timestamp,
    updatedAt: timestamp,
    lastOpenedAt: null,
  };
}

/** 纯函数：新增或按 id 替换记录，返回新数组（不可变）。 */
export function upsertCase(
  cases: readonly CaseRecord[],
  record: CaseRecord,
): CaseRecord[] {
  const index = cases.findIndex((entry) => entry.id === record.id);
  if (index === -1) {
    return [...cases, record];
  }
  return cases.map((entry) => (entry.id === record.id ? record : entry));
}

/** 纯函数：标记案件被打开（刷新 lastOpenedAt/updatedAt），返回新数组。 */
export function touchCaseOpened(
  cases: readonly CaseRecord[],
  caseId: string,
  now: Date = new Date(),
): CaseRecord[] {
  const timestamp = now.toISOString();
  return cases.map((entry) =>
    entry.id === caseId
      ? { ...entry, lastOpenedAt: timestamp, updatedAt: timestamp }
      : entry,
  );
}

/** 纯函数：最近打开/更新优先排序，返回新数组。 */
export function sortCasesByRecency(cases: readonly CaseRecord[]): CaseRecord[] {
  return [...cases].sort((a, b) => {
    const aTime = a.lastOpenedAt ?? a.updatedAt;
    const bTime = b.lastOpenedAt ?? b.updatedAt;
    return bTime.localeCompare(aTime);
  });
}

/** 从 client store 读案件列表（同步缓存读取，store 在 app 启动时预载）。 */
export function loadCases(): CaseRecord[] {
  return parseCaseList(getClientStoreSync(CASE_REGISTRY_STORE, CASE_REGISTRY_KEY));
}

/** 全量写回案件列表（client store 防抖落盘）。 */
export function saveCases(cases: readonly CaseRecord[]): void {
  writeClientStoreValue(CASE_REGISTRY_STORE, CASE_REGISTRY_KEY, cases);
}
