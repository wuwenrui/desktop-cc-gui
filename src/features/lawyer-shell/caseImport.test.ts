import { describe, expect, it, vi } from "vitest";
import {
  draftToImportForm,
  importFormToNewCaseInput,
  joinPartyNames,
  mapWithConcurrency,
  toCaseStage,
  type CaseDraft,
  type ImportCaseForm,
} from "./caseImport";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

function makeDraft(overrides: Partial<CaseDraft> = {}): CaseDraft {
  return {
    titleSuggestion: "张三诉李四民间借贷纠纷",
    caseNo: {
      value: "（2023）京0105民初12345号",
      sourceFile: "受理通知书.txt",
      confidence: "high",
    },
    causeOfAction: {
      value: "民间借贷纠纷",
      sourceFile: "文书/民事起诉状.docx",
      confidence: "high",
    },
    courtName: {
      value: "北京市朝阳区人民法院",
      sourceFile: "受理通知书.txt",
      confidence: "high",
    },
    stageSuggestion: "filed",
    stageEvidence: ["文件名「受理通知书.txt」含「受理通知」"],
    parties: [
      { role: "原告", name: "张三", sourceFile: "文书/民事起诉状.docx" },
      { role: "被告", name: "李四", sourceFile: "文书/民事起诉状.docx" },
    ],
    scannedFiles: ["受理通知书.txt", "文书/民事起诉状.docx"],
    skippedPdfCount: 2,
    notes: ["2 个 PDF 文件未解析（本期不支持 PDF/扫描件文本提取）"],
    ...overrides,
  };
}

describe("toCaseStage", () => {
  it("passes through valid stages and falls back to intake", () => {
    expect(toCaseStage("judgment")).toBe("judgment");
    expect(toCaseStage("不是阶段")).toBe("intake");
    expect(toCaseStage("")).toBe("intake");
  });
});

describe("draftToImportForm", () => {
  it("maps fields, sources and defaults party side to none", () => {
    const form = draftToImportForm("/cases/某案", makeDraft());
    expect(form.dirPath).toBe("/cases/某案");
    expect(form.title).toBe("张三诉李四民间借贷纠纷");
    expect(form.caseNo).toBe("（2023）京0105民初12345号");
    expect(form.stage).toBe("filed");
    expect(form.sources.caseNo).toBe("受理通知书.txt");
    expect(form.sources.causeOfAction).toBe("文书/民事起诉状.docx");
    expect(form.parties.map((p) => p.side)).toEqual(["none", "none"]);
    expect(form.createSkeleton).toBe(false);
  });

  it("leaves missing fields empty with null sources", () => {
    const form = draftToImportForm(
      "/cases/空案",
      makeDraft({
        caseNo: null,
        causeOfAction: null,
        courtName: null,
        stageSuggestion: "intake",
        parties: [],
      }),
    );
    expect(form.caseNo).toBe("");
    expect(form.causeOfAction).toBe("");
    expect(form.courtName).toBe("");
    expect(form.sources).toEqual({
      caseNo: null,
      causeOfAction: null,
      courtName: null,
    });
    expect(form.parties).toEqual([]);
  });
});

describe("importFormToNewCaseInput", () => {
  function makeForm(overrides: Partial<ImportCaseForm> = {}): ImportCaseForm {
    return {
      ...draftToImportForm("/cases/某案", makeDraft()),
      ...overrides,
    };
  }

  it("joins party names by chosen side and marks origin imported", () => {
    const base = makeForm();
    const form = makeForm({
      parties: [
        { ...base.parties[0], side: "our" },
        { ...base.parties[1], side: "opposing" },
      ],
    });
    const input = importFormToNewCaseInput(form);
    expect(input.parties).toEqual({ our: "张三", opposing: "李四" });
    expect(input.origin).toBe("imported");
    expect(input.stage).toBe("filed");
    expect(input.workspacePath).toBe("/cases/某案");
    expect(input.caseNo).toBe("（2023）京0105民初12345号");
    expect(input.courtName).toBe("北京市朝阳区人民法院");
  });

  it("unassigned parties stay out of our/opposing, blank fields become null", () => {
    const form = makeForm({ caseNo: "  ", courtName: "" });
    const input = importFormToNewCaseInput(form);
    expect(input.parties).toEqual({ our: "", opposing: "" });
    expect(input.caseNo).toBeNull();
    expect(input.courtName).toBeNull();
  });

  it("joins multiple same-side parties with 、", () => {
    const base = makeForm();
    const parties = [
      { ...base.parties[0], side: "our" as const },
      { role: "原告", name: "王五", sourceFile: "a.txt", side: "our" as const },
    ];
    expect(joinPartyNames(parties, "our")).toBe("张三、王五");
  });
});

describe("mapWithConcurrency", () => {
  it("preserves order and respects the concurrency limit", async () => {
    let active = 0;
    let maxActive = 0;
    const items = [1, 2, 3, 4, 5, 6, 7];
    const results = await mapWithConcurrency(items, 3, async (item) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
      return item * 10;
    });
    expect(results).toEqual([10, 20, 30, 40, 50, 60, 70]);
    expect(maxActive).toBeLessThanOrEqual(3);
    expect(maxActive).toBeGreaterThan(1);
  });

  it("handles empty input", async () => {
    expect(await mapWithConcurrency([], 3, async () => 1)).toEqual([]);
  });
});
