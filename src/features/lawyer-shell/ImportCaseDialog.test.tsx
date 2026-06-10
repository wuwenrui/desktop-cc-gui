/** @vitest-environment jsdom */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { open } from "@tauri-apps/plugin-dialog";
import {
  listAlphaboxSyncRoots,
  parseCaseFolder,
  scanCaseCandidates,
  type CandidateDir,
  type CaseDraft,
  type ImportCaseForm,
  type SyncRoot,
} from "./caseImport";
import { ImportCaseDialog } from "./ImportCaseDialog";

vi.mock("./caseImport", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./caseImport")>();
  return {
    ...actual,
    listAlphaboxSyncRoots: vi.fn(),
    scanCaseCandidates: vi.fn(),
    parseCaseFolder: vi.fn(),
  };
});
vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(),
}));

const SYNC_ROOT: SyncRoot = {
  localRootPath: "/Users/lawyer/AlphaBox/案件库",
  remoteName: "案件库",
  status: "2",
};

function makeCandidate(overrides: Partial<CandidateDir> = {}): CandidateDir {
  return {
    path: "/Users/lawyer/AlphaBox/案件库/张三诉李四民间借贷纠纷",
    name: "张三诉李四民间借贷纠纷",
    fileCount: 12,
    hasDocx: true,
    hasPdf: true,
    modifiedAt: "2026-06-01T00:00:00Z",
    ...overrides,
  };
}

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
    courtName: null,
    stageSuggestion: "filed",
    stageEvidence: ["文件名「受理通知书.txt」含「受理通知」"],
    parties: [
      { role: "原告", name: "张三", sourceFile: "文书/民事起诉状.docx" },
      { role: "被告", name: "李四", sourceFile: "文书/民事起诉状.docx" },
    ],
    scannedFiles: ["受理通知书.txt"],
    skippedPdfCount: 1,
    notes: ["1 个 PDF 文件未解析（本期不支持 PDF/扫描件文本提取）"],
    ...overrides,
  };
}

