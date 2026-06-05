import { emitTo } from "@tauri-apps/api/event";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import i18n from "../../i18n";
import { getClientStoreSync, writeClientStoreValue } from "../../services/clientStorage";
import { isMacPlatform } from "../../utils/platform";
import {
  createBrowserAgentSession,
  listBrowserAgentSessions,
  openBrowserAgentWindow,
} from "../../services/tauri/browserAgent";
import { setActiveBrowserContextSession } from "./state/activeBrowserContext";

export const BROWSER_AGENT_DOCK_WINDOW_LABEL = "browser-agent-dock";
const BROWSER_AGENT_RENDERER_WINDOW_LABEL = "browser-agent-window";
export const BROWSER_AGENT_DOCK_SESSION_EVENT = "browser-agent-dock:session";
export const BROWSER_AGENT_DOCK_SESSION_STORAGE_KEY = "browserAgentDockSession";

const BROWSER_AGENT_DOCK_CREATE_TIMEOUT_MS = 4_000;
let pendingBrowserAgentDockWindowOpen: Promise<"created" | "focused"> | null = null;

export type BrowserAgentDockSession = {
  workspaceId: string | null;
  workspaceName: string | null;
  updatedAt: number;
};

function normalizeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeBrowserAgentDockSession(value: unknown): BrowserAgentDockSession | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const candidate = value as Record<string, unknown>;
  const workspaceId = normalizeString(candidate.workspaceId);
  const workspaceName = normalizeString(candidate.workspaceName);
  const updatedAt =
    typeof candidate.updatedAt === "number" && Number.isFinite(candidate.updatedAt)
      ? candidate.updatedAt
      : Date.now();
  return {
    workspaceId: workspaceId || null,
    workspaceName: workspaceName || null,
    updatedAt,
  };
}

export function buildBrowserAgentDockSession(input: {
  workspaceId?: string | null;
  workspaceName?: string | null;
}): BrowserAgentDockSession {
  return {
    workspaceId: normalizeString(input.workspaceId) || null,
    workspaceName: normalizeString(input.workspaceName) || null,
    updatedAt: Date.now(),
  };
}

export function readBrowserAgentDockSessionSnapshot(): BrowserAgentDockSession | null {
  return normalizeBrowserAgentDockSession(
    getClientStoreSync("app", BROWSER_AGENT_DOCK_SESSION_STORAGE_KEY),
  );
}

export function writeBrowserAgentDockSessionSnapshot(session: BrowserAgentDockSession): void {
  writeClientStoreValue("app", BROWSER_AGENT_DOCK_SESSION_STORAGE_KEY, session, {
    immediate: true,
  });
}

export function isBrowserAgentDockWindowLabel(label: string | null | undefined): boolean {
  return label === BROWSER_AGENT_DOCK_WINDOW_LABEL;
}

export function buildBrowserAgentDockWindowTitle(session: BrowserAgentDockSession): string {
  return session.workspaceName ? `${session.workspaceName} · Browser Dock` : "Browser Dock";
}

function normalizeWindowErrorMessage(payload: unknown): string {
  if (typeof payload === "string" && payload.trim().length > 0) {
    return payload;
  }
  if (payload && typeof payload === "object") {
    const message = (payload as { message?: unknown }).message;
    if (typeof message === "string" && message.trim().length > 0) {
      return message;
    }
  }
  return JSON.stringify(payload ?? "unknown error");
}

async function openLatestBrowserAgentRenderer(
  session: BrowserAgentDockSession,
): Promise<"focused" | null> {
  const sessions = await listBrowserAgentSessions(session.workspaceId);
  let latestSession = sessions.find((candidate) => candidate.status !== "closed") ?? null;
  if (!latestSession && session.workspaceId) {
    latestSession = await createBrowserAgentSession({
      workspaceId: session.workspaceId,
      url: "https://example.com",
      ownerSurface: "browser-agent-window",
    });
  }
  if (!latestSession) {
    return null;
  }
  const openedSession = await openBrowserAgentWindow(latestSession.browserSessionId, i18n.language);
  setActiveBrowserContextSession(openedSession, { rendererBound: true });
  const rendererWindow = await WebviewWindow.getByLabel(BROWSER_AGENT_RENDERER_WINDOW_LABEL);
  await rendererWindow?.show().catch(() => {});
  await rendererWindow?.setFocus().catch(() => {});
  return "focused";
}

