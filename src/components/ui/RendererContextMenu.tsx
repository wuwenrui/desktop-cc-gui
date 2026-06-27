import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type RendererContextMenuLeafItem =
  | {
      type: "item";
      id: string;
      label: string;
      disabled?: boolean;
      tone?: "default" | "danger";
      onSelect: () => void | Promise<void>;
    }
  | {
      type: "label";
      id: string;
      label: string;
    }
  | {
      type: "separator";
      id: string;
    };

export type RendererContextMenuItem =
  | RendererContextMenuLeafItem
  | {
      type: "submenu";
      id: string;
      label: string;
      disabled?: boolean;
      items: RendererContextMenuLeafItem[];
    };

export type RendererContextMenuState = {
  x: number;
  y: number;
  label: string;
  items: RendererContextMenuItem[];
};

type RendererContextMenuProps = {
  menu: RendererContextMenuState;
  onClose: () => void;
  className?: string;
};

type RendererContextSubmenuPosition = {
  x: number;
  y: number;
};

const MENU_MAX_HEIGHT = 420;
const MENU_VERTICAL_PADDING = 16;
const MENU_ITEM_HEIGHT = 40;
const MENU_LABEL_HEIGHT = 32;
const MENU_SEPARATOR_HEIGHT = 9;
const SUBMENU_WIDTH = 260;
const SUBMENU_MAX_HEIGHT = 420;
const SUBMENU_GAP = 6;
const SUBMENU_VERTICAL_PADDING = 16;
const SUBMENU_ITEM_HEIGHT = 40;
const SUBMENU_LABEL_HEIGHT = 32;
const SUBMENU_SEPARATOR_HEIGHT = 9;
const VIEWPORT_PADDING = 12;

export function estimateRendererContextMenuHeight(
  items: readonly RendererContextMenuItem[],
) {
  const estimatedContentHeight = items.reduce((height, item) => {
    if (item.type === "separator") {
      return height + MENU_SEPARATOR_HEIGHT;
    }
    if (item.type === "label") {
      return height + MENU_LABEL_HEIGHT;
    }
    return height + MENU_ITEM_HEIGHT;
  }, MENU_VERTICAL_PADDING);
  return Math.min(MENU_MAX_HEIGHT, estimatedContentHeight);
}

function estimateRendererContextSubmenuHeight(
  items: readonly RendererContextMenuLeafItem[],
) {
  const estimatedContentHeight = items.reduce((height, item) => {
    if (item.type === "separator") {
      return height + SUBMENU_SEPARATOR_HEIGHT;
    }
    if (item.type === "label") {
      return height + SUBMENU_LABEL_HEIGHT;
    }
    return height + SUBMENU_ITEM_HEIGHT;
  }, SUBMENU_VERTICAL_PADDING);
  return Math.min(SUBMENU_MAX_HEIGHT, estimatedContentHeight);
}

