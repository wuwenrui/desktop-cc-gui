import Store from "lucide-react/dist/esm/icons/store";
import { useState } from "react";
import { SkillMarketPanel } from "./SkillMarketPanel";

/**
 * 侧栏主菜单(sidebar-primary-nav)里的「Skill 市场」入口，常驻可见。
 *
 * 新增文件(fork-friendly)：自包含按钮 + overlay，复用与主菜单一致的
 * `sidebar-primary-nav-*` 样式；上游只需在主菜单插入一行 `<SkillMarketNavItem />`。
 */
export function SkillMarketNavItem() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="sidebar-primary-nav-item sidebar-primary-nav-subitem"
        onClick={() => setOpen(true)}
        title="Skill 市场"
        aria-label="Skill 市场"
        data-tauri-drag-region="false"
      >
        <Store
          className="sidebar-primary-nav-icon"
          aria-hidden
          size={20}
          strokeWidth={1.8}
        />
        <span className="sidebar-primary-nav-text">Skill 市场</span>
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
