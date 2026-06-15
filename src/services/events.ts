import { listen } from "@tauri-apps/api/event";
import type {
  AppServerEvent,
  DictationEvent,
  DictationModelStatus,
} from "../types";
import type { CliInstallProgressEvent } from "../types";
import type { RuntimeLogSessionSnapshot } from "./tauri";
import { createEventBackpressure } from "./eventBackpressure";
import { appendEventBackpressureDiagnostic } from "./rendererDiagnostics";

export type Unsubscribe = () => void;
export const WEB_SERVICE_RECONNECTED_EVENT =
  "ccgui:web-service-reconnected" as const;

export type TerminalOutputEvent = {
  workspaceId: string;
  terminalId: string;
  data: string;
};

export type RuntimeLogLineEvent = TerminalOutputEvent;

export type DetachedExternalFileChangeEvent = {
  workspaceId: string;
  normalizedPath: string;
  mtimeMs?: number | null;
  size?: number | null;
  detectedAtMs: number;
  source: "watcher" | "polling" | string;
  eventKind: string;
  platform: string;
  fallbackReason?: string | null;
};

type SubscriptionOptions = {
  onError?: (error: unknown) => void;
};

type Listener<T> = (payload: T) => void;

type EventHubOptions<T> = {
  backpressure?: ReturnType<typeof createEventBackpressure<T>>;
};

function deliverEvent<T>(
  eventName: string,
  listeners: Set<Listener<T>>,
  payload: T,
) {
  for (const listener of listeners) {
    try {
      listener(payload);
    } catch (error) {
      console.error(`[events] ${eventName} listener failed`, error);
    }
  }
}

function createEventHub<T>(eventName: string, hubOptions: EventHubOptions<T> = {}) {
  const listeners = new Set<Listener<T>>();
  let unlisten: Unsubscribe | null = null;
  let listenPromise: Promise<Unsubscribe> | null = null;
  const backpressureUnsubscribe = hubOptions.backpressure?.subscribe((payload) => {
    deliverEvent(eventName, listeners, payload);
  });

  const start = (options?: SubscriptionOptions) => {
    if (unlisten || listenPromise) {
      return;
    }
    listenPromise = listen<T>(eventName, (event) => {
      if (hubOptions.backpressure) {
        hubOptions.backpressure.push(event.payload);
        return;
      }
      deliverEvent(eventName, listeners, event.payload);
    });
    listenPromise
      .then((handler) => {
        listenPromise = null;
        if (listeners.size === 0) {
          handler();
          return;
        }
        unlisten = handler;
      })
      .catch((error) => {
        listenPromise = null;
        options?.onError?.(error);
      });
  };

  const stop = () => {
    if (unlisten) {
      try {
        unlisten();
      } catch {
        // Ignore double-unlisten when tearing down.
      }
      unlisten = null;
    }
  };

  const subscribe = (
    onEvent: Listener<T>,
    options?: SubscriptionOptions,
  ): Unsubscribe => {
    listeners.add(onEvent);
    start(options);
    return () => {
      listeners.delete(onEvent);
      if (listeners.size === 0) {
        stop();
      }
    };
  };

  return { subscribe, disposeBackpressure: backpressureUnsubscribe };
}

function terminalOutputBytes(event: TerminalOutputEvent) {
  return event.data.length;
}

function runtimeStatusCoalesceKey(event: RuntimeLogSessionSnapshot) {
  return [
    event.workspaceId,
    event.terminalId,
    event.status,
    event.exitCode ?? "none",
    Boolean(event.error),
  ].join(":");
}

function runtimeStatusCriticality(event: RuntimeLogSessionSnapshot) {
  return event.status === "failed" || event.status === "stopped"
    ? "critical"
    : "non-critical";
}

const terminalOutputBackpressure = createEventBackpressure<TerminalOutputEvent>({
  surfaceId: "terminal-output",
  eventKind: "terminal-output",
  estimateBytes: terminalOutputBytes,
  onStats: appendEventBackpressureDiagnostic,
});

const runtimeLogLineBackpressure = createEventBackpressure<RuntimeLogLineEvent>({
  surfaceId: "runtime-log-line",
  eventKind: "runtime-log-line",
  estimateBytes: terminalOutputBytes,
  onStats: appendEventBackpressureDiagnostic,
});

const runtimeLogStatusBackpressure =
  createEventBackpressure<RuntimeLogSessionSnapshot>({
    surfaceId: "runtime-log-status",
    eventKind: "runtime-log-status",
    classify: runtimeStatusCriticality,
    coalesceKey: runtimeStatusCoalesceKey,
    onStats: appendEventBackpressureDiagnostic,
  });

