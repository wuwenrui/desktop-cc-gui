import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  BROWSER_AGENT_DOCK_SESSION_EVENT,
  type BrowserAgentDockSession,
  normalizeBrowserAgentDockSession,
  readBrowserAgentDockSessionSnapshot,
  writeBrowserAgentDockSessionSnapshot,
} from "../browserAgentDockWindow";

export function useBrowserAgentDockSession() {
  const [session, setSession] = useState<BrowserAgentDockSession | null>(() =>
    readBrowserAgentDockSessionSnapshot(),
  );

  useEffect(() => {
    let unlisten: (() => void) | null = null;

    try {
      const currentWindow = getCurrentWindow();
      currentWindow
        .listen<BrowserAgentDockSession>(BROWSER_AGENT_DOCK_SESSION_EVENT, (event) => {
          const nextSession = normalizeBrowserAgentDockSession(event.payload);
          if (!nextSession) {
            return;
          }
          writeBrowserAgentDockSessionSnapshot(nextSession);
          setSession(nextSession);
        })
        .then((handler) => {
          unlisten = handler;
        })
        .catch(() => {});
    } catch {
      // Non-Tauri test environments fall back to the persisted snapshot only.
    }

    return () => {
      unlisten?.();
    };
  }, []);

  return session;
}
