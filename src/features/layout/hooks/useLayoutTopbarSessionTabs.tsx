import { useCallback, useEffect, useReducer, useRef, useState, type ReactNode } from "react";
import { TopbarSessionTabs } from "../../app/components/TopbarSessionTabs";
import {
  clampRendererContextMenuPosition,
  RendererContextMenu,
  type RendererContextMenuState,
} from "../../../components/ui/RendererContextMenu";
import type { ThreadSummary } from "../../../types";
import {
  isEditableShortcutTarget,
  matchesShortcutForPlatform,
} from "../../../utils/shortcuts";
import {
  TOPBAR_SESSION_TAB_MAX,
  buildTopbarSessionTabItems,
  createEmptyTopbarSessionWindows,
  dismissAllTopbarSessionTabs,
  dismissCompletedTopbarSessionTabs,
  dismissTopbarSessionTab,
  dismissTopbarSessionTabsToLeft,
  dismissTopbarSessionTabsToRight,
  pickAdjacentOpenSessionTab,
  pickAdjacentTopbarSessionFallbackTab,
  pruneTopbarSessionWindows,
  recordTopbarSessionActivation,
  type TopbarSessionWindows,
} from "./topbarSessionTabs";

type TopbarThreadStatus = {
  isProcessing: boolean;
};

type UseLayoutTopbarSessionTabsInput = {
  activeThreadId: string | null;
  activeWorkspaceId: string | null;
  closeCurrentSessionShortcut: string | null;
  cycleOpenSessionNextShortcut: string | null;
  cycleOpenSessionPrevShortcut: string | null;
  isPhone: boolean;
  isTablet: boolean;
  showTopSessionTabs: boolean;
  threadStatusById: Record<string, TopbarThreadStatus>;
  threadsByWorkspace: Record<string, ThreadSummary[]>;
  t: (key: string) => string;
  onSelectThread: (workspaceId: string, threadId: string) => void;
  onSelectWorkspace: (workspaceId: string) => void;
};

type UseLayoutTopbarSessionTabsResult = {
  contextMenuNode: ReactNode;
  sessionTabsNode: ReactNode;
};

function toTopbarTabKey(workspaceId: string, threadId: string): string {
  return `${workspaceId}::${threadId}`;
}