const appServerHub = createEventHub<AppServerEvent>("app-server-event");

/**
 * Batch channel emitted by `BatchedTauriEventSink` (Rust). The payload is a
 * `Vec<AppServerEvent>` ordered by arrival within a workspace; the
 * batch-aware route in `useAppServerEvents` is responsible for dispatching
 * each event to the original handler with coalescing / budgeted flush, NOT
 * a tight synchronous loop.
 */
const appServerBatchHub = createEventHub<readonly AppServerEvent[]>(
  "app-server-event-batch",
);
const dictationDownloadHub =
  createEventHub<DictationModelStatus>("dictation-download");
const dictationEventHub = createEventHub<DictationEvent>("dictation-event");
const terminalOutputHub =
  createEventHub<TerminalOutputEvent>("terminal-output", {
    backpressure: terminalOutputBackpressure,
  });
const runtimeLogLineHub = createEventHub<RuntimeLogLineEvent>(
  "runtime-log:line-appended",
  { backpressure: runtimeLogLineBackpressure },
);
const runtimeLogStatusHub = createEventHub<RuntimeLogSessionSnapshot>(
  "runtime-log:status-changed",
  { backpressure: runtimeLogStatusBackpressure },
);
const runtimeLogExitedHub = createEventHub<RuntimeLogSessionSnapshot>(
  "runtime-log:session-exited",
);
const cliInstallerHub = createEventHub<CliInstallProgressEvent>(
  "cli-installer-event",
);
const detachedExternalFileChangeHub =
  createEventHub<DetachedExternalFileChangeEvent>(
    "detached-external-file-change",
  );

/**
 * Batch channel emitted by the Rust `DebouncedExternalChangeEmitter`.
 * The payload is a `Vec<DetachedExternalFileChangeEvent>` ordered by
 * arrival, with same-`(workspace_id, normalized_path)` events coalesced
 * to the latest within a 100ms window.
 */
const detachedExternalFileChangeBatchHub =
  createEventHub<readonly DetachedExternalFileChangeEvent[]>(
    "detached-external-file-change-batch",
  );
const updaterCheckHub = createEventHub<void>("updater-check");
const menuNewAgentHub = createEventHub<void>("menu-new-agent");
const menuNewWorktreeAgentHub = createEventHub<void>("menu-new-worktree-agent");
const menuNewCloneAgentHub = createEventHub<void>("menu-new-clone-agent");
const menuNewWindowHub = createEventHub<void>("menu-new-window");
const menuAddWorkspaceHub = createEventHub<void>("menu-add-workspace");
const menuOpenSettingsHub = createEventHub<void>("menu-open-settings");
const menuToggleProjectsSidebarHub = createEventHub<void>(
  "menu-toggle-projects-sidebar",
);
const menuToggleGitSidebarHub = createEventHub<void>("menu-toggle-git-sidebar");
const menuToggleGlobalSearchHub = createEventHub<void>(
  "menu-toggle-global-search",
);
const menuToggleDebugPanelHub = createEventHub<void>("menu-toggle-debug-panel");
const menuToggleTerminalHub = createEventHub<void>("menu-toggle-terminal");
const menuNextAgentHub = createEventHub<void>("menu-next-agent");
const menuPrevAgentHub = createEventHub<void>("menu-prev-agent");
const menuNextWorkspaceHub = createEventHub<void>("menu-next-workspace");
const menuPrevWorkspaceHub = createEventHub<void>("menu-prev-workspace");
const menuCycleModelHub = createEventHub<void>("menu-composer-cycle-model");
const menuCycleAccessHub = createEventHub<void>("menu-composer-cycle-access");
const menuCycleReasoningHub = createEventHub<void>(
  "menu-composer-cycle-reasoning",
);
const menuCycleCollaborationHub = createEventHub<void>(
  "menu-composer-cycle-collaboration",
);
const menuComposerCycleModelHub = createEventHub<void>(
  "menu-composer-cycle-model",
);
const menuComposerCycleAccessHub = createEventHub<void>(
  "menu-composer-cycle-access",
);
const menuComposerCycleReasoningHub = createEventHub<void>(
  "menu-composer-cycle-reasoning",
);
const menuComposerCycleCollaborationHub = createEventHub<void>(
  "menu-composer-cycle-collaboration",
);
const openPathsHub = createEventHub<string[]>("open-paths");

export function subscribeAppServerEvents(
  onEvent: (event: AppServerEvent) => void,
  options?: SubscriptionOptions,
): Unsubscribe {
  return appServerHub.subscribe(onEvent, options);
}

