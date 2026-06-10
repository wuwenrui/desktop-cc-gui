import { useEffect, useState } from "react";
import {
  draftToImportForm,
  mapWithConcurrency,
  parseCaseFolder,
  type CandidateDir,
  type ImportCaseForm,
} from "./caseImport";
import { CASE_STAGE_LABELS } from "./caseActions";

/**
 * 批量导入表格：候选目录逐行解析（并发 ≤3），勾选多行批量导入，
 * 逐行可改案件名。当事人立场在批量模式下不指定（导入后可补）。
 */

const PARSE_CONCURRENCY = 3;

type RowStatus = "pending" | "parsing" | "done" | "error";

type BatchRow = {
  candidate: CandidateDir;
  status: RowStatus;
  form: ImportCaseForm | null;
  error: string | null;
  checked: boolean;
};

type BatchImportTableProps = {
  candidates: CandidateDir[];
  busy: boolean;
  onBack: () => void;
  onImport: (forms: ImportCaseForm[]) => void;
};

function statusLabel(row: BatchRow): string {
  switch (row.status) {
    case "pending":
      return "等待解析";
    case "parsing":
      return "解析中…";
    case "error":
      return `解析失败：${row.error ?? "未知错误"}`;
    case "done":
      return row.form
        ? `${CASE_STAGE_LABELS[row.form.stage]}${row.form.caseNo ? ` · ${row.form.caseNo}` : ""}`
        : "已解析";
  }
}

export function BatchImportTable({
  candidates,
  busy,
  onBack,
  onImport,
}: BatchImportTableProps) {
  const [rows, setRows] = useState<BatchRow[]>(() =>
    candidates.map((candidate) => ({
      candidate,
      status: "pending" as const,
      form: null,
      error: null,
      checked: false,
    })),
  );

  useEffect(() => {
    let cancelled = false;
    const patchRow = (index: number, patch: Partial<BatchRow>) => {
      if (cancelled) {
        return;
      }
      setRows((prev) =>
        prev.map((row, i) => (i === index ? { ...row, ...patch } : row)),
      );
    };
    void mapWithConcurrency(candidates, PARSE_CONCURRENCY, async (candidate, index) => {
      patchRow(index, { status: "parsing" });
      try {
        const draft = await parseCaseFolder(candidate.path);
        patchRow(index, {
          status: "done",
          form: draftToImportForm(candidate.path, draft),
          checked: true,
        });
      } catch (e) {
        patchRow(index, {
          status: "error",
          error: e instanceof Error ? e.message : String(e),
        });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [candidates]);

  const setChecked = (index: number, checked: boolean) =>
    setRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, checked } : row)),
    );

  const setTitle = (index: number, title: string) =>
    setRows((prev) =>
      prev.map((row, i) =>
        i === index && row.form
          ? { ...row, form: { ...row.form, title } }
          : row,
      ),
    );

  const selectedForms = rows
    .filter((row) => row.checked && row.status === "done" && row.form)
    .map((row) => row.form as ImportCaseForm);

  return (
    <div className="lawyer-shell-form">
      <div className="lawyer-shell-batch-list">
        {rows.map((row, index) => (
          <div className="lawyer-shell-batch-row" key={row.candidate.path}>
            <input
              type="checkbox"
              aria-label={`选择 ${row.candidate.name}`}
              checked={row.checked}
              disabled={row.status !== "done"}
              onChange={(e) => setChecked(index, e.target.checked)}
            />
            <div className="lawyer-shell-batch-main">
              {row.form ? (
                <input
                  aria-label={`案件名：${row.candidate.name}`}
                  value={row.form.title}
                  onChange={(e) => setTitle(index, e.target.value)}
                />
              ) : (
                <span className="lawyer-shell-batch-name">
                  {row.candidate.name}
                </span>
              )}
              <span className="lawyer-shell-batch-meta">
                {row.candidate.fileCount} 个文件 · {statusLabel(row)}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="lawyer-shell-dialog-actions">
        <button type="button" onClick={onBack} disabled={busy}>
          返回
        </button>
        <button
          type="button"
          className="lawyer-shell-primary"
          onClick={() => onImport(selectedForms)}
          disabled={busy || selectedForms.length === 0}
        >
          {busy ? "导入中…" : `导入所选（${selectedForms.length}）`}
        </button>
      </div>
    </div>
  );
}
