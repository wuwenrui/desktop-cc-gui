import type { ThreadMoveFolderTarget } from "../hooks/useSidebarMenus";
import type { ThreadFolderMovePickerState } from "./sidebarInternals";

type SidebarFolderMovePickerProps = {
  picker: ThreadFolderMovePickerState;
  query: string;
  targets: ThreadMoveFolderTarget[];
  t: (key: string) => string;
  onQueryChange: (query: string) => void;
  onClose: () => void;
  onSelectTarget: (target: ThreadMoveFolderTarget) => void;
};

export function SidebarFolderMovePicker({
  picker,
  query,
  targets,
  t,
  onQueryChange,
  onClose,
  onSelectTarget,
}: SidebarFolderMovePickerProps) {
  return (
    <div
      className="sidebar-workspace-menu-backdrop"
      onClick={onClose}
      onContextMenu={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div
        className="sidebar-workspace-menu sidebar-folder-move-picker"
        role="dialog"
        aria-label={t("threads.moveToFolder")}
        onMouseDown={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
        onContextMenu={(event) => event.preventDefault()}
      >
        <div className="sidebar-workspace-menu-group">
          <div className="sidebar-workspace-menu-group-title">
            {t("threads.moveToFolder")}
          </div>
          <input
            className="sidebar-search-input sidebar-folder-move-picker-input"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder={t("threads.searchFolderTargets")}
            aria-label={t("threads.searchFolderTargets")}
            data-tauri-drag-region="false"
            autoFocus
          />
          <div className="sidebar-folder-move-picker-list" role="listbox">
            {targets.map((target) => {
              const isCurrentTarget =
                (target.folderId ?? null) === (picker.currentFolderId ?? null);
              return (
                <button
                  key={target.folderId ?? "__root__"}
                  type="button"
                  className={`sidebar-workspace-menu-item${
                    isCurrentTarget ? " is-unavailable" : ""
                  }`}
                  role="option"
                  aria-selected={isCurrentTarget}
                  disabled={isCurrentTarget}
                  onClick={() => onSelectTarget(target)}
                >
                  <span className="sidebar-workspace-menu-item-label">
                    {target.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
