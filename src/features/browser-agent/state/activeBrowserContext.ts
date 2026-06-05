import { emitTo } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { BrowserSession } from "../types";

const ACTIVE_BROWSER_CONTEXT_EVENT = "browser-agent://active-context";

export type ActiveBrowserContextState = {
  workspaceId: string;
  browserSessionId: string;
  session: BrowserSession;
  rendererBound: boolean;
  updatedAt: number;
};

type ActiveBrowserContextListener = (
  state: ActiveBrowserContextState | null,
) => void;

let activeBrowserContextState: ActiveBrowserContextState | null = null;
const activeBrowserContextListeners = new Set<ActiveBrowserContextListener>();

function emitActiveBrowserContextChange(): void {
  for (const listener of activeBrowserContextListeners) {
    listener(activeBrowserContextState);
  }
}

function broadcastActiveBrowserContextChange(): void {
  try {
    const label = getCurrentWindow().label ?? null;
    if (label === "main") {
      return;
    }
    void emitTo("main", ACTIVE_BROWSER_CONTEXT_EVENT, activeBrowserContextState).catch(() => {});
  } catch {
    // Non-Tauri test/runtime cases only need local listeners.
  }
}

function applyActiveBrowserContextState(state: ActiveBrowserContextState | null): void {
  activeBrowserContextState = state;
  emitActiveBrowserContextChange();
}

export function getActiveBrowserContext(): ActiveBrowserContextState | null {
  return activeBrowserContextState;
}

export function setActiveBrowserContextSession(
  session: BrowserSession,
  options: { rendererBound: boolean },
): ActiveBrowserContextState {
  const nextState: ActiveBrowserContextState = {
    workspaceId: session.workspaceId,
    browserSessionId: session.browserSessionId,
    session,
    rendererBound: options.rendererBound,
    updatedAt: Date.now(),
  };
  activeBrowserContextState = nextState;
  emitActiveBrowserContextChange();
  broadcastActiveBrowserContextChange();
  return nextState;
}

export function clearActiveBrowserContextSession(
  browserSessionId?: string | null,
): void {
  if (
    browserSessionId &&
    activeBrowserContextState?.browserSessionId !== browserSessionId
  ) {
    return;
  }
  if (!activeBrowserContextState) {
    return;
  }
  activeBrowserContextState = null;
  emitActiveBrowserContextChange();
  broadcastActiveBrowserContextChange();
}

export function subscribeActiveBrowserContext(
  listener: ActiveBrowserContextListener,
): () => void {
  activeBrowserContextListeners.add(listener);
  listener(activeBrowserContextState);
  return () => {
    activeBrowserContextListeners.delete(listener);
  };
}

export function subscribeActiveBrowserContextBridge(): () => void {
  let disposed = false;
  let unlisten: (() => void) | null = null;

  try {
    getCurrentWindow()
      .listen<ActiveBrowserContextState | null>(ACTIVE_BROWSER_CONTEXT_EVENT, (event) => {
        if (disposed) {
          return;
        }
        applyActiveBrowserContextState(event.payload);
      })
      .then((handler) => {
        if (disposed) {
          handler();
          return;
        }
        unlisten = handler;
      })
      .catch(() => {});
  } catch {
    // Non-Tauri test/runtime cases only need local state.
  }

  return () => {
    disposed = true;
    unlisten?.();
  };
}