export function useLayoutTopbarSessionTabs(
  input: UseLayoutTopbarSessionTabsInput,
): UseLayoutTopbarSessionTabsResult {
  const [, forceTopbarSessionRender] = useReducer((value: number) => value + 1, 0);
  const [topbarTabContextMenu, setTopbarTabContextMenu] =
    useState<RendererContextMenuState | null>(null);
  const topbarSessionWindowsRef = useRef<TopbarSessionWindows>(
    createEmptyTopbarSessionWindows(),
  );
  const pendingTopbarSelectionRef = useRef<{
    workspaceId: string;
    threadId: string;
    setAt: number;
  } | null>(null);
  const dismissedTopbarTabKeysRef = useRef<Set<string>>(new Set());
  const lastActivationRef = useRef<{
    initialized: boolean;
    workspaceId: string | null;
    threadId: string | null;
  }>({
    initialized: false,
    workspaceId: null,
    threadId: null,
  });

  topbarSessionWindowsRef.current = pruneTopbarSessionWindows(
    topbarSessionWindowsRef.current,
    input.threadsByWorkspace,
  );

  const currentActivation = {
    workspaceId: input.activeWorkspaceId,
    threadId: input.activeThreadId,
  };
  if (!lastActivationRef.current.initialized) {
    lastActivationRef.current = {
      initialized: true,
      workspaceId: currentActivation.workspaceId,
      threadId: currentActivation.threadId,
    };
  } else {
    const isActivationChanged =
      currentActivation.workspaceId !== lastActivationRef.current.workspaceId ||
      currentActivation.threadId !== lastActivationRef.current.threadId;
    if (
      isActivationChanged &&
      currentActivation.workspaceId &&
      currentActivation.threadId
    ) {
      dismissedTopbarTabKeysRef.current.delete(
        toTopbarTabKey(
          currentActivation.workspaceId,
          currentActivation.threadId,
        ),
      );
      topbarSessionWindowsRef.current = recordTopbarSessionActivation(
        topbarSessionWindowsRef.current,
        currentActivation.workspaceId,
        currentActivation.threadId,
        input.threadsByWorkspace,
        TOPBAR_SESSION_TAB_MAX,
      );
    }
    lastActivationRef.current = {
      initialized: true,
      workspaceId: currentActivation.workspaceId,
      threadId: currentActivation.threadId,
    };
  }

  if (currentActivation.workspaceId && currentActivation.threadId) {
    const activeKey = toTopbarTabKey(
      currentActivation.workspaceId,
      currentActivation.threadId,
    );
    const activeExists = topbarSessionWindowsRef.current.tabs.some(
      (tab) =>
        tab.workspaceId === currentActivation.workspaceId &&
        tab.threadId === currentActivation.threadId,
    );
    if (!activeExists && !dismissedTopbarTabKeysRef.current.has(activeKey)) {
      topbarSessionWindowsRef.current = recordTopbarSessionActivation(
        topbarSessionWindowsRef.current,
        currentActivation.workspaceId,
        currentActivation.threadId,
        input.threadsByWorkspace,
        TOPBAR_SESSION_TAB_MAX,
      );
    }
  }

  const pendingSelection = pendingTopbarSelectionRef.current;
  if (
    pendingSelection &&
    pendingSelection.workspaceId === input.activeWorkspaceId &&
    pendingSelection.threadId === input.activeThreadId
  ) {
    pendingTopbarSelectionRef.current = null;
  } else if (
    pendingSelection &&
    Date.now() - pendingSelection.setAt > 1800
  ) {
    pendingTopbarSelectionRef.current = null;
  }

  const highlightedWorkspaceId =
    pendingTopbarSelectionRef.current?.workspaceId ?? input.activeWorkspaceId;
  const highlightedThreadId =
    pendingTopbarSelectionRef.current?.threadId ?? input.activeThreadId;
  const selectedWorkspaceId = input.activeWorkspaceId;
  const selectedThreadId = input.activeThreadId;
  const selectThread = input.onSelectThread;
  const selectWorkspace = input.onSelectWorkspace;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat) {
        return;
      }
      if (
        isEditableShortcutTarget(event.target) ||
        isEditableShortcutTarget(document.activeElement)
      ) {
        return;
      }
      const matchesNext = matchesShortcutForPlatform(
        event,
        input.cycleOpenSessionNextShortcut,
      );
      const matchesPrev = matchesShortcutForPlatform(
        event,
        input.cycleOpenSessionPrevShortcut,
      );
      if (!matchesNext && !matchesPrev) {
        return;
      }
      const targetTab = pickAdjacentOpenSessionTab(
        topbarSessionWindowsRef.current,
        input.activeWorkspaceId,
        input.activeThreadId,
        matchesNext ? "next" : "prev",
      );
      if (!targetTab) {
        return;
      }
      event.preventDefault();
      pendingTopbarSelectionRef.current = {
        workspaceId: targetTab.workspaceId,
        threadId: targetTab.threadId,
        setAt: Date.now(),
      };
      forceTopbarSessionRender();
      selectThread(targetTab.workspaceId, targetTab.threadId);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    input.activeThreadId,
    input.activeWorkspaceId,
    input.cycleOpenSessionNextShortcut,
    input.cycleOpenSessionPrevShortcut,
    selectThread,
  ]);

  const topbarSessionTabItems = buildTopbarSessionTabItems(
    highlightedWorkspaceId,
    highlightedThreadId,
    input.threadsByWorkspace,
    topbarSessionWindowsRef.current,
    input.t("threads.untitledThread"),
    {
      codex: input.t("settings.projectSessionEngineCodex"),
      claude: input.t("settings.projectSessionEngineClaude"),
      gemini: input.t("settings.projectSessionEngineGemini"),
      opencode: input.t("settings.projectSessionEngineOpencode"),
    },
  );

  const applyTopbarWindowMutation = useCallback(
    (
      mutate: (windows: TopbarSessionWindows) => TopbarSessionWindows,
      fallbackWorkspaceId: string,
    ) => {
      const previousWindows = topbarSessionWindowsRef.current;
      const nextWindows = mutate(previousWindows);
      if (nextWindows === previousWindows) {
        return;
      }
      const previousTabKeys = new Set(
        previousWindows.tabs.map((tab) => toTopbarTabKey(tab.workspaceId, tab.threadId)),
      );
      const nextTabKeys = new Set(
        nextWindows.tabs.map((tab) => toTopbarTabKey(tab.workspaceId, tab.threadId)),
      );
      previousTabKeys.forEach((tabKey) => {
        if (!nextTabKeys.has(tabKey)) {
          dismissedTopbarTabKeysRef.current.add(tabKey);
        }
      });
      topbarSessionWindowsRef.current = nextWindows;
      if (pendingTopbarSelectionRef.current) {
        const pendingKey = toTopbarTabKey(
          pendingTopbarSelectionRef.current.workspaceId,
          pendingTopbarSelectionRef.current.threadId,
        );
        if (!nextTabKeys.has(pendingKey)) {
          pendingTopbarSelectionRef.current = null;
        }
      }
      const activeWorkspaceId = selectedWorkspaceId;
      const activeThreadId = selectedThreadId;
      const activeKey =
        activeWorkspaceId && activeThreadId
          ? toTopbarTabKey(activeWorkspaceId, activeThreadId)
          : null;
      const isActiveRemoved = Boolean(activeKey && !nextTabKeys.has(activeKey));
      forceTopbarSessionRender();
      if (!isActiveRemoved || !activeWorkspaceId || !activeThreadId) {
        return;
      }
      const fallbackTab = pickAdjacentTopbarSessionFallbackTab(
        previousWindows,
        nextWindows,
        activeWorkspaceId,
        activeThreadId,
      );
      if (fallbackTab) {
        pendingTopbarSelectionRef.current = {
          workspaceId: fallbackTab.workspaceId,
          threadId: fallbackTab.threadId,
          setAt: Date.now(),
        };
        forceTopbarSessionRender();
        selectThread(fallbackTab.workspaceId, fallbackTab.threadId);
        return;
      }
      selectWorkspace(activeWorkspaceId || fallbackWorkspaceId);
    },
    [selectedThreadId, selectedWorkspaceId, selectThread, selectWorkspace],
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat) {
        return;
      }
      if (!matchesShortcutForPlatform(event, input.closeCurrentSessionShortcut)) {
        return;
      }
      event.preventDefault();
      if (!input.activeWorkspaceId || !input.activeThreadId) {
        return;
      }
      applyTopbarWindowMutation(
        (windows) =>
          dismissTopbarSessionTab(
            windows,
            input.activeWorkspaceId ?? "",
            input.activeThreadId ?? "",
          ),
        input.activeWorkspaceId,
      );
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    applyTopbarWindowMutation,
    input.activeThreadId,
    input.activeWorkspaceId,
    input.closeCurrentSessionShortcut,
  ]);

  const showTopbarTabMenu = useCallback(
    (
      position: { x: number; y: number },
      workspaceId: string,
      threadId: string,
    ) => {
      const currentWindows = topbarSessionWindowsRef.current;
      const targetIndex = currentWindows.tabs.findIndex(
        (tab) => tab.workspaceId === workspaceId && tab.threadId === threadId,
      );
      if (targetIndex < 0) {
        return;
      }
      const hasLeftTabs = targetIndex > 0;
      const hasRightTabs = targetIndex < currentWindows.tabs.length - 1;
      const hasCompletedTabs = currentWindows.tabs.some(
        (tab) => input.threadStatusById[tab.threadId]?.isProcessing === false,
      );
      const clampedPosition = clampRendererContextMenuPosition(position.x, position.y, {
        width: 260,
        height: 220,
      });
      setTopbarTabContextMenu({
        ...clampedPosition,
        label: input.t("threads.topbarSessionTabsAriaLabel"),
        items: [
          {
            type: "item",
            id: "close-tab",
            label: input.t("threads.closeTab"),
            onSelect: () => {
              applyTopbarWindowMutation(
                (windows) => dismissTopbarSessionTab(windows, workspaceId, threadId),
                workspaceId,
              );
            },
          },
          {
            type: "item",
            id: "close-left-tabs",
            label: input.t("threads.closeLeftTabs"),
            disabled: !hasLeftTabs,
            onSelect: () => {
              applyTopbarWindowMutation(
                (windows) => dismissTopbarSessionTabsToLeft(windows, workspaceId, threadId),
                workspaceId,
              );
            },
          },
          {
            type: "item",
            id: "close-right-tabs",
            label: input.t("threads.closeRightTabs"),
            disabled: !hasRightTabs,
            onSelect: () => {
              applyTopbarWindowMutation(
                (windows) => dismissTopbarSessionTabsToRight(windows, workspaceId, threadId),
                workspaceId,
              );
            },
          },
          {
            type: "item",
            id: "close-all-tabs",
            label: input.t("threads.closeAllTabs"),
            onSelect: () => {
              applyTopbarWindowMutation(
                (windows) => dismissAllTopbarSessionTabs(windows),
                workspaceId,
              );
            },
          },
          {
            type: "item",
            id: "close-completed-tabs",
            label: input.t("threads.closeCompletedTabs"),
            disabled: !hasCompletedTabs,
            onSelect: () => {
              applyTopbarWindowMutation(
                (windows) => dismissCompletedTopbarSessionTabs(windows, input.threadStatusById),
                workspaceId,
              );
            },
          },
        ],
      });
    },
    [applyTopbarWindowMutation, input],
  );

  const sessionTabsNode =
    !input.isPhone && !input.isTablet && input.showTopSessionTabs ? (
      <TopbarSessionTabs
        tabs={topbarSessionTabItems}
        ariaLabel={input.t("threads.topbarSessionTabsAriaLabel")}
        onSelectThread={(workspaceId, threadId) => {
          const isCurrentTab =
            workspaceId === input.activeWorkspaceId &&
            threadId === input.activeThreadId;
          if (isCurrentTab) {
            return;
          }
          pendingTopbarSelectionRef.current = {
            workspaceId,
            threadId,
            setAt: Date.now(),
          };
          forceTopbarSessionRender();
          input.onSelectThread(workspaceId, threadId);
        }}
        onCloseThread={(workspaceId, threadId) => {
          applyTopbarWindowMutation(
            (windows) => dismissTopbarSessionTab(windows, workspaceId, threadId),
            workspaceId,
          );
        }}
        onShowTabMenu={showTopbarTabMenu}
      />
    ) : null;

  const contextMenuNode = topbarTabContextMenu ? (
    <RendererContextMenu
      menu={topbarTabContextMenu}
      onClose={() => setTopbarTabContextMenu(null)}
      className="renderer-context-menu topbar-session-context-menu"
    />
  ) : null;

  return {
    contextMenuNode,
    sessionTabsNode,
  };
}
