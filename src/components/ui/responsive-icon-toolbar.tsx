import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import SquareMenu from "lucide-react/dist/esm/icons/square-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./dropdown-menu";
import { TooltipIconButton } from "./tooltip-icon-button";

export type ResponsiveIconToolbarItem = {
  id: string;
  label: string;
  icon: ReactNode;
  onSelect: () => void;
  buttonClassName?: string;
  iconClassName?: string;
  menuItemClassName?: string;
  priority?: number;
  keepVisible?: boolean;
  pinToEnd?: boolean;
  ariaCurrent?: "page" | "step" | "location" | "date" | "time" | true;
};

type ResponsiveIconToolbarProps = {
  items: ResponsiveIconToolbarItem[];
  className: string;
  overflowLabel: string;
  ariaLabel?: string;
  role?: string;
  itemWidth?: number;
  overflowButtonWidth?: number;
  minVisibleItems?: number;
  maxVisibleItems?: number;
  collapseInactiveItems?: boolean;
};

function sortByVisibilityPriority(
  items: ResponsiveIconToolbarItem[],
  originalIndexById: Map<string, number>,
  promotedItemId: string | null,
) {
  return [...items].sort((left, right) => {
    if (left.id === promotedItemId || right.id === promotedItemId) {
      return left.id === promotedItemId ? -1 : 1;
    }
    if (left.keepVisible !== right.keepVisible) {
      return left.keepVisible ? -1 : 1;
    }
    const priorityDiff = (left.priority ?? 50) - (right.priority ?? 50);
    if (priorityDiff !== 0) {
      return priorityDiff;
    }
    return (originalIndexById.get(left.id) ?? 0) - (originalIndexById.get(right.id) ?? 0);
  });
}

function splitToolbarItems(
  items: ResponsiveIconToolbarItem[],
  visibleLimit: number,
  promotedItemId: string | null,
  collapseInactiveItems: boolean,
) {
  if (collapseInactiveItems) {
    const visibleIds = new Set(
      items
        .filter((item) => item.keepVisible || item.id === promotedItemId)
        .map((item) => item.id),
    );

    return {
      visibleItems: items.filter((item) => visibleIds.has(item.id)),
      overflowItems: items.filter((item) => !visibleIds.has(item.id)),
    };
  }

  if (visibleLimit >= items.length) {
    return {
      visibleItems: items,
      overflowItems: [],
    };
  }

  const originalIndexById = new Map(items.map((item, index) => [item.id, index]));
  const selectedIds = new Set(
    sortByVisibilityPriority(items, originalIndexById, promotedItemId)
      .slice(0, Math.max(0, visibleLimit))
      .map((item) => item.id),
  );

  return {
    visibleItems: items.filter((item) => selectedIds.has(item.id)),
    overflowItems: items.filter((item) => !selectedIds.has(item.id)),
  };
}

export function ResponsiveIconToolbar({
  items,
  className,
  overflowLabel,
  ariaLabel,
  role,
  itemWidth = 31,
  overflowButtonWidth = 32,
  minVisibleItems = 1,
  maxVisibleItems,
  collapseInactiveItems = false,
}: ResponsiveIconToolbarProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [promotedItemId, setPromotedItemId] = useState<string | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) {
      return;
    }

    setContainerWidth(Math.floor(root.clientWidth));

    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? root.clientWidth;
      setContainerWidth(Math.floor(width));
    });
    observer.observe(root);

    return () => observer.disconnect();
  }, []);

  const visibleLimit = useMemo(() => {
    if (containerWidth <= 0 || items.length <= minVisibleItems) {
      return items.length;
    }

    const reservedWidth = containerWidth < items.length * itemWidth ? overflowButtonWidth : 0;
    const nextLimit = Math.floor((containerWidth - reservedWidth) / itemWidth);
    const widthLimited = Math.max(minVisibleItems, Math.min(items.length, nextLimit));
    return typeof maxVisibleItems === "number"
      ? Math.min(widthLimited, Math.max(minVisibleItems, maxVisibleItems))
      : widthLimited;
  }, [containerWidth, itemWidth, items.length, maxVisibleItems, minVisibleItems, overflowButtonWidth]);

  const { visibleItems, overflowItems } = useMemo(
    () => splitToolbarItems(items, visibleLimit, promotedItemId, collapseInactiveItems),
    [collapseInactiveItems, items, promotedItemId, visibleLimit],
  );
  const leadingVisibleItems = visibleItems.filter((item) => !item.pinToEnd);
  const pinnedVisibleItems = visibleItems.filter((item) => item.pinToEnd);

  const selectItem = (item: ResponsiveIconToolbarItem) => {
    setPromotedItemId(item.id);
    item.onSelect();
  };

  if (items.length === 0) {
    return null;
  }

  return (
    <div
      ref={rootRef}
      className={className}
      role={role}
      aria-label={ariaLabel}
      data-tauri-drag-region="false"
    >
      {leadingVisibleItems.map((item) => (
        <TooltipIconButton
          key={item.id}
          className={item.buttonClassName}
          onClick={() => selectItem(item)}
          aria-current={item.ariaCurrent}
          data-tauri-drag-region="false"
          label={item.label}
        >
          <span className={item.iconClassName} aria-hidden>
            {item.icon}
          </span>
        </TooltipIconButton>
      ))}
      {overflowItems.length > 0 ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="responsive-icon-toolbar-more"
              aria-label={overflowLabel}
              title={overflowLabel}
              data-tauri-drag-region="false"
            >
              <SquareMenu size={14} aria-hidden />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="responsive-icon-toolbar-menu" align="end">
            {overflowItems.map((item) => (
              <DropdownMenuItem
                key={item.id}
                className={item.menuItemClassName}
                onSelect={() => selectItem(item)}
                data-tauri-drag-region="false"
              >
                <span className={item.iconClassName} aria-hidden>
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
      {pinnedVisibleItems.map((item) => (
        <TooltipIconButton
          key={item.id}
          className={item.buttonClassName}
          onClick={() => selectItem(item)}
          aria-current={item.ariaCurrent}
          data-tauri-drag-region="false"
          label={item.label}
        >
          <span className={item.iconClassName} aria-hidden>
            {item.icon}
          </span>
        </TooltipIconButton>
      ))}
    </div>
  );
}
