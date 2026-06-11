import type { ReactNode } from "react";

export function SidebarTopbarSlot({ topbarNode }: { topbarNode?: ReactNode }) {
  return (
    <div className="sidebar-topbar-placeholder" data-tauri-drag-region>
      {topbarNode ? (
        <div className="sidebar-topbar-content" data-tauri-drag-region>
          {topbarNode}
        </div>
      ) : null}
    </div>
  );
}