async function createOrFocusBrowserAgentDockWindow(
  session: BrowserAgentDockSession,
): Promise<"created" | "focused"> {
  writeBrowserAgentDockSessionSnapshot(session);
  const existingRenderer = await WebviewWindow.getByLabel(BROWSER_AGENT_RENDERER_WINDOW_LABEL);
  if (existingRenderer) {
    await openLatestBrowserAgentRenderer(session).catch(() => null);
    await existingRenderer.show().catch(() => {});
    await existingRenderer.setFocus().catch(() => {});
    return "focused";
  }

  const rendererOpened = await openLatestBrowserAgentRenderer(session).catch(() => null);
  if (rendererOpened) {
    return rendererOpened;
  }

  const existing = await WebviewWindow.getByLabel(BROWSER_AGENT_DOCK_WINDOW_LABEL);
  if (existing) {
    await existing.show().catch(() => {});
    await existing.setFocus().catch(() => {});
    await existing.setTitle(buildBrowserAgentDockWindowTitle(session)).catch(() => {});
    await emitTo(BROWSER_AGENT_DOCK_WINDOW_LABEL, BROWSER_AGENT_DOCK_SESSION_EVENT, session).catch(
      () => {},
    );
    return "focused";
  }

  const rootUrl = new URL("/", window.location.href).toString();
  const browserDockWindow = new WebviewWindow(BROWSER_AGENT_DOCK_WINDOW_LABEL, {
    url: rootUrl,
    title: buildBrowserAgentDockWindowTitle(session),
    width: 980,
    height: 260,
    minWidth: 520,
    minHeight: 220,
    center: true,
    resizable: true,
    focus: true,
    ...(isMacPlatform()
      ? {
          transparent: false,
        }
      : {}),
  });

  return await new Promise<"created">((resolve, reject) => {
    let settled = false;
    const settle = (callback: () => void) => {
      if (settled) {
        return;
      }
      settled = true;
      globalThis.clearTimeout(timeoutId);
      callback();
    };
    const timeoutId = globalThis.setTimeout(() => {
      settle(() => {
        reject(new Error("Timed out while opening Browser Agent Dock"));
      });
    }, BROWSER_AGENT_DOCK_CREATE_TIMEOUT_MS);

    browserDockWindow.once("tauri://error", (event) => {
      const message = normalizeWindowErrorMessage(event.payload);
      console.error("[browser-agent-dock] create window failed", message);
      settle(() => {
        reject(new Error(message));
      });
    });

    browserDockWindow.once("tauri://created", () => {
      void (async () => {
        await emitTo(BROWSER_AGENT_DOCK_WINDOW_LABEL, BROWSER_AGENT_DOCK_SESSION_EVENT, session).catch(
          () => {},
        );
        await browserDockWindow.setFocus().catch(() => {});
        settle(() => {
          resolve("created");
        });
      })();
    });
  });
}

export async function openOrFocusBrowserAgentDockWindow(input: {
  workspaceId?: string | null;
  workspaceName?: string | null;
}): Promise<"created" | "focused"> {
  const session = buildBrowserAgentDockSession(input);
  if (pendingBrowserAgentDockWindowOpen) {
    return pendingBrowserAgentDockWindowOpen;
  }
  pendingBrowserAgentDockWindowOpen = createOrFocusBrowserAgentDockWindow(session).finally(() => {
    pendingBrowserAgentDockWindowOpen = null;
  });
  return pendingBrowserAgentDockWindowOpen;
}
