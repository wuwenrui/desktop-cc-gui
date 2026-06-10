/** @vitest-environment jsdom */
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CaseHomePage } from "./CaseHomePage";
import { SELECT_SKILL_EVENT } from "../lawhub/pptSkill";
import { ensureWorkspacePathDir } from "../../services/tauri/workspaceRuntime";
import {
  getClientStoreSync,
  writeClientStoreValue,
} from "../../services/clientStorage";
import { createCaseRecord, type CaseRecord } from "./caseRegistry";
import { draftToImportForm, type CaseDraft, type ImportCaseForm } from "./caseImport";

vi.mock("../../services/tauri/workspaceRuntime", () => ({
  ensureWorkspacePathDir: vi.fn(),
}));
vi.mock("../../services/clientStorage", () => ({
  getClientStoreSync: vi.fn(),
  writeClientStoreValue: vi.fn(),
}));
vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(),
}));
// 导入对话框本体在 ImportCaseDialog.test.tsx 单测；这里打桩拿到 props 驱动编排逻辑。
type ImportDialogStubProps = {
  busy: boolean;
  onImport: (forms: unknown[]) => void;
  onClose: () => void;
};
const mockImportDialogProps = vi.hoisted(() => ({
  current: null as {
    busy: boolean;
    onImport: (forms: unknown[]) => void;
    onClose: () => void;
  } | null,
}));
vi.mock("./ImportCaseDialog", () => ({
  ImportCaseDialog: (props: ImportDialogStubProps) => {
    mockImportDialogProps.current = props;
    return <div>导入案件对话框</div>;
  },
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
  vi.mocked(getClientStoreSync).mockReturnValue(undefined);
  vi.mocked(ensureWorkspacePathDir).mockResolvedValue(undefined);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("CaseHomePage", () => {
  it("renders empty state when the registry is empty", () => {
    render(<CaseHomePage onOpenCaseWorkspace={vi.fn()} />);
    expect(
      screen.getByText(/还没有案件。推荐点「导入案件」/),
    ).toBeTruthy();
  });

  it("renders case cards with title, parties and stage badge", () => {
    vi.mocked(getClientStoreSync).mockReturnValue([makeCase()]);
    render(<CaseHomePage onOpenCaseWorkspace={vi.fn()} />);
    expect(screen.getByText("张三诉李四民间借贷纠纷")).toBeTruthy();
    expect(screen.getByText("张三 诉 李四")).toBeTruthy();
    expect(screen.getByText("接案")).toBeTruthy();
  });

  it("clicking a case card opens its workspace and touches lastOpenedAt", async () => {
    const record = makeCase();
    vi.mocked(getClientStoreSync).mockReturnValue([record]);
    const onOpen = vi.fn();
    render(<CaseHomePage onOpenCaseWorkspace={onOpen} />);
    fireEvent.click(screen.getByText("张三诉李四民间借贷纠纷"));
    await waitFor(() =>
      expect(onOpen).toHaveBeenCalledWith(record.workspacePath),
    );
    const written = vi.mocked(writeClientStoreValue).mock
      .calls[0]?.[2] as CaseRecord[];
    expect(written[0].lastOpenedAt).not.toBeNull();
  });

  it("quick action opens the workspace and dispatches the skill event (deferred)", async () => {
    const record = makeCase();
    vi.mocked(getClientStoreSync).mockReturnValue([record]);
    const onOpen = vi.fn();
    const onSkill = vi.fn();
    window.addEventListener(SELECT_SKILL_EVENT, onSkill as EventListener);
    render(<CaseHomePage onOpenCaseWorkspace={onOpen} />);

    fireEvent.click(screen.getByRole("button", { name: "起草文书" }));
    await waitFor(() =>
      expect(onOpen).toHaveBeenCalledWith(record.workspacePath),
    );
    await waitFor(
      () => expect(onSkill).toHaveBeenCalledTimes(1),
      { timeout: 3000 },
    );
    const detail = (onSkill.mock.calls[0][0] as CustomEvent).detail;
    expect(detail).toEqual({ name: "民事起诉状" });
    window.removeEventListener(SELECT_SKILL_EVENT, onSkill as EventListener);
  });

  it("wizard validates required fields before creating anything", async () => {
    render(<CaseHomePage onOpenCaseWorkspace={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /新建案件/ }));
    fireEvent.click(screen.getByRole("button", { name: "创建案件" }));
    expect(await screen.findByText("请填写案件名")).toBeTruthy();
    expect(ensureWorkspacePathDir).not.toHaveBeenCalled();
    expect(writeClientStoreValue).not.toHaveBeenCalled();
  });

  it("wizard creates skeleton dirs, persists the case and opens the workspace", async () => {
    const onOpen = vi.fn();
    render(<CaseHomePage onOpenCaseWorkspace={onOpen} />);
    fireEvent.click(screen.getByRole("button", { name: /新建案件/ }));

    fireEvent.change(screen.getByLabelText("案件名"), {
      target: { value: "王五诉赵六合同纠纷" },
    });
    fireEvent.change(screen.getByLabelText("我方当事人"), {
      target: { value: "王五" },
    });
    fireEvent.change(screen.getByLabelText("对方当事人"), {
      target: { value: "赵六" },
    });
    fireEvent.change(screen.getByLabelText("案由"), {
      target: { value: "合同纠纷" },
    });
    fireEvent.change(screen.getByLabelText("存放目录"), {
      target: { value: "/Users/lawyer/cases" },
    });
    fireEvent.click(screen.getByRole("button", { name: "创建案件" }));

    const workspacePath = "/Users/lawyer/cases/王五诉赵六合同纠纷";
    await waitFor(() => expect(onOpen).toHaveBeenCalledWith(workspacePath));

    // 目录骨架：案件根目录 + 六个子目录
    const ensuredPaths = vi
      .mocked(ensureWorkspacePathDir)
      .mock.calls.map((call) => call[0]);
    expect(ensuredPaths).toEqual([
      workspacePath,
      `${workspacePath}/起诉材料`,
      `${workspacePath}/证据材料`,
      `${workspacePath}/文书`,
      `${workspacePath}/沟通记录`,
      `${workspacePath}/庭审`,
      `${workspacePath}/结案`,
    ]);

    // 注册表落盘
    const written = vi.mocked(writeClientStoreValue).mock
      .calls[0]?.[2] as CaseRecord[];
    expect(written).toHaveLength(1);
    expect(written[0].title).toBe("王五诉赵六合同纠纷");
    expect(written[0].stage).toBe("intake");
    expect(written[0].workspacePath).toBe(workspacePath);

    // 列表立即可见
    expect(await screen.findByText("王五诉赵六合同纠纷")).toBeTruthy();
  });
});

function makeImportForm(overrides: Partial<ImportCaseForm> = {}): ImportCaseForm {
  const draft: CaseDraft = {
    titleSuggestion: "导入的案件",
    caseNo: {
      value: "（2023）京01民初1号",
      sourceFile: "受理通知书.txt",
      confidence: "high",
    },
    causeOfAction: null,
    courtName: null,
    stageSuggestion: "filed",
    stageEvidence: [],
    parties: [],
    scannedFiles: [],
    skippedPdfCount: 0,
    notes: [],
  };
  return { ...draftToImportForm("/cases/导入的案件", draft), ...overrides };
}

describe("CaseHomePage - 导入案件", () => {
  it("renders the import button as the primary entry and opens the dialog", () => {
    render(<CaseHomePage onOpenCaseWorkspace={vi.fn()} />);
    const importButton = screen.getByRole("button", { name: /导入案件/ });
    expect(importButton.className).toContain("lawyer-shell-primary");
    // 新建案件降级为次按钮
    expect(
      screen.getByRole("button", { name: /新建案件/ }).className,
    ).toContain("lawyer-shell-secondary");
    fireEvent.click(importButton);
    expect(screen.getByText("导入案件对话框")).toBeTruthy();
  });

  it("single import persists the record (origin imported) and opens the workspace without creating dirs", async () => {
    const onOpen = vi.fn();
    render(<CaseHomePage onOpenCaseWorkspace={onOpen} />);
    fireEvent.click(screen.getByRole("button", { name: /导入案件/ }));

    act(() => {
      mockImportDialogProps.current?.onImport([makeImportForm()]);
    });

    await waitFor(() => expect(onOpen).toHaveBeenCalledWith("/cases/导入的案件"));
    // 默认不补齐骨架 → 不创建任何目录
    expect(ensureWorkspacePathDir).not.toHaveBeenCalled();
    const written = vi.mocked(writeClientStoreValue).mock
      .calls[0]?.[2] as CaseRecord[];
    expect(written).toHaveLength(1);
    expect(written[0].title).toBe("导入的案件");
    expect(written[0].origin).toBe("imported");
    expect(written[0].stage).toBe("filed");
    expect(written[0].caseNo).toBe("（2023）京01民初1号");
    expect(written[0].workspacePath).toBe("/cases/导入的案件");
  });

  it("creates the skeleton when requested on import", async () => {
    const onOpen = vi.fn();
    render(<CaseHomePage onOpenCaseWorkspace={onOpen} />);
    fireEvent.click(screen.getByRole("button", { name: /导入案件/ }));

    act(() => {
      mockImportDialogProps.current?.onImport([
        makeImportForm({ createSkeleton: true }),
      ]);
    });

    await waitFor(() => expect(onOpen).toHaveBeenCalled());
    const ensured = vi
      .mocked(ensureWorkspacePathDir)
      .mock.calls.map((call) => call[0]);
    expect(ensured).toContain("/cases/导入的案件/起诉材料");
    expect(ensured).toContain("/cases/导入的案件/结案");
  });

  it("batch import persists all records without opening a workspace", async () => {
    const onOpen = vi.fn();
    render(<CaseHomePage onOpenCaseWorkspace={onOpen} />);
    fireEvent.click(screen.getByRole("button", { name: /导入案件/ }));

    act(() => {
      mockImportDialogProps.current?.onImport([
        makeImportForm({ dirPath: "/cases/甲案", title: "甲案" }),
        makeImportForm({ dirPath: "/cases/乙案", title: "乙案" }),
      ]);
    });

    expect(await screen.findByText("已导入 2 个案件")).toBeTruthy();
    expect(onOpen).not.toHaveBeenCalled();
    const written = vi.mocked(writeClientStoreValue).mock
      .calls[0]?.[2] as CaseRecord[];
    expect(written.map((record) => record.title)).toEqual(["甲案", "乙案"]);
  });
});
