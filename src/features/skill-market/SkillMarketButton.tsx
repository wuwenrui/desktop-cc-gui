import { useState } from "react";
import { SkillMarketPanel } from "./SkillMarketPanel";

/**
 * 顶栏入口：点击打开 Skill 市场面板（轻量 overlay）。
 *
 * 新增文件（fork-friendly）：作为单个按钮挂到 `MainTopbar` 的 actions 槽，
 * 不改 app-shell / 布局组件。
 */
export function SkillMarketButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="skill-market-entry"
        title="浏览并安装 skill"
        onClick={() => setOpen(true)}
      >
        Skill 市场
      </button>
      {open && (
        <div
          className="skill-market-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Skill 市场"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setOpen(false);
            }
          }}
        >
          <div className="skill-market-dialog">
            <div className="skill-market-dialog-header">
              <span>Skill 市场</span>
              <button
                type="button"
                aria-label="关闭"
                onClick={() => setOpen(false)}
              >
                关闭
              </button>
            </div>
            <SkillMarketPanel />
          </div>
        </div>
      )}
    </>
  );
}
