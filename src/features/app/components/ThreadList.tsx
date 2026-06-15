import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipPopup,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { CSSProperties, KeyboardEvent, MouseEvent } from "react";
import { useTranslation } from "react-i18next";

import type { EngineType, ThreadSummary } from "../../../types";
import type { ThreadMoveFolderTarget } from "../hooks/useSidebarMenus";
import { ProxyStatusBadge } from "../../../components/ProxyStatusBadge";
import { EngineIcon } from "../../engine/components/EngineIcon";
import { SharedSessionIcon } from "../../shared-session/components/SharedSessionIcon";
import { ThreadDeleteConfirmBubble } from "../../threads/components/ThreadDeleteConfirmBubble";
import { resolveCodexProviderLabel } from "../utils/codexProviderLabel";
import { getExitedSessionRowVisibility } from "../utils/exitedSessionRows";
import {
  ThreadRowStatusProvider,
  useThreadRowStatus,
  type ThreadStatusMap,
} from "./threadRowStatusStore";

type ThreadRow = {
  thread: ThreadSummary;
  depth: number;
  hasChildren?: boolean;
};

type ShowThreadMenuHandler = (
  event: MouseEvent,
  workspaceId: string,
  threadId: string,
  canPin: boolean,
  sizeBytes?: number,
  moveFolderTargets?: ThreadMoveFolderTarget[],
  currentFolderId?: string | null,
  canArchive?: boolean,
  workspacePath?: string,
) => void;

type ThreadRowItemProps = {
  canArchive: boolean;
  canPin: boolean;
  contextMenuMoveFolderTargets?: ThreadMoveFolderTarget[];
  deleteConfirmBusy: boolean;
  engineTitle: string;
  engineSource: EngineType;
  hasChildren: boolean;
  indentPx: number | null;
  isActiveSubagentGroup: boolean;
  isActiveSubagentParent: boolean;
  isActiveThread: boolean;
  isAutoNaming: boolean;
  isDeleteConfirmOpen: boolean;
  isPendingSubagent: boolean;
  isPinned: boolean;
  showProviderLabels: boolean;
  isSharedThread: boolean;
  isSubagentParent: boolean;
  isSubagentParentCollapsed: boolean;
  isSubagentThread: boolean;
  nestedWorkspaceId: string;
  onCancelDeleteConfirm?: () => void;
  onConfirmDeleteConfirm?: () => void;
  onSelectThread: (workspaceId: string, threadId: string) => void;
  onShowThreadMenu: ShowThreadMenuHandler;
  onToggleThreadPin?: (workspaceId: string, threadId: string) => void;
  relativeTime: string | null;
  selectTargetThreadId: string;
  subagentTreeToggleLabel: string;
  systemProxyEnabled: boolean;
  systemProxyUrl: string | null;
  thread: ThreadSummary;
  toggleSubagentParent: (event: MouseEvent, threadId: string) => void;
  handleSubagentParentKeyDown: (event: KeyboardEvent, threadId: string) => void;
  workspacePath: string;
  onThreadRowRender?: (threadId: string) => void;
};

const EMPTY_MOVE_FOLDER_TARGETS: ThreadMoveFolderTarget[] = [];

function isPendingSubagentThread(thread: ThreadSummary) {
  return thread.id.startsWith("claude-pending-subagent:");
}

function filterCollapsedThreadRows(
  rows: ThreadRow[],
  collapsedParentThreadIds: ReadonlySet<string>,
) {
  if (collapsedParentThreadIds.size === 0) {
    return rows;
  }

  const visibleRows: ThreadRow[] = [];
  let collapsedDepth: number | null = null;

  rows.forEach((row) => {
    if (collapsedDepth !== null) {
      if (row.depth > collapsedDepth) {
        return;
      }
      collapsedDepth = null;
    }

    visibleRows.push(row);
    if (row.hasChildren && collapsedParentThreadIds.has(row.thread.id)) {
      collapsedDepth = row.depth;
    }
  });

  return visibleRows;
}

