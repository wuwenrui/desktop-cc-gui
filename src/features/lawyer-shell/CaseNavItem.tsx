import Scale from "lucide-react/dist/esm/icons/scale";
import { useState } from "react";
import { CaseHomePage } from "./CaseHomePage";

/**
 * 侧栏主菜单「我的案件」入口（lawyer-shell）。
 *
 * 沿用 SkillMarketNavItem 的自包含 nav+overlay 范式（fork-friendly）：
 * 复用 `sidebar-primary-nav-*` 样式，overlay 内挂 CaseHomePage。
 * 律师模式下该入口置顶（见 Sidebar 的 navVisibility 过滤）。
 */
export function CaseNavItem({
  onOpenCaseWorkspacePath,
}: {
  /** 把目录注册为 workspace 并激活；未接线时入口仍可浏览案件列表。 */
  onOpenCaseWorkspacePath?: (path: string) => Promise<void> | void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="sidebar-primary-nav-item sidebar-primary-nav-subitem"
        onClick={() => setOpen(true)}
        title="我的案件"
        aria-label="我的案件"
        data-tauri-drag-region="false"
      >
        <Scale
          className="sidebar-primary-nav-icon"
          aria-hidden
          size={20}
          strokeWidth={1.8}
        />
        <span className="sidebar-primary-nav-text">我的案件</span>
      </button>
      {open && (
        <div
          className="lawyer-shell-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="我的案件"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setOpen(false);
            }
          }}
        >
          <div className="lawyer-shell-panel">
            <div className="lawyer-shell-panel-header">
              <span>我的案件</span>
              <button type="button" aria-label="关闭" onClick={() => setOpen(false)}>
                关闭
              </button>
            </div>
            <CaseHomePage
              onOpenCaseWorkspace={async (path) => {
                // 打开工作区时收起 overlay，让用户直接落到案件工作区。
                setOpen(false);
                await onOpenCaseWorkspacePath?.(path);
              }}
            />
          </div>
        </div>
      )}
    </>
  );
}
