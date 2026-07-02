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
import { memo, useEffect, useState } from "react";
import type { CSSProperties, MouseEvent } from "react";
import { useTranslation } from "react-i18next";

import type { ThreadSummary } from "../../../types";
import type { ThreadMoveFolderTarget } from "../hooks/useSidebarMenus";
import { ProxyStatusBadge } from "../../../components/ProxyStatusBadge";
import { EngineIcon } from "../../engine/components/EngineIcon";
import { SharedSessionIcon } from "../../shared-session/components/SharedSessionIcon";
import { ThreadDeleteConfirmBubble } from "../../threads/components/ThreadDeleteConfirmBubble";
import { resolveCodexProviderLabel } from "../utils/codexProviderLabel";
import {
  ThreadRowStatusProvider,
  useThreadRowStatus,
  type ThreadStatusMap,
} from "./threadRowStatusStore";
import { ThreadHoverPreviewCard } from "./ThreadHoverPreviewCard";

type PinnedThreadRow = {
  thread: ThreadSummary;
  depth: number;
  workspaceId: string;
  workspacePath: string;
};

type PinnedThreadListProps = {
  rows: PinnedThreadRow[];
  activeWorkspaceId: string | null;
  activeThreadId: string | null;
  systemProxyEnabled?: boolean;
  systemProxyUrl?: string | null;
  showProviderLabels?: boolean;
  threadStatusById: ThreadStatusMap;
  moveFolderTargetsByWorkspaceId?: Record<string, ThreadMoveFolderTarget[]>;
  getThreadTime: (thread: ThreadSummary) => string | null;
  isThreadPinned: (workspaceId: string, threadId: string) => boolean;
  isThreadAutoNaming: (workspaceId: string, threadId: string) => boolean;
  onToggleThreadPin?: (workspaceId: string, threadId: string) => void;
  onSelectThread: (workspaceId: string, threadId: string) => void;
  onShowThreadMenu: (
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
  deleteConfirmThreadId?: string | null;
  deleteConfirmWorkspaceId?: string | null;
  deleteConfirmBusy?: boolean;
  onCancelDeleteConfirm?: () => void;
  onConfirmDeleteConfirm?: () => void;
  onPinnedThreadRowRender?: (threadId: string) => void;
};

type PinnedThreadRowItemProps = {
  activeThreadId: string | null;
  activeWorkspaceId: string | null;
  deleteConfirmBusy: boolean;
  deleteConfirmThreadId: string | null;
  deleteConfirmWorkspaceId: string | null;
  getThreadTime: (thread: ThreadSummary) => string | null;
  isThreadAutoNaming: (workspaceId: string, threadId: string) => boolean;
  isThreadPinned: (workspaceId: string, threadId: string) => boolean;
  moveFolderTargets?: ThreadMoveFolderTarget[];
  onCancelDeleteConfirm?: () => void;
  onConfirmDeleteConfirm?: () => void;
  onPinnedThreadRowRender?: (threadId: string) => void;
  onSelectThread: (workspaceId: string, threadId: string) => void;
  onShowThreadMenu: PinnedThreadListProps["onShowThreadMenu"];
  onToggleThreadPin?: (workspaceId: string, threadId: string) => void;
  row: PinnedThreadRow;
  showProviderLabels: boolean;
  systemProxyEnabled: boolean;
  systemProxyUrl: string | null;
};

const PinnedThreadRowItem = memo(function PinnedThreadRowItem({
  activeThreadId,
  activeWorkspaceId,
  deleteConfirmBusy,
  deleteConfirmThreadId,
  deleteConfirmWorkspaceId,
  getThreadTime,
  isThreadAutoNaming,
  isThreadPinned,
  moveFolderTargets,
  onCancelDeleteConfirm,
  onConfirmDeleteConfirm,
  onPinnedThreadRowRender,
  onSelectThread,
  onShowThreadMenu,
  onToggleThreadPin,
  row,
  showProviderLabels,
  systemProxyEnabled,
  systemProxyUrl,
}: PinnedThreadRowItemProps) {
  const { t } = useTranslation();
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const { thread, depth, workspaceId, workspacePath } = row;
  useEffect(() => {
    onPinnedThreadRowRender?.(thread.id);
  });
  const relativeTime = getThreadTime(thread);
  const indentStyle =
    depth > 0
      ? ({ "--thread-indent": `${depth * 14}px` } as CSSProperties)
      : undefined;
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
  const canPin = depth === 0;
  const isPinned = canPin && isThreadPinned(workspaceId, thread.id);
  const isAutoNaming = isThreadAutoNaming(workspaceId, thread.id);
  const showProxyBadge = systemProxyEnabled && isProcessing;
  const isSharedThread = thread.threadKind === "shared";
  const canArchive = !isSharedThread && !thread.id.startsWith("shared:");
  const contextMenuMoveFolderTargets =
    moveFolderTargets && moveFolderTargets.length > 0
      ? moveFolderTargets
      : undefined;
  const engineSource = thread.engineSource ?? "codex";
  const baseEngineTitle =
    engineSource === "claude"
      ? "Claude Code"
      : engineSource === "gemini"
        ? "Gemini"
        : engineSource === "opencode"
          ? "OpenCode"
          : "Codex";
  const engineTitle = isSharedThread
    ? `Shared Session · ${baseEngineTitle}`
    : baseEngineTitle;
  const providerLabel = resolveCodexProviderLabel(thread);
  const isProviderUnavailable = thread.providerAvailability === "unavailable";
  const isDeleteConfirmOpen =
    deleteConfirmWorkspaceId === workspaceId &&
    deleteConfirmThreadId === thread.id;
  useEffect(() => {
    if (isDeleteConfirmOpen) {
      setIsPreviewOpen(false);
    }
  }, [isDeleteConfirmOpen]);
  const previewEngineLabel = providerLabel
    ? `${engineTitle} · ${providerLabel}`
    : engineTitle;
  const previewUpdatedLabel = relativeTime
    ? t("threads.previewUpdated", { time: relativeTime })
    : null;

  return (
    <Popover
      open={isDeleteConfirmOpen}
      onOpenChange={(open) => {
        if (!open) {
          onCancelDeleteConfirm?.();
        }
      }}
    >
      <Tooltip
        open={!isDeleteConfirmOpen && isPreviewOpen}
        onOpenChange={setIsPreviewOpen}
      >
        <PopoverAnchor asChild>
          <TooltipTrigger asChild delay={220}>
            <button
              type="button"
              className={`thread-row ${
                workspaceId === activeWorkspaceId && thread.id === activeThreadId
                  ? "active"
                  : ""
              }${isDeleteConfirmOpen ? " has-delete-confirm" : ""}${
                canPin ? " has-pin-toggle" : ""
              }`}
              style={indentStyle}
              onMouseEnter={() => setIsPreviewOpen(true)}
              onMouseLeave={() => setIsPreviewOpen(false)}
              onFocus={() => setIsPreviewOpen(true)}
              onBlur={() => setIsPreviewOpen(false)}
              onClick={() => {
                setIsPreviewOpen(false);
                onSelectThread(workspaceId, thread.id);
              }}
              onContextMenu={(event) => {
                setIsPreviewOpen(false);
                onShowThreadMenu(
                  event,
                  workspaceId,
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
                  setIsPreviewOpen(false);
                  onSelectThread(workspaceId, thread.id);
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
                  onToggleThreadPin(workspaceId, thread.id);
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
                isSharedThread
                  ? "thread-engine-shared"
                  : `thread-engine-${engineSource}`
              }${isProcessing ? " is-processing" : ""}`}
              title={engineTitle}
            >
              {isSharedThread ? (
                <SharedSessionIcon size={12} />
              ) : (
                <EngineIcon engine={engineSource} size={12} />
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
              {isAutoNaming && (
                <span className="thread-auto-naming">
                  {t("threads.autoNaming")}
                </span>
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
                <span
                  className={`thread-runtime-badge thread-runtime-badge--${runtimeBadge.severity}`}
                >
                  {runtimeBadge.label}
                </span>
              ) : null}
              {relativeTime ? (
                <span className="thread-time">{relativeTime}</span>
              ) : null}
            </div>
            </button>
          </TooltipTrigger>
        </PopoverAnchor>
        {!isDeleteConfirmOpen && isPreviewOpen && (
          <TooltipPopup
            side="right"
            align="start"
            sideOffset={12}
            className="thread-hover-preview-tooltip"
          >
            <ThreadHoverPreviewCard
              kindLabel={t("threads.previewKind")}
              activeLabel={t("threads.previewActive")}
              pinnedLabel={t("threads.previewPinned")}
              isActive={
                workspaceId === activeWorkspaceId && thread.id === activeThreadId
              }
              isPinned={isPinned}
              threadName={thread.name}
              statusTitle={t("threads.previewStatus")}
              statusLabel={runtimeBadge?.label ?? null}
              updatedLabel={previewUpdatedLabel}
              engineTitle={t("threads.previewEngine")}
              engineLabel={previewEngineLabel}
              workspaceLabel={t("threads.previewWorkspace")}
              workspacePath={workspacePath || null}
            />
          </TooltipPopup>
        )}
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

export function PinnedThreadList({
  rows,
  activeWorkspaceId,
  activeThreadId,
  systemProxyEnabled = false,
  systemProxyUrl = null,
  showProviderLabels = false,
  threadStatusById,
  moveFolderTargetsByWorkspaceId = {},
  getThreadTime,
  isThreadPinned,
  isThreadAutoNaming,
  onToggleThreadPin,
  onSelectThread,
  onShowThreadMenu,
  deleteConfirmThreadId = null,
  deleteConfirmWorkspaceId = null,
  deleteConfirmBusy = false,
  onCancelDeleteConfirm,
  onConfirmDeleteConfirm,
  onPinnedThreadRowRender,
}: PinnedThreadListProps) {
  return (
    <ThreadRowStatusProvider threadStatusById={threadStatusById}>
      <div className="thread-list pinned-thread-list">
        {rows.map((row) => (
          <PinnedThreadRowItem
            key={`${row.workspaceId}:${row.thread.id}`}
            activeThreadId={activeThreadId}
            activeWorkspaceId={activeWorkspaceId}
            deleteConfirmBusy={deleteConfirmBusy}
            deleteConfirmThreadId={deleteConfirmThreadId}
            deleteConfirmWorkspaceId={deleteConfirmWorkspaceId}
            getThreadTime={getThreadTime}
            isThreadAutoNaming={isThreadAutoNaming}
            isThreadPinned={isThreadPinned}
            moveFolderTargets={moveFolderTargetsByWorkspaceId[row.workspaceId]}
            onCancelDeleteConfirm={onCancelDeleteConfirm}
            onConfirmDeleteConfirm={onConfirmDeleteConfirm}
            onPinnedThreadRowRender={onPinnedThreadRowRender}
            onSelectThread={onSelectThread}
            onShowThreadMenu={onShowThreadMenu}
            onToggleThreadPin={onToggleThreadPin}
            row={row}
            showProviderLabels={showProviderLabels}
            systemProxyEnabled={systemProxyEnabled}
            systemProxyUrl={systemProxyUrl}
          />
        ))}
      </div>
    </ThreadRowStatusProvider>
  );
}