const ThreadRowItem = memo(function ThreadRowItem({
  canArchive,
  canPin,
  contextMenuMoveFolderTargets,
  deleteConfirmBusy,
  engineTitle,
  engineSource,
  hasChildren,
  indentPx,
  isActiveSubagentGroup,
  isActiveSubagentParent,
  isActiveThread,
  isAutoNaming,
  isDeleteConfirmOpen,
  isPendingSubagent,
  isPinned,
  showProviderLabels,
  isSharedThread,
  isSubagentParent,
  isSubagentParentCollapsed,
  isSubagentThread,
  nestedWorkspaceId,
  onCancelDeleteConfirm,
  onConfirmDeleteConfirm,
  onSelectThread,
  onShowThreadMenu,
  onToggleThreadPin,
  relativeTime,
  selectTargetThreadId,
  subagentTreeToggleLabel,
  systemProxyEnabled,
  systemProxyUrl,
  thread,
  toggleSubagentParent,
  handleSubagentParentKeyDown,
  workspacePath,
  onThreadRowRender,
}: ThreadRowItemProps) {
  const { t } = useTranslation();
  useEffect(() => {
    onThreadRowRender?.(thread.id);
  });
  const status = useThreadRowStatus(thread.id);
  const statusClass = status?.isReviewing
    ? "reviewing"
    : status?.isProcessing
      ? "processing"
      : status?.hasUnread
        ? "unread"
        : "ready";
  const runtimeBadge = status?.isReviewing
    ? { label: t("threads.runtimeReviewing"), severity: "reviewing" as const }
    : status?.isProcessing
      ? { label: t("threads.runtimeProcessing"), severity: "processing" as const }
      : null;
  const isProcessing = Boolean(status?.isProcessing);
  const showProxyBadge = systemProxyEnabled && isProcessing;
  const indentStyle =
    indentPx !== null
      ? ({ "--thread-indent": `${indentPx}px` } as CSSProperties)
      : undefined;
  const engineIconType = engineSource as EngineType;
  const providerLabel = resolveCodexProviderLabel(thread);
  const isProviderUnavailable = thread.providerAvailability === "unavailable";
  return (
    <Popover
      open={isDeleteConfirmOpen}
      onOpenChange={(open) => {
        if (!open) {
          onCancelDeleteConfirm?.();
        }
      }}
    >
      <Tooltip>
        <PopoverAnchor asChild>
          <TooltipTrigger
            delay={450}
            className={`thread-row ${
              isActiveThread ? "active" : ""
            }${isDeleteConfirmOpen ? " has-delete-confirm" : ""}${
              canPin ? " has-pin-toggle" : ""
            }${hasChildren ? " has-child-threads" : ""}${
              isSubagentParent ? " is-subagent-parent" : ""
            }${isActiveSubagentParent ? " is-active-subagent-parent" : ""}${
              isSubagentThread ? " is-subagent" : ""
            }${isActiveSubagentGroup ? " is-active-subagent-group" : ""}${
              isPendingSubagent ? " is-pending-subagent" : ""
            }${thread.isDegraded ? " is-degraded" : ""}`}
            style={indentStyle}
            aria-expanded={
              isSubagentParent ? !isSubagentParentCollapsed : undefined
            }
            onClick={() => {
              onSelectThread(nestedWorkspaceId, selectTargetThreadId);
            }}
            onContextMenu={(event) => {
              if (isPendingSubagent) {
                event.preventDefault();
                event.stopPropagation();
                return;
              }
              onShowThreadMenu(
                event,
                nestedWorkspaceId,
                thread.id,
                canPin,
                thread.sizeBytes,
                contextMenuMoveFolderTargets,
                thread.folderId ?? null,
                canArchive,
                workspacePath,
              );
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onSelectThread(nestedWorkspaceId, selectTargetThreadId);
              }
            }}
          >
            <span className={`thread-status ${statusClass}`} aria-hidden />
            {canPin && onToggleThreadPin && (
              <span
                className={`thread-pin-toggle${isPinned ? " is-pinned" : ""}`}
                role="button"
                aria-label={isPinned ? t("threads.unpin") : t("threads.pin")}
                title={isPinned ? t("threads.unpin") : t("threads.pin")}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onToggleThreadPin(nestedWorkspaceId, thread.id);
                }}
                onMouseDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
              >
                <span className="thread-pin-toggle-icon" aria-hidden />
              </span>
            )}
            <span
              className={`thread-engine-badge ${
                isSharedThread ? "thread-engine-shared" : `thread-engine-${engineSource}`
              }${isProcessing ? " is-processing" : ""}`}
              title={engineTitle}
            >
              {isSharedThread ? (
                <SharedSessionIcon size={12} />
              ) : (
                <EngineIcon engine={engineIconType} size={12} />
              )}
            </span>
            {showProxyBadge && (
              <ProxyStatusBadge
                proxyUrl={systemProxyUrl}
                label={t("threads.proxyBadge")}
                variant="compact"
                className="thread-proxy-badge"
              />
            )}
            <span className="thread-name">{thread.name}</span>
            <div className="thread-meta">
              {isSubagentParent && (
                <span
                  className={`thread-tree-expander${
                    isSubagentParentCollapsed ? " is-collapsed" : ""
                  }`}
                  role="button"
                  tabIndex={0}
                  aria-label={subagentTreeToggleLabel}
                  title={subagentTreeToggleLabel}
                  onClick={(event) => toggleSubagentParent(event, thread.id)}
                  onKeyDown={(event) => handleSubagentParentKeyDown(event, thread.id)}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                  }}
                />
              )}
              {isAutoNaming && (
                <span className="thread-auto-naming">{t("threads.autoNaming")}</span>
              )}
              {showProviderLabels && providerLabel ? (
                <span
                  className={`thread-provider-label${
                    isProviderUnavailable ? " is-unavailable" : ""
                  }`}
                  title={providerLabel}
                >
                  {providerLabel}
                </span>
              ) : null}
              {runtimeBadge ? (
                <span className={`thread-runtime-badge thread-runtime-badge--${runtimeBadge.severity}`}>
                  {runtimeBadge.label}
                </span>
              ) : null}
              {relativeTime ? <span className="thread-time">{relativeTime}</span> : null}
            </div>
          </TooltipTrigger>
        </PopoverAnchor>
        <TooltipPopup
          side="top"
          align="start"
          sideOffset={4}
          className="max-w-[400px] break-words"
        >
          {thread.isDegraded && thread.degradedReason
            ? `${thread.name} · ${thread.degradedReason}`
            : thread.name}
        </TooltipPopup>
      </Tooltip>
      {isDeleteConfirmOpen && (
        <PopoverContent
          side="right"
          align="start"
          sideOffset={10}
          className="thread-delete-popover-shell"
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <ThreadDeleteConfirmBubble
            threadName={thread.name}
            isDeleting={deleteConfirmBusy}
            onCancel={() => onCancelDeleteConfirm?.()}
            onConfirm={() => onConfirmDeleteConfirm?.()}
          />
        </PopoverContent>
      )}
    </Popover>
  );
});

