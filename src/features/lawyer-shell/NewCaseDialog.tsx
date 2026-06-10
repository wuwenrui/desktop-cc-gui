import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";

/**
 * 新建案件向导（单弹窗）：案件名 / 我方 / 对方 / 案由 / 存放目录。
 * 只负责收集与校验输入，目录骨架与注册表写入由 CaseHomePage 编排。
 */

export type NewCaseFormValues = {
  title: string;
  our: string;
  opposing: string;
  causeOfAction: string;
  /** 案件工作区的父目录（实际工作区为 `${baseDir}/${title}`） */
  baseDir: string;
};

type NewCaseDialogProps = {
  onSubmit: (values: NewCaseFormValues) => Promise<void>;
  onClose: () => void;
};

export function NewCaseDialog({ onSubmit, onClose }: NewCaseDialogProps) {
  const [title, setTitle] = useState("");
  const [our, setOur] = useState("");
  const [opposing, setOpposing] = useState("");
  const [causeOfAction, setCauseOfAction] = useState("");
  const [baseDir, setBaseDir] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const pickBaseDir = async () => {
    try {
      const selection = await open({ directory: true, multiple: false });
      if (typeof selection === "string" && selection) {
        setBaseDir(selection);
      }
    } catch {
      setError("无法打开目录选择器");
    }
  };

  const submit = async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError("请填写案件名");
      return;
    }
    if (!baseDir.trim()) {
      setError("请选择存放目录");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await onSubmit({
        title: trimmedTitle,
        our: our.trim(),
        opposing: opposing.trim(),
        causeOfAction: causeOfAction.trim(),
        baseDir: baseDir.trim(),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "创建案件失败");
      setBusy(false);
      return;
    }
    setBusy(false);
  };

  return (
    <div
      className="lawyer-shell-dialog-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="新建案件"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) {
          onClose();
        }
      }}
    >
      <div className="lawyer-shell-dialog">
        <div className="lawyer-shell-dialog-header">
          <span>新建案件</span>
          <button type="button" aria-label="关闭" onClick={onClose} disabled={busy}>
            关闭
          </button>
        </div>
        <div className="lawyer-shell-form">
          <label className="lawyer-shell-field">
            <span>案件名（必填）</span>
            <input
              aria-label="案件名"
              placeholder="如：张三诉李四民间借贷纠纷"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <label className="lawyer-shell-field">
            <span>我方当事人</span>
            <input
              aria-label="我方当事人"
              value={our}
              onChange={(e) => setOur(e.target.value)}
            />
          </label>
          <label className="lawyer-shell-field">
            <span>对方当事人</span>
            <input
              aria-label="对方当事人"
              value={opposing}
              onChange={(e) => setOpposing(e.target.value)}
            />
          </label>
          <label className="lawyer-shell-field">
            <span>案由</span>
            <input
              aria-label="案由"
              placeholder="如：民间借贷纠纷"
              value={causeOfAction}
              onChange={(e) => setCauseOfAction(e.target.value)}
            />
          </label>
          <div className="lawyer-shell-field">
            <span>存放目录（必填）</span>
            <div className="lawyer-shell-dir-row">
              <input
                aria-label="存放目录"
                placeholder="点击「选择目录」"
                value={baseDir}
                onChange={(e) => setBaseDir(e.target.value)}
              />
              <button type="button" onClick={() => void pickBaseDir()}>
                选择目录
              </button>
            </div>
          </div>
          {error && <div className="lawyer-shell-error">{error}</div>}
          <div className="lawyer-shell-dialog-actions">
            <button type="button" onClick={onClose} disabled={busy}>
              取消
            </button>
            <button
              type="button"
              className="lawyer-shell-primary"
              onClick={() => void submit()}
              disabled={busy}
            >
              {busy ? "创建中…" : "创建案件"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
