import { useCallback, useEffect, useMemo, useState } from "react";
import { captureBrowserAgentSnapshot } from "@/services/tauri";
import type { BrowserContextAttachment } from "../types";
import {
  buildBrowserContextAttachment,
  isBrowserContextAttachmentStale,
} from "../utils";
import {
  getActiveBrowserContext,
  subscribeActiveBrowserContextBridge,
  subscribeActiveBrowserContext,
  type ActiveBrowserContextState,
} from "../state/activeBrowserContext";
import { subscribeBrowserContextAttachmentRequests } from "../state/browserContextAttachmentCommands";

const STALE_POLL_MS = 30_000;

export type BrowserContextAttachmentState = {
  attachment: BrowserContextAttachment | null;
  activeContext: ActiveBrowserContextState | null;
  busy: boolean;
  error: string | null;
  attach: () => Promise<void>;
  refresh: () => Promise<void>;
  remove: () => void;
};

function normalizeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function contextCanCapture(
  activeContext: ActiveBrowserContextState | null,
  workspaceId: string | null | undefined,
): activeContext is ActiveBrowserContextState {
  const normalizedWorkspaceId = workspaceId?.trim();
  return Boolean(
    activeContext &&
      normalizedWorkspaceId &&
      activeContext.workspaceId === normalizedWorkspaceId &&
      activeContext.rendererBound &&
      activeContext.session.status === "ready",
  );
}

function reconcileAttachmentFreshness(
  attachment: BrowserContextAttachment | null,
  activeContext: ActiveBrowserContextState | null,
): BrowserContextAttachment | null {
  if (!attachment) {
    return null;
  }
  const timedOut = isBrowserContextAttachmentStale(attachment);
  const staleReasons = new Set(attachment.observation.staleReasons);
  if (timedOut) {
    staleReasons.add("ttl_expired");
  }
  if (!activeContext) {
    staleReasons.add("browser_dock_closed");
  } else {
    if (activeContext.browserSessionId !== attachment.browserSessionId) {
      staleReasons.add("active_tab_changed");
    }
    if (activeContext.workspaceId !== attachment.workspaceId) {
      staleReasons.add("workspace_mismatch");
    }
    if (activeContext.session.normalizedUrl !== attachment.url) {
      staleReasons.add("url_changed");
    }
    if ((activeContext.session.title ?? null) !== (attachment.title ?? null)) {
      staleReasons.add("title_changed");
    }
    if (!activeContext.rendererBound) {
      staleReasons.add("renderer_mismatch");
    }
    if (activeContext.session.status === "closed") {
      staleReasons.add("session_closed");
    }
  }
  const activeMismatch = staleReasons.size > attachment.observation.staleReasons.length;
  if (!timedOut && !activeMismatch) {
    return attachment;
  }
  if (
    attachment.stale &&
    attachment.freshness === "stale" &&
    staleReasons.size === attachment.observation.staleReasons.length
  ) {
    return attachment;
  }
  return {
    ...attachment,
    stale: true,
    freshness: "stale",
    observation: {
      ...attachment.observation,
      state: timedOut ? "expired" : "stale",
      staleReasons: Array.from(staleReasons),
    },
  };
}

export function useBrowserContextAttachment(
  workspaceId: string | null | undefined,
): BrowserContextAttachmentState {
  const [activeContext, setActiveContext] = useState<ActiveBrowserContextState | null>(() =>
    getActiveBrowserContext(),
  );
  const [attachment, setAttachment] = useState<BrowserContextAttachment | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(
    () =>
      subscribeActiveBrowserContext((nextContext) => {
        setActiveContext(nextContext);
        setAttachment((current) => reconcileAttachmentFreshness(current, nextContext));
      }),
    [],
  );

  useEffect(() => subscribeActiveBrowserContextBridge(), []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setAttachment((current) => reconcileAttachmentFreshness(current, getActiveBrowserContext()));
    }, STALE_POLL_MS);
    return () => window.clearInterval(timer);
  }, []);

  const capture = useCallback(async () => {
    const context = getActiveBrowserContext();
    if (!contextCanCapture(context, workspaceId)) {
      throw new Error("browser_context_no_active_session");
    }
    const snapshot = await captureBrowserAgentSnapshot(context.browserSessionId);
    return buildBrowserContextAttachment(snapshot);
  }, [workspaceId]);

  const attach = useCallback(async () => {
    if (busy) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      setAttachment(await capture());
    } catch (captureError) {
      setError(normalizeError(captureError));
    } finally {
      setBusy(false);
    }
  }, [busy, capture]);

  const attachBrowserSession = useCallback(
    async (browserSessionId: string) => {
      if (busy) {
        return;
      }
      setBusy(true);
      setError(null);
      try {
        const snapshot = await captureBrowserAgentSnapshot(browserSessionId);
        setAttachment(buildBrowserContextAttachment(snapshot));
      } catch (captureError) {
        setError(normalizeError(captureError));
      } finally {
        setBusy(false);
      }
    },
    [busy],
  );

  useEffect(
    () =>
      subscribeBrowserContextAttachmentRequests((request) => {
        const requestedWorkspaceId = request.workspaceId?.trim();
        const currentWorkspaceId = workspaceId?.trim();
        if (requestedWorkspaceId && requestedWorkspaceId !== currentWorkspaceId) {
          return;
        }
        const requestedBrowserSessionId = request.browserSessionId?.trim();
        if (requestedBrowserSessionId) {
          void attachBrowserSession(requestedBrowserSessionId);
          return;
        }
        void attach();
      }),
    [attach, attachBrowserSession, workspaceId],
  );

  const refresh = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      setAttachment(await capture());
    } catch (captureError) {
      setError(normalizeError(captureError));
    } finally {
      setBusy(false);
    }
  }, [capture]);

  const remove = useCallback(() => {
    setAttachment(null);
    setError(null);
  }, []);

  return useMemo(
    () => ({
      attachment,
      activeContext,
      busy,
      error,
      attach,
      refresh,
      remove,
    }),
    [activeContext, attach, attachment, busy, error, refresh, remove],
  );
}
