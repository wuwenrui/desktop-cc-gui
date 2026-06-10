import { useState } from "react";
import { CASE_STAGES, type CaseStage } from "./caseRegistry";
import { CASE_STAGE_LABELS } from "./caseActions";
import type { ImportCaseForm, PartySide } from "./caseImport";

/**
 * 导入确认页：解析结果预填表单，每个字段旁灰字标来源。
 * 当事人不猜立场——逐行由律师指定我方/对方。
 */

type ImportConfirmFormProps = {
  initialForm: ImportCaseForm;
  busy: boolean;
  onBack: () => void;
  onConfirm: (form: ImportCaseForm) => void;
};

function SourceTag({ source }: { source: string | null }) {
  if (!source) {
    return null;
  }
  return <span className="lawyer-shell-source-tag">来自 {source}</span>;
}

const PARTY_SIDE_LABELS: Record<PartySide, string> = {
  none: "不指定",
  our: "我方",
  opposing: "对方",
};

export function ImportConfirmForm({
  initialForm,
  busy,
  onBack,
  onConfirm,
}: ImportConfirmFormProps) {
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState<string | null>(null);

  const patch = (next: Partial<ImportCaseForm>) =>
    setForm((prev) => ({ ...prev, ...next }));

  const setPartySide = (index: number, side: PartySide) =>
    setForm((prev) => ({
      ...prev,
      parties: prev.parties.map((party, i) =>
        i === index ? { ...party, side } : party,
      ),
    }));

  const confirm = () => {
    if (!form.title.trim()) {
      setError("请填写案件名");
      return;
    }
    setError(null);
    onConfirm(form);
  };

  return (
    <div className="lawyer-shell-form">
      <div className="lawyer-shell-import-dir">导入目录：{form.dirPath}</div>

      <label className="lawyer-shell-field">
        <span>
          案件名（必填）
          <SourceTag source="自动建议" />
        </span>
        <input
          aria-label="案件名"
          value={form.title}
          onChange={(e) => patch({ title: e.target.value })}
        />
      </label>

      <label className="lawyer-shell-field">
        <span>
          案号
          <SourceTag source={form.sources.caseNo} />
        </span>
        <input
          aria-label="案号"
          placeholder={form.sources.caseNo ? "" : "未解析到，可手动填写"}
          value={form.caseNo}
          onChange={(e) => patch({ caseNo: e.target.value })}
        />
      </label>

      <label className="lawyer-shell-field">
        <span>
          案由
          <SourceTag source={form.sources.causeOfAction} />
        </span>
        <input
          aria-label="案由"
          placeholder={form.sources.causeOfAction ? "" : "未解析到，可手动填写"}
          value={form.causeOfAction}
          onChange={(e) => patch({ causeOfAction: e.target.value })}
        />
      </label>

      <label className="lawyer-shell-field">
        <span>
          法院
          <SourceTag source={form.sources.courtName} />
        </span>
        <input
          aria-label="法院"
          placeholder={form.sources.courtName ? "" : "未解析到，可手动填写"}
          value={form.courtName}
          onChange={(e) => patch({ courtName: e.target.value })}
        />
      </label>

      <label className="lawyer-shell-field">
        <span>阶段</span>
        <select
          aria-label="阶段"
          value={form.stage}
          onChange={(e) => patch({ stage: e.target.value as CaseStage })}
        >
          {CASE_STAGES.map((stage) => (
            <option key={stage} value={stage}>
              {CASE_STAGE_LABELS[stage]}
            </option>
          ))}
        </select>
        {form.stageEvidence.length > 0 && (
          <span className="lawyer-shell-evidence">
            推断依据：{form.stageEvidence.join("；")}
          </span>
        )}
      </label>

      <div className="lawyer-shell-field">
        <span>当事人（请指定我方/对方）</span>
        {form.parties.length === 0 && (
          <span className="lawyer-shell-evidence">
            未解析到当事人，可在导入后于案件信息中补填
          </span>
        )}
        {form.parties.map((party, index) => (
          <div
            className="lawyer-shell-party-row"
            key={`${party.role}-${party.name}`}
          >
            <span className="lawyer-shell-party-role">{party.role}</span>
            <span className="lawyer-shell-party-name">{party.name}</span>
            <select
              aria-label={`当事人立场：${party.name}`}
              value={party.side}
              onChange={(e) => setPartySide(index, e.target.value as PartySide)}
            >
              {(Object.keys(PARTY_SIDE_LABELS) as PartySide[]).map((side) => (
                <option key={side} value={side}>
                  {PARTY_SIDE_LABELS[side]}
                </option>
              ))}
            </select>
            <SourceTag source={party.sourceFile} />
          </div>
        ))}
      </div>

      <label className="lawyer-shell-checkbox-row">
        <input
          type="checkbox"
          aria-label="补齐标准子目录"
          checked={form.createSkeleton}
          onChange={(e) => patch({ createSkeleton: e.target.checked })}
        />
        <span>补齐标准子目录（起诉材料/证据材料/文书/沟通记录/庭审/结案）</span>
      </label>

      {form.notes.length > 0 && (
        <div className="lawyer-shell-import-notes">
          {form.notes.map((note) => (
            <div key={note}>{note}</div>
          ))}
        </div>
      )}

      {error && <div className="lawyer-shell-error">{error}</div>}

      <div className="lawyer-shell-dialog-actions">
        <button type="button" onClick={onBack} disabled={busy}>
          返回
        </button>
        <button
          type="button"
          className="lawyer-shell-primary"
          onClick={confirm}
          disabled={busy}
        >
          {busy ? "导入中…" : "确认导入"}
        </button>
      </div>
    </div>
  );
}
