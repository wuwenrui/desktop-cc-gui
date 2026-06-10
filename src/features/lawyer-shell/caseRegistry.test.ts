import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getClientStoreSync,
  writeClientStoreValue,
} from "../../services/clientStorage";
import {
  CASE_REGISTRY_KEY,
  CASE_REGISTRY_STORE,
  createCaseRecord,
  loadCases,
  parseCaseList,
  saveCases,
  sortCasesByRecency,
  touchCaseOpened,
  upsertCase,
  type CaseRecord,
} from "./caseRegistry";

vi.mock("../../services/clientStorage", () => ({
  getClientStoreSync: vi.fn(),
  writeClientStoreValue: vi.fn(),
}));

function makeCase(overrides: Partial<CaseRecord> = {}): CaseRecord {
  const base = createCaseRecord(
    {
      title: "张三诉李四民间借贷纠纷",
      parties: { our: "张三", opposing: "李四" },
      causeOfAction: "民间借贷纠纷",
      workspacePath: "/cases/张三诉李四民间借贷纠纷",
    },
    new Date("2026-06-10T08:00:00Z"),
  );
  return { ...base, ...overrides };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createCaseRecord", () => {
  it("trims fields, defaults stage to intake, null caseNo", () => {
    const record = createCaseRecord(
      {
        title: "  某案  ",
        parties: { our: " 我方 ", opposing: " 对方 " },
        causeOfAction: " 案由 ",
        workspacePath: "/tmp/某案",
      },
      new Date("2026-06-10T08:00:00Z"),
    );
    expect(record.title).toBe("某案");
    expect(record.parties).toEqual({ our: "我方", opposing: "对方" });
    expect(record.causeOfAction).toBe("案由");
    expect(record.stage).toBe("intake");
    expect(record.caseNo).toBeNull();
    expect(record.createdAt).toBe("2026-06-10T08:00:00.000Z");
    expect(record.updatedAt).toBe(record.createdAt);
    expect(record.lastOpenedAt).toBeNull();
    expect(record.id).toBeTruthy();
  });
});

describe("upsertCase / touchCaseOpened", () => {
  it("appends a new record immutably", () => {
    const existing = makeCase();
    const incoming = makeCase({ id: "other-id", title: "另一案" });
    const next = upsertCase([existing], incoming);
    expect(next).toHaveLength(2);
    expect(next).not.toBe([existing]);
  });

  it("replaces a record with the same id", () => {
    const existing = makeCase({ id: "case-1" });
    const next = upsertCase([existing], { ...existing, stage: "filed" });
    expect(next).toHaveLength(1);
    expect(next[0].stage).toBe("filed");
  });

  it("touchCaseOpened bumps lastOpenedAt/updatedAt only for the target", () => {
    const a = makeCase({ id: "a" });
    const b = makeCase({ id: "b" });
    const next = touchCaseOpened([a, b], "a", new Date("2026-06-11T01:00:00Z"));
    expect(next[0].lastOpenedAt).toBe("2026-06-11T01:00:00.000Z");
    expect(next[0].updatedAt).toBe("2026-06-11T01:00:00.000Z");
    expect(next[1].lastOpenedAt).toBeNull();
  });
});

describe("sortCasesByRecency", () => {
  it("puts most recently opened first", () => {
    const older = makeCase({ id: "old", lastOpenedAt: "2026-06-01T00:00:00.000Z" });
    const newer = makeCase({ id: "new", lastOpenedAt: "2026-06-09T00:00:00.000Z" });
    const sorted = sortCasesByRecency([older, newer]);
    expect(sorted.map((entry) => entry.id)).toEqual(["new", "old"]);
  });
});

describe("parseCaseList", () => {
  it("returns [] for missing or corrupt data", () => {
    expect(parseCaseList(undefined)).toEqual([]);
    expect(parseCaseList("oops")).toEqual([]);
    expect(parseCaseList({ not: "an array" })).toEqual([]);
  });

  it("drops invalid records and keeps valid ones", () => {
    const valid = makeCase();
    const parsed = parseCaseList([valid, { id: 1 }, null, { title: "缺字段" }]);
    expect(parsed).toEqual([valid]);
  });
});

describe("loadCases / saveCases", () => {
  it("loads from the app client store under lawyerCases", () => {
    const record = makeCase();
    vi.mocked(getClientStoreSync).mockReturnValue([record]);
    expect(loadCases()).toEqual([record]);
    expect(getClientStoreSync).toHaveBeenCalledWith(
      CASE_REGISTRY_STORE,
      CASE_REGISTRY_KEY,
    );
  });

  it("saves the full list back to the client store", () => {
    const record = makeCase();
    saveCases([record]);
    expect(writeClientStoreValue).toHaveBeenCalledWith(
      CASE_REGISTRY_STORE,
      CASE_REGISTRY_KEY,
      [record],
    );
  });
});
