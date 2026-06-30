import type { ConversationItem } from "../../../types";

export type ShellThreadStatusSummary = {
  isProcessing?: boolean;
  hasUnread?: boolean;
  isReviewing?: boolean;
  isContextCompacting?: boolean;
};

export type ShellRuntimeSummary = {
  activeWorkspaceId: string | null;
  activeThreadId: string | null;
  isActiveThreadProcessing: boolean;
  isActiveThreadReviewing: boolean;
  isActiveThreadContextCompacting: boolean;
  hasActiveThreadUnread: boolean;
  canCopyActiveThread: boolean;
  sidebarSubagentItems: ConversationItem[];
};

export type BuildShellRuntimeSummaryInput = {
  activeWorkspaceId: string | null;
  activeThreadId: string | null;
  activeItems: ConversationItem[];
  activeThreadStatus: ShellThreadStatusSummary | null | undefined;
};

export const EMPTY_SIDEBAR_SUBAGENT_ITEMS: ConversationItem[] = [];

function isClaudeThreadId(threadId: string | null | undefined): boolean {
  return Boolean(
    threadId?.startsWith("claude:") ||
      threadId?.startsWith("claude-pending-"),
  );
}

function selectSidebarSubagentItems(
  activeThreadId: string | null,
  activeItems: ConversationItem[],
): ConversationItem[] {
  if (!isClaudeThreadId(activeThreadId)) {
    return EMPTY_SIDEBAR_SUBAGENT_ITEMS;
  }
  const toolItems = activeItems.filter((item) => item.kind === "tool");
  return toolItems.length > 0 ? toolItems : EMPTY_SIDEBAR_SUBAGENT_ITEMS;
}

export function buildShellRuntimeSummary({
  activeWorkspaceId,
  activeThreadId,
  activeItems,
  activeThreadStatus,
}: BuildShellRuntimeSummaryInput): ShellRuntimeSummary {
  return {
    activeWorkspaceId,
    activeThreadId,
    isActiveThreadProcessing: activeThreadStatus?.isProcessing ?? false,
    isActiveThreadReviewing: activeThreadStatus?.isReviewing ?? false,
    isActiveThreadContextCompacting:
      activeThreadStatus?.isContextCompacting ?? false,
    hasActiveThreadUnread: activeThreadStatus?.hasUnread ?? false,
    canCopyActiveThread: activeItems.length > 0,
    sidebarSubagentItems: selectSidebarSubagentItems(
      activeThreadId,
      activeItems,
    ),
  };
}