/**
 * Subscribe to the Rust-side batched app server event channel.
 *
 * Callers should use this in preference to `subscribeAppServerEvents` when
 * the backend has `BatchedTauriEventSink` enabled. The default
 * `useAppServerEvents` consumer routes both channels through a single
 * batch-aware path so the frontend does not pay per-event reducer dispatch
 * cost for every raw event.
 */
export function subscribeAppServerEventBatch(
  onBatch: (events: readonly AppServerEvent[]) => void,
  options?: SubscriptionOptions,
): Unsubscribe {
  return appServerBatchHub.subscribe(onBatch, options);
}

export function subscribeWebServiceReconnect(
  onReconnect: () => void,
): Unsubscribe {
  if (typeof window === "undefined") {
    return () => {};
  }
  const handler = () => {
    onReconnect();
  };
  window.addEventListener(WEB_SERVICE_RECONNECTED_EVENT, handler);
  return () => {
    window.removeEventListener(WEB_SERVICE_RECONNECTED_EVENT, handler);
  };
}

export function subscribeDictationDownload(
  onEvent: (event: DictationModelStatus) => void,
  options?: SubscriptionOptions,
): Unsubscribe {
  return dictationDownloadHub.subscribe(onEvent, options);
}

export function subscribeDictationEvents(
  onEvent: (event: DictationEvent) => void,
  options?: SubscriptionOptions,
): Unsubscribe {
  return dictationEventHub.subscribe(onEvent, options);
}

export function subscribeTerminalOutput(
  onEvent: (event: TerminalOutputEvent) => void,
  options?: SubscriptionOptions,
): Unsubscribe {
  return terminalOutputHub.subscribe(onEvent, options);
}

export function subscribeRuntimeLogLine(
  onEvent: (event: RuntimeLogLineEvent) => void,
  options?: SubscriptionOptions,
): Unsubscribe {
  return runtimeLogLineHub.subscribe(onEvent, options);
}

export function subscribeRuntimeLogStatus(
  onEvent: (event: RuntimeLogSessionSnapshot) => void,
  options?: SubscriptionOptions,
): Unsubscribe {
  return runtimeLogStatusHub.subscribe(onEvent, options);
}

export function subscribeCliInstallerEvents(
  onEvent: (event: CliInstallProgressEvent) => void,
  options?: SubscriptionOptions,
): Unsubscribe {
  return cliInstallerHub.subscribe(onEvent, options);
}

export function subscribeRuntimeLogExited(
  onEvent: (event: RuntimeLogSessionSnapshot) => void,
  options?: SubscriptionOptions,
): Unsubscribe {
  return runtimeLogExitedHub.subscribe(onEvent, options);
}

export function subscribeDetachedExternalFileChanges(
  onEvent: (event: DetachedExternalFileChangeEvent) => void,
  options?: SubscriptionOptions,
): Unsubscribe {
  return detachedExternalFileChangeHub.subscribe(onEvent, options);
}

/**
 * Subscribe to the Rust-side debounced file change batch channel.
 * Use this in preference to `subscribeDetachedExternalFileChanges` when
 * the backend `DebouncedExternalChangeEmitter` is enabled.
 */
export function subscribeDetachedExternalFileChangeBatch(
  onBatch: (events: readonly DetachedExternalFileChangeEvent[]) => void,
  options?: SubscriptionOptions,
): Unsubscribe {
  return detachedExternalFileChangeBatchHub.subscribe(onBatch, options);
}

export function subscribeUpdaterCheck(
  onEvent: () => void,
  options?: SubscriptionOptions,
): Unsubscribe {
  return updaterCheckHub.subscribe(() => {
    onEvent();
  }, options);
}

export function subscribeMenuNewAgent(
  onEvent: () => void,
  options?: SubscriptionOptions,
): Unsubscribe {
  return menuNewAgentHub.subscribe(() => {
    onEvent();
  }, options);
}

export function subscribeMenuNewWorktreeAgent(
  onEvent: () => void,
  options?: SubscriptionOptions,
): Unsubscribe {
  return menuNewWorktreeAgentHub.subscribe(() => {
    onEvent();
  }, options);
}

export function subscribeMenuNewCloneAgent(
  onEvent: () => void,
  options?: SubscriptionOptions,
): Unsubscribe {
  return menuNewCloneAgentHub.subscribe(() => {
    onEvent();
  }, options);
}

export function subscribeMenuNewWindow(
  onEvent: () => void,
  options?: SubscriptionOptions,
): Unsubscribe {
  return menuNewWindowHub.subscribe(() => {
    onEvent();
  }, options);
}

