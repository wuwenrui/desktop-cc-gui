import { useMemo, useSyncExternalStore } from "react";

import type { RateLimitSnapshot, ThreadTokenUsage } from "../../../types";
import type { MessagesProps } from "../../messages/components/messagesTypes";
import type { ThreadActivityStatus } from "./layoutNodesTypes";

export type ActiveCanvasSnapshot = Pick<
  MessagesProps,
  | "items"
  | "threadId"
  | "workspaceId"
  | "workspacePath"
  | "userInputRequests"
  | "approvals"
  | "conversationState"
  | "plan"
  | "isThinking"
  | "isHistoryLoading"
  | "isContextCompacting"
  | "processingStartedAt"
  | "lastDurationMs"
  | "heartbeatPulse"
  | "codexSilentSuspectedAt"
  | "taskRuns"
> & {
  activeWorkspaceId: string | null;
  activeTurnId: string | null;
  threadItemsByThread: Record<string, MessagesProps["items"]>;
  threadStatusById: Record<string, ThreadActivityStatus>;
  activeThreadStatus: ThreadActivityStatus | null;
  activeTokenUsage: ThreadTokenUsage | null;
  activeRateLimits: RateLimitSnapshot | null;
};

export type ActiveCanvasStore = {
  getSnapshot: () => ActiveCanvasSnapshot;
  setSnapshot: (snapshot: ActiveCanvasSnapshot) => void;
  subscribe: (listener: () => void) => () => void;
  subscribeSelector: <T>(
    selector: (snapshot: ActiveCanvasSnapshot) => T,
    listener: () => void,
    isEqual?: (left: T, right: T) => boolean,
  ) => () => void;
};

export const EMPTY_ACTIVE_CANVAS_ITEMS: MessagesProps["items"] = [];
export const EMPTY_ACTIVE_CANVAS_THREAD_ITEMS: Record<
  string,
  MessagesProps["items"]
> = {};
export const EMPTY_ACTIVE_CANVAS_THREAD_STATUS: Record<
  string,
  ThreadActivityStatus
> = {};
export const EMPTY_ACTIVE_CANVAS_TASK_RUNS: NonNullable<
  MessagesProps["taskRuns"]
> = [];

export const EMPTY_ACTIVE_CANVAS_SNAPSHOT: ActiveCanvasSnapshot = {
  activeWorkspaceId: null,
  activeTurnId: null,
  items: EMPTY_ACTIVE_CANVAS_ITEMS,
  threadId: null,
  workspaceId: null,
  workspacePath: null,
  userInputRequests: [],
  approvals: [],
  conversationState: null,
  plan: null,
  isThinking: false,
  isHistoryLoading: false,
  isContextCompacting: false,
  processingStartedAt: null,
  lastDurationMs: null,
  heartbeatPulse: 0,
  codexSilentSuspectedAt: null,
  taskRuns: EMPTY_ACTIVE_CANVAS_TASK_RUNS,
  threadItemsByThread: EMPTY_ACTIVE_CANVAS_THREAD_ITEMS,
  threadStatusById: EMPTY_ACTIVE_CANVAS_THREAD_STATUS,
  activeThreadStatus: null,
  activeTokenUsage: null,
  activeRateLimits: null,
};

export function shallowEqual<T extends Record<string, unknown>>(
  left: T,
  right: T,
): boolean {
  if (Object.is(left, right)) {
    return true;
  }
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) {
    return false;
  }
  return leftKeys.every((key) => Object.is(left[key], right[key]));
}

export function createActiveCanvasStore(
  initialSnapshot: ActiveCanvasSnapshot = EMPTY_ACTIVE_CANVAS_SNAPSHOT,
): ActiveCanvasStore {
  let snapshot = initialSnapshot;
  const listeners = new Set<() => void>();

  const notify = () => {
    listeners.forEach((listener) => listener());
  };

  return {
    getSnapshot: () => snapshot,
    setSnapshot: (nextSnapshot) => {
      if (Object.is(snapshot, nextSnapshot)) {
        return;
      }
      snapshot = nextSnapshot;
      notify();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    subscribeSelector: (selector, listener, isEqual = Object.is) => {
      let selected = selector(snapshot);
      return activeCanvasStoreSubscribe(listeners, () => {
        const nextSelected = selector(snapshot);
        if (isEqual(selected, nextSelected)) {
          return;
        }
        selected = nextSelected;
        listener();
      });
    },
  };
}

function activeCanvasStoreSubscribe(
  listeners: Set<() => void>,
  listener: () => void,
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export const activeCanvasStore = createActiveCanvasStore();

export function setActiveCanvasSnapshot(snapshot: ActiveCanvasSnapshot): void {
  activeCanvasStore.setSnapshot(snapshot);
}

export function getActiveCanvasSnapshot(): ActiveCanvasSnapshot {
  return activeCanvasStore.getSnapshot();
}

export function useActiveCanvasSelector<T>(
  selector: (snapshot: ActiveCanvasSnapshot) => T,
  isEqual: (left: T, right: T) => boolean = Object.is,
): T {
  const selectedStore = useMemo(() => {
    let selected = selector(activeCanvasStore.getSnapshot());
    const getSelectedSnapshot = () => selected;
    const subscribeSelected = (listener: () => void) =>
      activeCanvasStore.subscribeSelector(
        selector,
        () => {
          selected = selector(activeCanvasStore.getSnapshot());
          listener();
        },
        isEqual,
      );

    return {
      getSelectedSnapshot,
      subscribeSelected,
    };
  }, [isEqual, selector]);

  return useSyncExternalStore(
    selectedStore.subscribeSelected,
    selectedStore.getSelectedSnapshot,
    selectedStore.getSelectedSnapshot,
  );
}