function resolveRendererContextSubmenuPosition(
  triggerRect: DOMRect,
  submenuHeight: number,
): RendererContextSubmenuPosition {
  if (typeof window === "undefined") {
    return {
      x: triggerRect.right + SUBMENU_GAP,
      y: triggerRect.top,
    };
  }
  const maxRightX = window.innerWidth - SUBMENU_WIDTH - VIEWPORT_PADDING;
  const rightX = triggerRect.right + SUBMENU_GAP;
  const leftX = triggerRect.left - SUBMENU_WIDTH - SUBMENU_GAP;
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

export function RendererContextMenu({
  menu,
  onClose,
  className = "renderer-context-menu",
}: RendererContextMenuProps) {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const submenuTriggerRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [openSubmenuId, setOpenSubmenuId] = useState<string | null>(null);
  const [submenuPosition, setSubmenuPosition] =
    useState<RendererContextSubmenuPosition | null>(null);

  const openSubmenu = useCallback(
    (item: Extract<RendererContextMenuItem, { type: "submenu" }>) => {
      const trigger = submenuTriggerRefs.current[item.id];
      if (!trigger) {
        return;
      }
      setSubmenuPosition(
        resolveRendererContextSubmenuPosition(
          trigger.getBoundingClientRect(),
          estimateRendererContextSubmenuHeight(item.items),
        ),
      );
      setOpenSubmenuId(item.id);
    },
    [],
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    const handleBlur = () => onClose();

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("blur", handleBlur);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("blur", handleBlur);
    };
  }, [onClose]);

  useEffect(() => {
    setOpenSubmenuId(null);
    setSubmenuPosition(null);
  }, [menu]);

  const openSubmenuItem = menu.items.find(
    (item): item is Extract<RendererContextMenuItem, { type: "submenu" }> =>
      item.type === "submenu" && item.id === openSubmenuId,
  );

  const renderLeafItem = (
    item: RendererContextMenuLeafItem,
    options?: { closeSubmenuOnHover?: boolean },
  ) => {
    if (item.type === "separator") {
      return (
        <div
          key={item.id}
          className="renderer-context-menu-separator"
          aria-hidden
        />
      );
    }
    if (item.type === "label") {
      return (
        <div key={item.id} className="renderer-context-menu-label">
          {item.label}
        </div>
      );
    }
    return (
      <button
        key={item.id}
        type="button"
        role="menuitem"
        className={`renderer-context-menu-item${
          item.tone === "danger" ? " is-danger" : ""
        }`}
        disabled={item.disabled}
        onMouseEnter={() => {
          if (options?.closeSubmenuOnHover) {
            setOpenSubmenuId(null);
            setSubmenuPosition(null);
          }
        }}
        onFocus={() => {
          if (options?.closeSubmenuOnHover) {
            setOpenSubmenuId(null);
            setSubmenuPosition(null);
          }
        }}
        onClick={() => {
          if (item.disabled) {
            return;
          }
          onClose();
          void item.onSelect();
        }}
      >
        <span className="renderer-context-menu-item-label">
          {item.label}
        </span>
      </button>
    );
  };

  const renderRootItem = (item: RendererContextMenuItem) => {
    if (item.type !== "submenu") {
      return renderLeafItem(item, { closeSubmenuOnHover: true });
    }
    const isOpen = openSubmenuId === item.id;
    return (
      <button
        key={item.id}
        ref={(element) => {
          submenuTriggerRefs.current[item.id] = element;
        }}
        type="button"
        role="menuitem"
        className={`renderer-context-menu-item renderer-context-menu-submenu-trigger${
          isOpen ? " is-open" : ""
        }`}
        disabled={item.disabled}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onMouseEnter={() => {
          if (!item.disabled) {
            openSubmenu(item);
          }
        }}
        onFocus={() => {
          if (!item.disabled) {
            openSubmenu(item);
          }
        }}
        onClick={(event) => {
          event.preventDefault();
          if (item.disabled) {
            return;
          }
          if (isOpen) {
            setOpenSubmenuId(null);
            setSubmenuPosition(null);
            return;
          }
          openSubmenu(item);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowRight") {
            event.preventDefault();
            openSubmenu(item);
          }
          if (event.key === "ArrowLeft") {
            event.preventDefault();
            setOpenSubmenuId(null);
            setSubmenuPosition(null);
          }
        }}
      >
        <span className="renderer-context-menu-item-label">
          {item.label}
        </span>
        <span className="renderer-context-menu-submenu-chevron" aria-hidden>
          ›
        </span>
      </button>
    );
  };

  const menuNode = (
    <div
      className="renderer-context-menu-backdrop"
      onClick={onClose}
      onContextMenu={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div
        ref={menuRef}
        className={className}
        role="menu"
        aria-label={menu.label}
        style={{ left: menu.x, top: menu.y }}
        onMouseDown={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
        onContextMenu={(event) => event.preventDefault()}
      >
        {menu.items.map((item) => renderRootItem(item))}
      </div>
      {openSubmenuItem && submenuPosition ? (
        <div
          className={`${className} renderer-context-menu-flyout`}
          role="menu"
          aria-label={openSubmenuItem.label}
          style={{ left: submenuPosition.x, top: submenuPosition.y }}
          onMouseDown={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
          onContextMenu={(event) => event.preventDefault()}
        >
          {openSubmenuItem.items.map((item) => renderLeafItem(item))}
        </div>
      ) : null}
    </div>
  );

  if (typeof document === "undefined") {
    return menuNode;
  }

  return createPortal(menuNode, document.body);
}

export function clampRendererContextMenuPosition(
  x: number,
  y: number,
  options?: {
    width?: number;
    height?: number;
    padding?: number;
  },
) {
  const width = options?.width ?? 280;
  const height = options?.height ?? 420;
  const padding = options?.padding ?? 12;
  if (typeof window === "undefined") {
    return { x, y };
  }
  const maxX = Math.max(padding, window.innerWidth - width - padding);
  const maxY = Math.max(padding, window.innerHeight - height - padding);
  const preferredY = y + height + padding > window.innerHeight
    ? Math.max(padding, y - height)
    : y;
  return {
    x: Math.min(Math.max(x, padding), maxX),
    y: Math.min(Math.max(preferredY, padding), maxY),
  };
}