export type ThreadListProps = {
  workspaceId: string;
  workspacePath: string;
  pinnedRows: ThreadRow[];
  unpinnedRows: ThreadRow[];
  totalThreadRoots: number;
  visibleThreadRootCount: number;
  isExpanded: boolean;
  nextCursor: string | null;
  isPaging: boolean;
  nested?: boolean;
  showLoadOlder?: boolean;
  showProviderLabels?: boolean;
  moveFolderTargets?: ThreadMoveFolderTarget[];
  hideExitedSessions?: boolean;
  activeWorkspaceId: string | null;
  activeThreadId: string | null;
  systemProxyEnabled?: boolean;
  systemProxyUrl?: string | null;
  threadStatusById: ThreadStatusMap;
  getThreadTime: (thread: ThreadSummary) => string | null;
  isThreadPinned: (workspaceId: string, threadId: string) => boolean;
  isThreadAutoNaming: (workspaceId: string, threadId: string) => boolean;
  onToggleThreadPin?: (workspaceId: string, threadId: string) => void;
  onToggleExpanded: (workspaceId: string) => void;
  onLoadOlderThreads: (workspaceId: string) => void;
  onSelectThread: (workspaceId: string, threadId: string) => void;
  onShowThreadMenu: ShowThreadMenuHandler;
  deleteConfirmThreadId?: string | null;
  deleteConfirmWorkspaceId?: string | null;
  deleteConfirmBusy?: boolean;
  onCancelDeleteConfirm?: () => void;
  onConfirmDeleteConfirm?: () => void;
  onThreadRowRender?: (threadId: string) => void;
};

