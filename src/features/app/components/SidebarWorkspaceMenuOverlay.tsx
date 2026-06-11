import ChevronRight from "lucide-react/dist/esm/icons/chevron-right";
import RefreshCw from "lucide-react/dist/esm/icons/refresh-cw";
import { useCallback, useMemo, useRef, useState } from "react";
import type { CSSProperties, MouseEvent, ReactNode } from "react";
import type { WorkspaceMenuAction } from "../hooks/useSidebarMenus";

type SidebarWorkspaceMenuOverlayProps = {
  menu: {
    x: number;
    y: number;
    groups: Array<{
      id: string;
      label: string;
      actions: WorkspaceMenuAction[];
    }>;
  };
  t: (key: string) => string;
  onClose: () => void;
  onAction: (action: WorkspaceMenuAction) => void;
  renderIcon: (iconKind: string) => ReactNode;
};

type SidebarWorkspaceSubmenuPosition = {
  x: number;
  y: number;
};

const SUBMENU_WIDTH = 260;
const SUBMENU_MAX_HEIGHT = 360;
const SUBMENU_GAP = 0;
const SUBMENU_PADDING_Y = 12;
const SUBMENU_ITEM_HEIGHT = 34;
const SUBMENU_TITLE_HEIGHT = 26;
const VIEWPORT_PADDING = 12;

function estimateWorkspaceSubmenuHeight(action: WorkspaceMenuAction) {
  const itemCount = action.children?.length ?? 0;
  const titleHeight = action.submenuTitle ? SUBMENU_TITLE_HEIGHT : 0;
  return Math.min(
    SUBMENU_MAX_HEIGHT,
    SUBMENU_PADDING_Y + titleHeight + itemCount * SUBMENU_ITEM_HEIGHT,
  );
}

function resolveWorkspaceSubmenuPosition(
  triggerRect: DOMRect,
  menuRect: DOMRect,
  submenuHeight: number,
): SidebarWorkspaceSubmenuPosition {
  if (typeof window === "undefined") {
    return {
      x: menuRect.right + SUBMENU_GAP,
      y: triggerRect.top,
    };
  }

  const maxRightX = window.innerWidth - SUBMENU_WIDTH - VIEWPORT_PADDING;
  const rightX = menuRect.right + SUBMENU_GAP;
  const leftX = menuRect.left - SUBMENU_WIDTH - SUBMENU_GAP;
  const shouldOpenRight = rightX <= maxRightX || leftX < VIEWPORT_PADDING;
  const x = shouldOpenRight
    ? Math.min(Math.max(rightX, VIEWPORT_PADDING), Math.max(VIEWPORT_PADDING, maxRightX))
    : Math.max(leftX, VIEWPORT_PADDING);
  const maxY = window.innerHeight - submenuHeight - VIEWPORT_PADDING;
  const y = Math.min(
    Math.max(triggerRect.top, VIEWPORT_PADDING),
    Math.max(VIEWPORT_PADDING, maxY),
  );

  return { x, y };
}