export function subscribeMenuAddWorkspace(
  onEvent: () => void,
  options?: SubscriptionOptions,
): Unsubscribe {
  return menuAddWorkspaceHub.subscribe(() => {
    onEvent();
  }, options);
}

export function subscribeMenuOpenSettings(
  onEvent: () => void,
  options?: SubscriptionOptions,
): Unsubscribe {
  return menuOpenSettingsHub.subscribe(() => {
    onEvent();
  }, options);
}

export function subscribeMenuToggleProjectsSidebar(
  onEvent: () => void,
  options?: SubscriptionOptions,
): Unsubscribe {
  return menuToggleProjectsSidebarHub.subscribe(() => {
    onEvent();
  }, options);
}

export function subscribeMenuToggleGitSidebar(
  onEvent: () => void,
  options?: SubscriptionOptions,
): Unsubscribe {
  return menuToggleGitSidebarHub.subscribe(() => {
    onEvent();
  }, options);
}

export function subscribeMenuToggleGlobalSearch(
  onEvent: () => void,
  options?: SubscriptionOptions,
): Unsubscribe {
  return menuToggleGlobalSearchHub.subscribe(() => {
    onEvent();
  }, options);
}

export function subscribeMenuToggleDebugPanel(
  onEvent: () => void,
  options?: SubscriptionOptions,
): Unsubscribe {
  return menuToggleDebugPanelHub.subscribe(() => {
    onEvent();
  }, options);
}

export function subscribeMenuToggleTerminal(
  onEvent: () => void,
  options?: SubscriptionOptions,
): Unsubscribe {
  return menuToggleTerminalHub.subscribe(() => {
    onEvent();
  }, options);
}

export function subscribeMenuNextAgent(
  onEvent: () => void,
  options?: SubscriptionOptions,
): Unsubscribe {
  return menuNextAgentHub.subscribe(() => {
    onEvent();
  }, options);
}

export function subscribeMenuPrevAgent(
  onEvent: () => void,
  options?: SubscriptionOptions,
): Unsubscribe {
  return menuPrevAgentHub.subscribe(() => {
    onEvent();
  }, options);
}

export function subscribeMenuNextWorkspace(
  onEvent: () => void,
  options?: SubscriptionOptions,
): Unsubscribe {
  return menuNextWorkspaceHub.subscribe(() => {
    onEvent();
  }, options);
}

export function subscribeMenuPrevWorkspace(
  onEvent: () => void,
  options?: SubscriptionOptions,
): Unsubscribe {
  return menuPrevWorkspaceHub.subscribe(() => {
    onEvent();
  }, options);
}

export function subscribeMenuCycleModel(
  onEvent: () => void,
  options?: SubscriptionOptions,
): Unsubscribe {
  return menuCycleModelHub.subscribe(() => {
    onEvent();
  }, options);
}

export function subscribeMenuCycleAccessMode(
  onEvent: () => void,
  options?: SubscriptionOptions,
): Unsubscribe {
  return menuCycleAccessHub.subscribe(() => {
    onEvent();
  }, options);
}

export function subscribeMenuCycleReasoning(
  onEvent: () => void,
  options?: SubscriptionOptions,
): Unsubscribe {
  return menuCycleReasoningHub.subscribe(() => {
    onEvent();
  }, options);
}

export function subscribeMenuCycleCollaborationMode(
  onEvent: () => void,
  options?: SubscriptionOptions,
): Unsubscribe {
  return menuCycleCollaborationHub.subscribe(() => {
    onEvent();
  }, options);
}

export function subscribeMenuComposerCycleModel(
  onEvent: () => void,
  options?: SubscriptionOptions,
): Unsubscribe {
  return menuComposerCycleModelHub.subscribe(() => {
    onEvent();
  }, options);
}

export function subscribeMenuComposerCycleAccess(
  onEvent: () => void,
  options?: SubscriptionOptions,
): Unsubscribe {
  return menuComposerCycleAccessHub.subscribe(() => {
    onEvent();
  }, options);
}

export function subscribeMenuComposerCycleReasoning(
  onEvent: () => void,
  options?: SubscriptionOptions,
): Unsubscribe {
  return menuComposerCycleReasoningHub.subscribe(() => {
    onEvent();
  }, options);
}

export function subscribeMenuComposerCycleCollaboration(
  onEvent: () => void,
  options?: SubscriptionOptions,
): Unsubscribe {
  return menuComposerCycleCollaborationHub.subscribe(() => {
    onEvent();
  }, options);
}

export function subscribeOpenPaths(
  onEvent: (paths: string[]) => void,
  options?: SubscriptionOptions,
): Unsubscribe {
  return openPathsHub.subscribe(onEvent, options);
}
