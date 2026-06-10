import "./lawyer-shell.css";
import FolderInput from "lucide-react/dist/esm/icons/folder-input";
import Plus from "lucide-react/dist/esm/icons/plus";
import { useCallback, useState } from "react";
import { ensureWorkspacePathDir } from "../../services/tauri/workspaceRuntime";
import {
  CASE_DIR_SKELETON,
  CASE_QUICK_ACTIONS,
  CASE_STAGE_LABELS,
  dispatchCaseSkillDeferred,
  type CaseQuickAction,
} from "./caseActions";
import { importFormToNewCaseInput, type ImportCaseForm } from "./caseImport";
import {
  createCaseRecord,
  loadCases,
  saveCases,
  sortCasesByRecency,
  touchCaseOpened,
  upsertCase,
  type CaseRecord,
} from "./caseRegistry";
import { ImportCaseDialog } from "./ImportCaseDialog";
import { NewCaseDialog, type NewCaseFormValues } from "./NewCaseDialog";

/**
 * 律师首页「我的案件」：案件卡片列表 + 导入案件向导（主入口）+ 新建案件向导。
 *
 * 导入流程：解析已有材料文件夹（Rust `parse_case_folder`，零写入）→ 律师确认
 * → 写登记表（workspacePath = 原目录，origin: "imported"）→ 打开工作区。
 * 默认不在原目录创建骨架子目录（确认页可选开启）。
 *
 * 新建流程：建工作区目录 + 标准目录骨架（复用 `ensure_workspace_path_dir`，
 * 递归创建）→ 写本地案件登记表 → 通过 onOpenCaseWorkspace 注册并打开工作区。
 */

type CaseHomePageProps = {
  /** 把目录注册为 workspace 并激活（由 app shell 的 addWorkspaceFromPath 提供）。 */
  onOpenCaseWorkspace: (path: string) => Promise<void> | void;
};

function joinPath(base: string, name: string): string {
  return `${base.replace(/\/+$/, "")}/${name}`;
}

function formatRecency(record: CaseRecord): string {
  const timestamp = record.lastOpenedAt ?? record.updatedAt;
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toLocaleString("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function CaseHomePage({ onOpenCaseWorkspace }: CaseHomePageProps) {
  const [cases, setCases] = useState<CaseRecord[]>(() => loadCases());
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const persist = useCallback((next: CaseRecord[]) => {
    setCases(next);
    saveCases(next);
  }, []);

  const openCase = useCallback(
    async (record: CaseRecord) => {
      persist(touchCaseOpened(cases, record.id));
      try {
        await onOpenCaseWorkspace(record.workspacePath);
      } catch {
        setStatus(`打开工作区失败：${record.title}`);
      }
    },
    [cases, onOpenCaseWorkspace, persist],
  );

  const runQuickAction = useCallback(
    async (record: CaseRecord, action: CaseQuickAction) => {
      await openCase(record);
      // 接线点：见 caseActions.ts —— 延迟派发等待 Composer 挂载。
      dispatchCaseSkillDeferred(action.skillName);
    },
    [openCase],
  );

  const createCase = useCallback(
    async (values: NewCaseFormValues) => {
      const workspacePath = joinPath(values.baseDir, values.title);
      await ensureWorkspacePathDir(workspacePath);
      for (const dir of CASE_DIR_SKELETON) {
        await ensureWorkspacePathDir(joinPath(workspacePath, dir));
      }
      const record = createCaseRecord({
        title: values.title,
        parties: { our: values.our, opposing: values.opposing },
        causeOfAction: values.causeOfAction,
        workspacePath,
      });
      persist(upsertCase(cases, record));
      setIsWizardOpen(false);
      await onOpenCaseWorkspace(workspacePath);
    },
    [cases, onOpenCaseWorkspace, persist],
  );

  /**
   * 导入确认（单个或批量）：可选补齐骨架 → 一次性写登记表。
   * 单个导入直接打开工作区；批量导入只提示数量，由律师从卡片进入。
   */
  const importCases = useCallback(
    async (forms: ImportCaseForm[]) => {
      if (forms.length === 0) {
        return;
      }
      setImportBusy(true);
      try {
        let next = cases;
        for (const form of forms) {
          if (form.createSkeleton) {
            for (const dir of CASE_DIR_SKELETON) {
              await ensureWorkspacePathDir(joinPath(form.dirPath, dir));
            }
          }
          next = upsertCase(next, createCaseRecord(importFormToNewCaseInput(form)));
        }
        persist(next);
        setIsImportOpen(false);
        if (forms.length === 1) {
          await onOpenCaseWorkspace(forms[0].dirPath);
        } else {
          setStatus(`已导入 ${forms.length} 个案件`);
        }
      } catch (e) {
        setStatus(e instanceof Error ? e.message : "导入案件失败");
      }
      setImportBusy(false);
    },
    [cases, onOpenCaseWorkspace, persist],
  );

  const sortedCases = sortCasesByRecency(cases);

  return (
    <div className="lawyer-shell-home">
      <div className="lawyer-shell-home-header">
        <h2>我的案件</h2>
        <div className="lawyer-shell-home-actions">
          <button
            type="button"
            className="lawyer-shell-primary"
            onClick={() => setIsImportOpen(true)}
          >
            <FolderInput size={16} aria-hidden />
            <span>导入案件</span>
          </button>
          <button
            type="button"
            className="lawyer-shell-secondary"
            onClick={() => setIsWizardOpen(true)}
          >
            <Plus size={16} aria-hidden />
            <span>新建案件</span>
          </button>
        </div>
      </div>

      {sortedCases.length === 0 && (
        <div className="lawyer-shell-empty">
          还没有案件。推荐点「导入案件」从已有材料文件夹自动建案，也可以「新建案件」从零开始
        </div>
      )}

      <div className="lawyer-shell-case-list">
        {sortedCases.map((record) => (
          <div className="lawyer-shell-case-card" key={record.id}>
            <button
              type="button"
              className="lawyer-shell-case-main"
              onClick={() => void openCase(record)}
              title={`打开案件工作区：${record.workspacePath}`}
            >
              <div className="lawyer-shell-case-title-row">
                <span className="lawyer-shell-case-title">{record.title}</span>
                <span className="lawyer-shell-stage-badge">
                  {CASE_STAGE_LABELS[record.stage]}
                </span>
              </div>
              <div className="lawyer-shell-case-meta">
                {(record.parties.our || record.parties.opposing) && (
                  <span>
                    {record.parties.our || "（我方）"} 诉{" "}
                    {record.parties.opposing || "（对方）"}
                  </span>
                )}
                {record.causeOfAction && <span>{record.causeOfAction}</span>}
                {record.lastOpenedAt && (
                  <span>最近打开 {formatRecency(record)}</span>
                )}
              </div>
            </button>
            <div className="lawyer-shell-case-actions">
              {CASE_QUICK_ACTIONS.map((action) => (
                <button
                  type="button"
                  key={action.id}
                  onClick={() => void runQuickAction(record, action)}
                  title={`打开工作区并引用 skill「${action.skillName}」`}
                >
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {status && <div className="lawyer-shell-error">{status}</div>}

      {isWizardOpen && (
        <NewCaseDialog
          onSubmit={createCase}
          onClose={() => setIsWizardOpen(false)}
        />
      )}

      {isImportOpen && (
        <ImportCaseDialog
          busy={importBusy}
          onImport={(forms) => void importCases(forms)}
          onClose={() => setIsImportOpen(false)}
        />
      )}
    </div>
  );
}