export function ThreadList({
  workspaceId,
  workspacePath,
  pinnedRows,
  unpinnedRows,
  totalThreadRoots,
  visibleThreadRootCount,
  isExpanded,
  nextCursor,
  isPaging,
  nested,
  showLoadOlder = true,
  showProviderLabels = false,
  moveFolderTargets = EMPTY_MOVE_FOLDER_TARGETS,
  hideExitedSessions = false,
  activeWorkspaceId,
  activeThreadId,
  systemProxyEnabled = false,
  systemProxyUrl = null,
  threadStatusById,
  getThreadTime,
  isThreadPinned,
  isThreadAutoNaming,
  onToggleThreadPin,
  onToggleExpanded,
  onLoadOlderThreads,
  onSelectThread,
  onShowThreadMenu,
  deleteConfirmThreadId = null,
  deleteConfirmWorkspaceId = null,
  deleteConfirmBusy = false,
  onCancelDeleteConfirm,
  onConfirmDeleteConfirm,
  onThreadRowRender,
}: ThreadListProps) {
  const { t } = useTranslation();
  const indentUnit = nested ? 10 : 14;
  const [collapsedParentThreadIds, setCollapsedParentThreadIds] = useState<Set<string>>(
    () => new Set(),
  );
  const isExitedThread = useCallback((thread: ThreadSummary) => {
    if (isPendingSubagentThread(thread)) {
      return false;
    }
    const status = threadStatusById[thread.id];
    return !status?.isProcessing && !status?.isReviewing;
  }, [threadStatusById]);
  const { visiblePinnedRows, visibleUnpinnedRows, hiddenExitedCount } = useMemo(() => {
    const pinnedVisibility = getExitedSessionRowVisibility(pinnedRows, {
      hideExitedSessions,
      isExitedThread,
    });
    const unpinnedVisibility = getExitedSessionRowVisibility(unpinnedRows, {
      hideExitedSessions,
      isExitedThread,
    });

    return {
      visiblePinnedRows: pinnedVisibility.visibleRows,
      visibleUnpinnedRows: unpinnedVisibility.visibleRows,
      hiddenExitedCount:
        pinnedVisibility.hiddenExitedCount + unpinnedVisibility.hiddenExitedCount,
    };
  }, [hideExitedSessions, isExitedThread, pinnedRows, unpinnedRows]);
  const showHiddenExitedSummary = useMemo(
    () =>
      hideExitedSessions &&
      hiddenExitedCount > 0 &&
      visiblePinnedRows.length === 0 &&
      visibleUnpinnedRows.length === 0,
    [hiddenExitedCount, hideExitedSessions, visiblePinnedRows.length, visibleUnpinnedRows.length],
  );
  const contextMenuMoveFolderTargets =
    moveFolderTargets.length > 0 ? moveFolderTargets : undefined;
  const displayedPinnedRows = useMemo(
    () => filterCollapsedThreadRows(visiblePinnedRows, collapsedParentThreadIds),
    [collapsedParentThreadIds, visiblePinnedRows],
  );
  const displayedUnpinnedRows = useMemo(
    () => filterCollapsedThreadRows(visibleUnpinnedRows, collapsedParentThreadIds),
    [collapsedParentThreadIds, visibleUnpinnedRows],
  );
  const activeThreadParentId = useMemo(() => {
    if (workspaceId !== activeWorkspaceId || !activeThreadId) {
      return null;
    }
    const activeRow = [...visiblePinnedRows, ...visibleUnpinnedRows].find(
      (row) => row.thread.id === activeThreadId,
    );
    return activeRow?.thread.parentThreadId ?? null;
  }, [activeThreadId, activeWorkspaceId, visiblePinnedRows, visibleUnpinnedRows, workspaceId]);
  const toggleSubagentParent = useCallback((event: MouseEvent, threadId: string) => {
    event.preventDefault();
    event.stopPropagation();
    setCollapsedParentThreadIds((current) => {
      const next = new Set(current);
      if (next.has(threadId)) {
        next.delete(threadId);
      } else {
        next.add(threadId);
      }
      return next;
    });
  }, []);
  const handleSubagentParentKeyDown = useCallback(
    (event: KeyboardEvent, threadId: string) => {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      setCollapsedParentThreadIds((current) => {
        const next = new Set(current);
        if (next.has(threadId)) {
          next.delete(threadId);
        } else {
          next.add(threadId);
        }
        return next;
      });
    },
    [],
  );
  const renderThreadRow = ({ thread, depth, hasChildren = false }: ThreadRow) => {
    const relativeTime = getThreadTime(thread);
    const isActiveThread =
      workspaceId === activeWorkspaceId && thread.id === activeThreadId;
    const indentPx = depth > 0 ? depth * indentUnit : null;
    const canPin = depth === 0;
    const isPinned = canPin && isThreadPinned(workspaceId, thread.id);
    const isAutoNaming = isThreadAutoNaming(workspaceId, thread.id);
    const isSharedThread = thread.threadKind === "shared";
    const isSubagentThread = depth > 0;
    const isSubagentParent = depth === 0 && hasChildren;
    const isActiveSubagentGroup =
      isSubagentThread &&
      workspaceId === activeWorkspaceId &&
      (thread.parentThreadId === activeThreadId || thread.parentThreadId === activeThreadParentId);
    const isActiveSubagentParent =
      isSubagentParent &&
      workspaceId === activeWorkspaceId &&
      (thread.id === activeThreadId || thread.id === activeThreadParentId);
    const isPendingSubagent = isPendingSubagentThread(thread);
    const isSubagentParentCollapsed =
      isSubagentParent && collapsedParentThreadIds.has(thread.id);
    const subagentTreeToggleLabel = isSubagentParentCollapsed
      ? t("threads.subagentTreeExpand")
      : t("threads.subagentTreeCollapse");
    const selectTargetThreadId =
      isPendingSubagent && thread.parentThreadId ? thread.parentThreadId : thread.id;
    const canArchive =
      !isPendingSubagent && !isSharedThread && !thread.id.startsWith("shared:");
    const engineSource: EngineType = thread.engineSource ?? "codex";
    const baseEngineTitle =
      engineSource === "claude"
        ? "Claude Code"
        : engineSource === "gemini"
          ? "Gemini"
          : engineSource === "opencode"
            ? "OpenCode"
            : "Codex";
    const engineTitle =
      isSharedThread
        ? `Shared Session · ${baseEngineTitle}`
        : baseEngineTitle;

    const isDeleteConfirmOpen =
      deleteConfirmWorkspaceId === workspaceId && deleteConfirmThreadId === thread.id;

    return (
      <ThreadRowItem
        key={thread.id}
        canArchive={canArchive}
        canPin={canPin}
        contextMenuMoveFolderTargets={contextMenuMoveFolderTargets}
        deleteConfirmBusy={deleteConfirmBusy}
        engineSource={engineSource}
        engineTitle={engineTitle}
        hasChildren={hasChildren}
        indentPx={indentPx}
        isActiveSubagentGroup={isActiveSubagentGroup}
        isActiveSubagentParent={isActiveSubagentParent}
        isActiveThread={isActiveThread}
        isAutoNaming={isAutoNaming}
        isDeleteConfirmOpen={isDeleteConfirmOpen}
        isPendingSubagent={isPendingSubagent}
        isPinned={isPinned}
        showProviderLabels={showProviderLabels}
        isSharedThread={isSharedThread}
        isSubagentParent={isSubagentParent}
        isSubagentParentCollapsed={isSubagentParentCollapsed}
        isSubagentThread={isSubagentThread}
        nestedWorkspaceId={workspaceId}
        onCancelDeleteConfirm={onCancelDeleteConfirm}
        onConfirmDeleteConfirm={onConfirmDeleteConfirm}
        onSelectThread={onSelectThread}
        onShowThreadMenu={onShowThreadMenu}
        onToggleThreadPin={onToggleThreadPin}
        relativeTime={relativeTime}
        selectTargetThreadId={selectTargetThreadId}
        subagentTreeToggleLabel={subagentTreeToggleLabel}
        systemProxyEnabled={systemProxyEnabled}
        systemProxyUrl={systemProxyUrl}
        thread={thread}
        toggleSubagentParent={toggleSubagentParent}
        handleSubagentParentKeyDown={handleSubagentParentKeyDown}
        workspacePath={workspacePath}
        onThreadRowRender={onThreadRowRender}
      />
    );
  };

  return (
    <ThreadRowStatusProvider threadStatusById={threadStatusById}>
      <div className={`thread-list${nested ? " thread-list-nested" : ""}`}>
        {displayedPinnedRows.map((row) => renderThreadRow(row))}
        {displayedPinnedRows.length > 0 && displayedUnpinnedRows.length > 0 && (
          <div className="thread-list-separator" aria-hidden="true" />
        )}
        {displayedUnpinnedRows.map((row) => renderThreadRow(row))}
        {showHiddenExitedSummary && (
          <div className="thread-list-hidden-summary">
            {t("threads.exitedSessionsHidden", { count: hiddenExitedCount })}
          </div>
        )}
        {totalThreadRoots > visibleThreadRootCount && (
          <button
            className="thread-more"
            onClick={(event) => {
              event.stopPropagation();
              onToggleExpanded(workspaceId);
            }}
          >
            {isExpanded ? t("threads.showLess") : t("threads.more")}
          </button>
        )}
        {showLoadOlder &&
          nextCursor &&
          (isExpanded || totalThreadRoots <= visibleThreadRootCount) && (
          <button
            className="thread-more"
            onClick={(event) => {
              event.stopPropagation();
              onLoadOlderThreads(workspaceId);
            }}
            disabled={isPaging}
          >
            {isPaging
              ? t("threads.loading")
              : totalThreadRoots === 0
                ? t("threads.searchOlder")
                : t("threads.loadOlder")}
          </button>
        )}
      </div>
    </ThreadRowStatusProvider>
  );
}