export function SidebarWorkspaceMenuOverlay({
  menu,
  t,
  onClose,
  onAction,
  renderIcon,
}: SidebarWorkspaceMenuOverlayProps) {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [openSubmenuId, setOpenSubmenuId] = useState<string | null>(null);
  const [submenuPosition, setSubmenuPosition] =
    useState<SidebarWorkspaceSubmenuPosition | null>(null);

  const openSubmenuAction = useMemo(
    () =>
      menu.groups
        .flatMap((group) => group.actions)
        .find(
          (action) =>
            action.id === openSubmenuId &&
            Boolean(action.children?.length) &&
            !action.unavailable,
        ) ?? null,
    [menu.groups, openSubmenuId],
  );

  const closeSubmenu = useCallback(() => {
    setOpenSubmenuId(null);
    setSubmenuPosition(null);
  }, []);

  const openSubmenu = useCallback((action: WorkspaceMenuAction, trigger: HTMLElement) => {
    if (!action.children?.length || action.unavailable) {
      closeSubmenu();
      return;
    }

    setSubmenuPosition(
      resolveWorkspaceSubmenuPosition(
        trigger.getBoundingClientRect(),
        menuRef.current?.getBoundingClientRect() ?? trigger.getBoundingClientRect(),
        estimateWorkspaceSubmenuHeight(action),
      ),
    );
    setOpenSubmenuId(action.id);
  }, [closeSubmenu]);

  const handleAction = useCallback(
    (action: WorkspaceMenuAction, event?: MouseEvent<HTMLElement>) => {
      if (action.unavailable) {
        return;
      }
      if (action.children && action.children.length > 0) {
        if (openSubmenuId === action.id) {
          closeSubmenu();
          return;
        }
        if (event?.currentTarget) {
          openSubmenu(action, event.currentTarget);
        }
        return;
      }
      closeSubmenu();
      onAction(action);
    },
    [closeSubmenu, onAction, openSubmenu, openSubmenuId],
  );

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
        ref={menuRef}
        className="sidebar-workspace-menu"
        role="menu"
        aria-label={
          menu.groups.length === 1 &&
          menu.groups[0]?.id === "new-session"
            ? t("sidebar.sessionActionsGroup")
            : t("sidebar.workspaceActionsGroup")
        }
        style={{
          left: menu.x,
          top: menu.y,
        }}
        onMouseDown={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
        onContextMenu={(event) => event.preventDefault()}
      >
        {menu.groups.map((group, groupIndex) => (
          <div className="sidebar-workspace-menu-group" key={group.id}>
            <div className="sidebar-workspace-menu-group-title">
              {group.label}
            </div>
            {group.actions.map((action) => (
              <div className="sidebar-workspace-menu-item-row" key={action.id}>
                <button
                  type="button"
                  role="menuitem"
                  className={`sidebar-workspace-menu-item${
                    action.tone === "danger" ? " is-danger" : ""
                  }${action.deprecated ? " is-deprecated" : ""}${
                    action.unavailable ? " is-unavailable" : ""
                  }`}
                  disabled={action.unavailable}
                  aria-haspopup={action.children?.length ? "menu" : undefined}
                  aria-expanded={
                    action.children?.length ? openSubmenuId === action.id : undefined
                  }
                  onMouseEnter={(event) => {
                    if (action.children?.length && !action.unavailable) {
                      openSubmenu(action, event.currentTarget);
                      return;
                    }
                    closeSubmenu();
                  }}
                  onClick={(event) => handleAction(action, event)}
                >
                  <span
                    className={`sidebar-workspace-menu-item-icon sidebar-workspace-menu-item-icon-${action.iconKind}${
                      action.unavailable ? " is-unavailable" : ""
                    }`}
                    aria-hidden
                  >
                    {renderIcon(action.iconKind)}
                  </span>
                  <span className="sidebar-workspace-menu-item-label">
                    {action.label}
                  </span>
                  {action.deprecated ? (
                    <span className="sidebar-workspace-menu-item-deprecated">
                      ({t("sidebar.deprecatedTag")})
                    </span>
                  ) : null}
                  {action.unavailable ? (
                    <span className="sidebar-workspace-menu-item-unavailable">
                      ({action.statusLabel ?? t("sidebar.unavailableTag")})
                    </span>
                  ) : null}
                  {action.children?.length ? (
                    <ChevronRight
                      className="sidebar-workspace-menu-item-submenu-icon"
                      size={13}
                      aria-hidden
                    />
                  ) : null}
                </button>
                {action.refreshable ? (
                  <button
                    type="button"
                    className={`sidebar-workspace-menu-item-refresh${
                      action.refreshing ? " is-refreshing" : ""
                    }`}
                    onMouseDown={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                    }}
                    onPointerDown={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                    }}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      void action.onRefresh?.();
                    }}
                    onDoubleClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                    }}
                    aria-label={t("common.refresh")}
                    title={t("common.refresh")}
                    data-tauri-drag-region="false"
                    disabled={action.refreshing}
                  >
                    <RefreshCw size={13} aria-hidden />
                  </button>
                ) : null}
              </div>
            ))}
            {groupIndex < menu.groups.length - 1 ? (
              <div className="sidebar-workspace-menu-divider" aria-hidden />
            ) : null}
          </div>
        ))}
      </div>
      {openSubmenuAction?.children?.length && submenuPosition ? (
        <div
          className="sidebar-workspace-submenu"
          role="menu"
          aria-label={openSubmenuAction.label}
          style={{
            "--sidebar-workspace-submenu-x": `${submenuPosition.x}px`,
            "--sidebar-workspace-submenu-y": `${submenuPosition.y}px`,
          } as CSSProperties}
          onMouseDown={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
          onContextMenu={(event) => event.preventDefault()}
        >
          {openSubmenuAction.submenuTitle ? (
            <div className="sidebar-workspace-submenu-title">
              {openSubmenuAction.submenuTitle}
            </div>
          ) : null}
          {openSubmenuAction.children.map((child) => (
            <button
              key={child.id}
              type="button"
              role="menuitem"
              className={`sidebar-workspace-menu-item${
                child.unavailable ? " is-unavailable" : ""
              }`}
              disabled={child.unavailable}
              onClick={() => onAction(child)}
            >
              <span
                className={`sidebar-workspace-menu-item-icon sidebar-workspace-menu-item-icon-${child.iconKind}${
                  child.unavailable ? " is-unavailable" : ""
                }`}
                aria-hidden
              >
                {renderIcon(child.iconKind)}
              </span>
              <span className="sidebar-workspace-menu-item-label">
                {child.label}
              </span>
              {child.badgeLabel ? (
                <span className="sidebar-workspace-menu-item-badge">
                  {child.badgeLabel}
                </span>
              ) : null}
              {child.unavailable ? (
                <span className="sidebar-workspace-menu-item-unavailable">
                  ({child.statusLabel ?? t("sidebar.unavailableTag")})
                </span>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
