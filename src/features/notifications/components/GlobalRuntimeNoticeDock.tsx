import BellDot from "lucide-react/dist/esm/icons/bell-dot";
import CircleAlert from "lucide-react/dist/esm/icons/circle-alert";
import CircleCheck from "lucide-react/dist/esm/icons/circle-check";
import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import {
  filterVisibleGlobalRuntimeNoticeDockItems,
  type GlobalRuntimeNotice,
} from "../../../services/globalRuntimeNotices";
import type {
  GlobalRuntimeNoticeDockStatus,
  GlobalRuntimeNoticeDockVisibility,
} from "../hooks/useGlobalRuntimeNoticeDock";

type GlobalRuntimeNoticeDockProps = {
  notices: readonly GlobalRuntimeNotice[];
  visibility: GlobalRuntimeNoticeDockVisibility;
  status: GlobalRuntimeNoticeDockStatus;
  onExpand: () => void;
  onMinimize: () => void;
  onClear: () => void;
};

type MinimizedIndicatorState = "idle" | "has-notice" | "has-error";

type SidebarPanelPlacement = {
  style: CSSProperties;
};

const SIDEBAR_PANEL_WIDTH_PX = 560;
const VIEWPORT_MARGIN_PX = 12;
const PANEL_TRIGGER_GAP_PX = 4;

