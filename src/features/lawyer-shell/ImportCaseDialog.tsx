import { useCallback, useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import {
  draftToImportForm,
  listAlphaboxSyncRoots,
  parseCaseFolder,
  scanCaseCandidates,
  type CandidateDir,
  type ImportCaseForm,
  type SyncRoot,
} from "./caseImport";
import { BatchImportTable } from "./BatchImportTable";
import { ImportConfirmForm } from "./ImportConfirmForm";

/**
 * 导入案件向导：从已有案件材料文件夹解析案件信息建案。
 *
 * 两个入口：
 * - AlphaBox 同步库：列已同步资料库 → 子目录候选 → 逐个解析确认；
 * - 本地文件夹：单目录直接解析，或勾选「多个案件的父目录」走批量模式。
 */

const ALPHABOX_EMPTY_COPY =
  "尚未在本机同步任何 AlphaBox 资料库。在 AlphaBox 客户端把案件库同步到本地后，这里会自动列出。也可以直接选择本地文件夹导入。";

type ImportTab = "alphabox" | "local";

type ImportView =
  | { kind: "pick" }
  | { kind: "candidates"; parent: string; candidates: CandidateDir[] }
  | { kind: "batch"; candidates: CandidateDir[] }
  | { kind: "confirm"; form: ImportCaseForm };

type ImportCaseDialogProps = {
  busy: boolean;
  /** 确认导入（单个或批量）。注册表写入与打开工作区由 CaseHomePage 编排。 */
  onImport: (forms: ImportCaseForm[]) => void;
  onClose: () => void;
};

export function ImportCaseDialog({
  busy,
  onImport,
  onClose,
}: ImportCaseDialogProps) {
  const [tab, setTab] = useState<ImportTab>("alphabox");
  const [view, setView] = useState<ImportView>({ kind: "pick" });
  const [syncRoots, setSyncRoots] = useState<SyncRoot[] | null>(null);
  const [batchMode, setBatchMode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listAlphaboxSyncRoots()
      .then((roots) => {
        if (!cancelled) {
          setSyncRoots(roots);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSyncRoots([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const scanParent = useCallback(async (parent: string, batch: boolean) => {
    setWorking(true);
    setError(null);
    try {
      const candidates = await scanCaseCandidates(parent);
      setView(
        batch
          ? { kind: "batch", candidates }
          : { kind: "candidates", parent, candidates },
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "扫描目录失败");
    }
    setWorking(false);
  }, []);

  const parseSingle = useCallback(async (dir: string) => {
    setWorking(true);
    setError(null);
    try {
      const draft = await parseCaseFolder(dir);
      setView({ kind: "confirm", form: draftToImportForm(dir, draft) });
    } catch (e) {
      setError(e instanceof Error ? e.message : "解析文件夹失败");
    }
    setWorking(false);
  }, []);

  const pickLocalDir = useCallback(async () => {
    let selection: unknown;
    try {
      selection = await open({ directory: true, multiple: false });
    } catch {
      setError("无法打开目录选择器");
      return;
    }
    if (typeof selection !== "string" || !selection) {
      return;
    }
    if (batchMode) {
      await scanParent(selection, true);
    } else {
      await parseSingle(selection);
    }
  }, [batchMode, parseSingle, scanParent]);

  const renderAlphaboxPick = () => {
    if (syncRoots === null) {
      return <div className="lawyer-shell-empty">正在读取同步库…</div>;
    }
    if (syncRoots.length === 0) {
      return <div className="lawyer-shell-empty">{ALPHABOX_EMPTY_COPY}</div>;
    }
    return (
      <div className="lawyer-shell-root-list">
        {syncRoots.map((root) => (
          <button
            type="button"
            className="lawyer-shell-root-card"
            key={root.localRootPath}
            disabled={working}
            onClick={() => void scanParent(root.localRootPath, false)}
          >
            <span className="lawyer-shell-root-name">{root.remoteName}</span>
            <span className="lawyer-shell-root-path">{root.localRootPath}</span>
          </button>
        ))}
      </div>
    );
  };

  const renderLocalPick = () => (
    <div className="lawyer-shell-local-pick">
      <label className="lawyer-shell-checkbox-row">
        <input
          type="checkbox"
          aria-label="这是多个案件的父目录"
          checked={batchMode}
          onChange={(e) => setBatchMode(e.target.checked)}
        />
        <span>这是多个案件的父目录（批量导入）</span>
      </label>
      <button
        type="button"
        className="lawyer-shell-primary"
        disabled={working}
        onClick={() => void pickLocalDir()}
      >
        {working ? "处理中…" : "选择文件夹"}
      </button>
    </div>
  );

  const renderCandidates = (candidates: CandidateDir[]) => (
    <div className="lawyer-shell-form">
      {candidates.length === 0 && (
        <div className="lawyer-shell-empty">该库下没有子文件夹</div>
      )}
      <div className="lawyer-shell-batch-list">
        {candidates.map((candidate) => (
          <div className="lawyer-shell-batch-row" key={candidate.path}>
            <div className="lawyer-shell-batch-main">
              <span className="lawyer-shell-batch-name">{candidate.name}</span>
              <span className="lawyer-shell-batch-meta">
                {candidate.fileCount} 个文件
              </span>
            </div>
            <button
              type="button"
              disabled={working}
              onClick={() => void parseSingle(candidate.path)}
            >
              解析
            </button>
          </div>
        ))}
      </div>
      <div className="lawyer-shell-dialog-actions">
        <button
          type="button"
          onClick={() => setView({ kind: "pick" })}
          disabled={working}
        >
          返回
        </button>
      </div>
    </div>
  );

  const renderBody = () => {
    if (view.kind === "confirm") {
      return (
        <ImportConfirmForm
          initialForm={view.form}
          busy={busy}
          onBack={() => setView({ kind: "pick" })}
          onConfirm={(form) => onImport([form])}
        />
      );
    }
    if (view.kind === "batch") {
      return (
        <BatchImportTable
          candidates={view.candidates}
          busy={busy}
          onBack={() => setView({ kind: "pick" })}
          onImport={onImport}
        />
      );
    }
    if (view.kind === "candidates") {
      return renderCandidates(view.candidates);
    }
    return (
      <div className="lawyer-shell-form">
        <div className="lawyer-shell-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "alphabox"}
            className={tab === "alphabox" ? "lawyer-shell-tab-active" : ""}
            onClick={() => setTab("alphabox")}
          >
            AlphaBox 同步库
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "local"}
            className={tab === "local" ? "lawyer-shell-tab-active" : ""}
            onClick={() => setTab("local")}
          >
            本地文件夹
          </button>
        </div>
        {tab === "alphabox" ? renderAlphaboxPick() : renderLocalPick()}
      </div>
    );
  };

  return (
    <div
      className="lawyer-shell-dialog-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="导入案件"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy && !working) {
          onClose();
        }
      }}
    >
      <div className="lawyer-shell-dialog lawyer-shell-dialog-wide">
        <div className="lawyer-shell-dialog-header">
          <span>导入案件</span>
          <button
            type="button"
            aria-label="关闭"
            onClick={onClose}
            disabled={busy}
          >
            关闭
          </button>
        </div>
        {error && (
          <div className="lawyer-shell-error lawyer-shell-dialog-error">
            {error}
          </div>
        )}
        {renderBody()}
      </div>
    </div>
  );
}