beforeEach(() => {
  vi.mocked(listAlphaboxSyncRoots).mockResolvedValue([]);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("ImportCaseDialog - AlphaBox tab", () => {
  it("shows the empty-state copy when no library is synced", async () => {
    render(<ImportCaseDialog busy={false} onImport={vi.fn()} onClose={vi.fn()} />);
    expect(
      await screen.findByText(/尚未在本机同步任何 AlphaBox 资料库/),
    ).toBeTruthy();
  });

  it("lists sync roots, scans candidates and parses into the confirm form", async () => {
    vi.mocked(listAlphaboxSyncRoots).mockResolvedValue([SYNC_ROOT]);
    vi.mocked(scanCaseCandidates).mockResolvedValue([makeCandidate()]);
    vi.mocked(parseCaseFolder).mockResolvedValue(makeDraft());

    render(<ImportCaseDialog busy={false} onImport={vi.fn()} onClose={vi.fn()} />);

    // 库卡片：库名 + 本地路径
    fireEvent.click(await screen.findByText("案件库"));
    await waitFor(() =>
      expect(scanCaseCandidates).toHaveBeenCalledWith(SYNC_ROOT.localRootPath),
    );

    // 候选表格 → 解析
    expect(await screen.findByText("12 个文件")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "解析" }));
    await waitFor(() =>
      expect(parseCaseFolder).toHaveBeenCalledWith(makeCandidate().path),
    );

    // 确认页预填 + 来源灰字
    const titleInput = (await screen.findByLabelText("案件名")) as HTMLInputElement;
    expect(titleInput.value).toBe("张三诉李四民间借贷纠纷");
    expect((screen.getByLabelText("案号") as HTMLInputElement).value).toBe(
      "（2023）京0105民初12345号",
    );
    expect(screen.getAllByText("来自 受理通知书.txt").length).toBeGreaterThan(0);
    expect((screen.getByLabelText("阶段") as HTMLSelectElement).value).toBe("filed");
    // 法院未解析 → 留空
    expect((screen.getByLabelText("法院") as HTMLInputElement).value).toBe("");
  });

  it("submits the confirmed form with lawyer-assigned party sides", async () => {
    vi.mocked(listAlphaboxSyncRoots).mockResolvedValue([SYNC_ROOT]);
    vi.mocked(scanCaseCandidates).mockResolvedValue([makeCandidate()]);
    vi.mocked(parseCaseFolder).mockResolvedValue(makeDraft());
    const onImport = vi.fn();

    render(
      <ImportCaseDialog busy={false} onImport={onImport} onClose={vi.fn()} />,
    );
    fireEvent.click(await screen.findByText("案件库"));
    fireEvent.click(await screen.findByRole("button", { name: "解析" }));

    fireEvent.change(await screen.findByLabelText("当事人立场：张三"), {
      target: { value: "our" },
    });
    fireEvent.change(screen.getByLabelText("当事人立场：李四"), {
      target: { value: "opposing" },
    });
    fireEvent.click(screen.getByRole("button", { name: "确认导入" }));

    expect(onImport).toHaveBeenCalledTimes(1);
    const forms = onImport.mock.calls[0][0] as ImportCaseForm[];
    expect(forms).toHaveLength(1);
    expect(forms[0].title).toBe("张三诉李四民间借贷纠纷");
    expect(forms[0].parties.map((p) => p.side)).toEqual(["our", "opposing"]);
    // 默认不补齐骨架
    expect(forms[0].createSkeleton).toBe(false);
  });

  it("blocks confirm when the title is cleared", async () => {
    vi.mocked(listAlphaboxSyncRoots).mockResolvedValue([SYNC_ROOT]);
    vi.mocked(scanCaseCandidates).mockResolvedValue([makeCandidate()]);
    vi.mocked(parseCaseFolder).mockResolvedValue(makeDraft());
    const onImport = vi.fn();

    render(
      <ImportCaseDialog busy={false} onImport={onImport} onClose={vi.fn()} />,
    );
    fireEvent.click(await screen.findByText("案件库"));
    fireEvent.click(await screen.findByRole("button", { name: "解析" }));

    fireEvent.change(await screen.findByLabelText("案件名"), {
      target: { value: "  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "确认导入" }));
    expect(await screen.findByText("请填写案件名")).toBeTruthy();
    expect(onImport).not.toHaveBeenCalled();
  });
});

describe("ImportCaseDialog - local folder tab", () => {
  it("parses a single picked folder into the confirm form", async () => {
    vi.mocked(open).mockResolvedValue("/cases/单个案件");
    vi.mocked(parseCaseFolder).mockResolvedValue(makeDraft());

    render(<ImportCaseDialog busy={false} onImport={vi.fn()} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("tab", { name: "本地文件夹" }));
    fireEvent.click(screen.getByRole("button", { name: "选择文件夹" }));

    await waitFor(() =>
      expect(parseCaseFolder).toHaveBeenCalledWith("/cases/单个案件"),
    );
    expect(await screen.findByLabelText("案件名")).toBeTruthy();
  });

  it("batch mode scans the parent dir, parses rows and imports the checked ones", async () => {
    vi.mocked(open).mockResolvedValue("/cases");
    const first = makeCandidate({ path: "/cases/甲案", name: "甲案" });
    const second = makeCandidate({ path: "/cases/乙案", name: "乙案" });
    vi.mocked(scanCaseCandidates).mockResolvedValue([first, second]);
    vi.mocked(parseCaseFolder).mockImplementation(async (dir: string) =>
      makeDraft({
        titleSuggestion: dir === "/cases/甲案" ? "甲案" : "乙案",
      }),
    );
    const onImport = vi.fn();

    render(
      <ImportCaseDialog busy={false} onImport={onImport} onClose={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole("tab", { name: "本地文件夹" }));
    fireEvent.click(screen.getByLabelText("这是多个案件的父目录"));
    fireEvent.click(screen.getByRole("button", { name: "选择文件夹" }));

    await waitFor(() => expect(scanCaseCandidates).toHaveBeenCalledWith("/cases"));
    // 两行都解析完成并默认勾选
    await screen.findByLabelText("案件名：甲案");
    await screen.findByLabelText("案件名：乙案");
    expect(
      await screen.findByRole("button", { name: "导入所选（2）" }),
    ).toBeTruthy();

    // 逐行可改案件名 + 取消勾选第二行
    fireEvent.change(screen.getByLabelText("案件名：甲案"), {
      target: { value: "甲案（改名）" },
    });
    fireEvent.click(screen.getByLabelText("选择 乙案"));
    fireEvent.click(screen.getByRole("button", { name: "导入所选（1）" }));

    expect(onImport).toHaveBeenCalledTimes(1);
    const forms = onImport.mock.calls[0][0] as ImportCaseForm[];
    expect(forms).toHaveLength(1);
    expect(forms[0].title).toBe("甲案（改名）");
    expect(forms[0].dirPath).toBe("/cases/甲案");
  });
});