function formatNoticeTimestamp(timestampMs: number) {
  const date = new Date(timestampMs);
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

function resolveStatusLabel(
  t: (key: string) => string,
  status: GlobalRuntimeNoticeDockStatus,
) {
  switch (status) {
    case "has-error":
      return t("runtimeNotice.statusError");
    case "streaming":
      return t("runtimeNotice.statusStreaming");
    case "idle":
    default:
      return t("runtimeNotice.statusIdle");
  }
}

function resolveSeverityLabel(
  t: (key: string) => string,
  severity: GlobalRuntimeNotice["severity"],
) {
  switch (severity) {
    case "warning":
      return t("runtimeNotice.severityWarning");
    case "error":
      return t("runtimeNotice.severityError");
    case "info":
    default:
      return t("runtimeNotice.severityInfo");
  }
}

function resolveMinimizedIndicatorState(
  status: GlobalRuntimeNoticeDockStatus,
): MinimizedIndicatorState {
  if (status === "has-error") {
    return "has-error";
  }
  if (status === "streaming") {
    return "has-notice";
  }
  return "idle";
}

function resolveSidebarPanelPlacement(anchorRect: DOMRect): SidebarPanelPlacement {
  const viewportWidth =
    typeof window === "undefined" ? SIDEBAR_PANEL_WIDTH_PX : window.innerWidth;
  const panelWidth = Math.min(
    SIDEBAR_PANEL_WIDTH_PX,
    Math.max(0, viewportWidth - VIEWPORT_MARGIN_PX * 2),
  );
  const maxLeft = Math.max(VIEWPORT_MARGIN_PX, viewportWidth - panelWidth - VIEWPORT_MARGIN_PX);
  const left = Math.min(Math.max(anchorRect.left, VIEWPORT_MARGIN_PX), maxLeft);
  const viewportHeight =
    typeof window === "undefined" ? anchorRect.bottom : window.innerHeight;
  const bottom = Math.max(
    VIEWPORT_MARGIN_PX,
    viewportHeight - anchorRect.top + PANEL_TRIGGER_GAP_PX,
  );

  return {
    style: {
      left,
      bottom,
      width: panelWidth,
    },
  };
}

export function GlobalRuntimeNoticeDock({
  notices,
  visibility,
  onExpand,
  onMinimize,
  onClear,
}: GlobalRuntimeNoticeDockProps) {
  const { t } = useTranslation();
  const shellRef = useRef<HTMLDivElement | null>(null);
  const [isSidebarPlacement, setIsSidebarPlacement] = useState(false);
  const [sidebarPanelPlacement, setSidebarPanelPlacement] =
    useState<SidebarPanelPlacement | null>(null);
  const isMinimized = visibility === "minimized";
  const visibleNotices = useMemo(
    () => filterVisibleGlobalRuntimeNoticeDockItems(notices),
    [notices],
  );
  const hasNoticeItems = visibleNotices.length > 0;
  const effectiveStatus: GlobalRuntimeNoticeDockStatus =
    visibleNotices.length > 0 ? "has-error" : "idle";
  const statusLabel = resolveStatusLabel(t, effectiveStatus);
  const minimizedIndicatorState = resolveMinimizedIndicatorState(effectiveStatus);

  useLayoutEffect(() => {
    const shell = shellRef.current;
    setIsSidebarPlacement(Boolean(shell?.closest(".sidebar-bottom-nav")));
  }, []);

  useLayoutEffect(() => {
    if (isMinimized || !isSidebarPlacement) {
      setSidebarPanelPlacement(null);
      return;
    }

    const updatePlacement = () => {
      const shell = shellRef.current;
      if (!shell) {
        return;
      }
      setSidebarPanelPlacement(resolveSidebarPanelPlacement(shell.getBoundingClientRect()));
    };

    updatePlacement();
    window.addEventListener("resize", updatePlacement);
    window.addEventListener("scroll", updatePlacement, true);

    return () => {
      window.removeEventListener("resize", updatePlacement);
      window.removeEventListener("scroll", updatePlacement, true);
    };
  }, [isMinimized, isSidebarPlacement]);

  const renderedRows = useMemo(
    () =>
      visibleNotices.map((notice) => {
        const translatedMessage = t(notice.messageKey, notice.messageParams);
        const severityLabel = resolveSeverityLabel(t, notice.severity);
        const timestampLabel = formatNoticeTimestamp(notice.timestampMs);
        const messageLabel =
          notice.repeatCount > 1 ? `${translatedMessage} ×${notice.repeatCount}` : translatedMessage;
        return {
          id: notice.id,
          severity: notice.severity,
          messageLabel,
          timestampLabel,
          ariaLabel: `${severityLabel} ${messageLabel} ${timestampLabel}`,
        };
      }),
    [visibleNotices, t],
  );

  const expandedDockNode = (
    <section
      className={`global-runtime-notice-dock${isSidebarPlacement ? " is-sidebar-popover" : ""}${sidebarPanelPlacement ? " is-portal" : ""}`}
      role="region"
      aria-label={t("runtimeNotice.title")}
      style={sidebarPanelPlacement?.style}
    >
      <header className="global-runtime-notice-dock-header">
        <div className="global-runtime-notice-dock-title-wrap">
          <span className="global-runtime-notice-dock-title">
            {t("runtimeNotice.title")}
          </span>
          <span className={`global-runtime-notice-dock-status is-${effectiveStatus}`}>
            {statusLabel}
          </span>
        </div>
        <div className="global-runtime-notice-dock-actions">
          <button
            type="button"
            className="global-runtime-notice-dock-action"
            onClick={onClear}
          >
            {t("runtimeNotice.clear")}
          </button>
          <button
            type="button"
            className="global-runtime-notice-dock-action"
            onClick={onMinimize}
          >
            {t("runtimeNotice.minimize")}
          </button>
        </div>
      </header>
      {hasNoticeItems ? (
        <ol className="global-runtime-notice-dock-list">
          {renderedRows.map((row) => (
            <li
              key={row.id}
              className={`global-runtime-notice-dock-row is-${row.severity}`}
              aria-label={row.ariaLabel}
            >
              <span
                className={`global-runtime-notice-dock-severity is-${row.severity}`}
                aria-hidden="true"
              />
              <span
                className="global-runtime-notice-dock-message"
                title={row.messageLabel}
              >
                {row.messageLabel}
              </span>
              <time className="global-runtime-notice-dock-time">
                {row.timestampLabel}
              </time>
            </li>
          ))}
        </ol>
      ) : (
        <div className="global-runtime-notice-dock-empty">
          <div className="global-runtime-notice-dock-empty-title">
            {t("runtimeNotice.emptyTitle")}
          </div>
          <div className="global-runtime-notice-dock-empty-description">
            {t("runtimeNotice.emptyDescription")}
          </div>
        </div>
      )}
    </section>
  );
  const shouldPortalSidebarPanel =
    !isMinimized && isSidebarPlacement && typeof document !== "undefined";

  return (
    <div className="global-runtime-notice-dock-shell" ref={shellRef}>
      {isMinimized ? (
        <button
          type="button"
          className={`global-runtime-notice-dock-bubble is-${minimizedIndicatorState}`}
          onClick={onExpand}
          aria-label={t("runtimeNotice.open")}
          title={t("runtimeNotice.open")}
        >
          <span className="global-runtime-notice-dock-indicator" aria-hidden="true">
            {minimizedIndicatorState === "has-error" ? (
              <CircleAlert className="global-runtime-notice-dock-indicator-icon" strokeWidth={2} />
            ) : minimizedIndicatorState === "has-notice" ? (
              <BellDot className="global-runtime-notice-dock-indicator-icon" strokeWidth={2} />
            ) : (
              <CircleCheck className="global-runtime-notice-dock-indicator-icon" strokeWidth={2} />
            )}
          </span>
        </button>
      ) : shouldPortalSidebarPanel ? (
        createPortal(
          <div className="global-runtime-notice-dock-portal-layer">
            {expandedDockNode}
          </div>,
          document.body,
        )
      ) : (
        expandedDockNode
      )}
    </div>
  );
}
