import { getCurrentWindow } from "@tauri-apps/api/window";
import { emitTo } from "@tauri-apps/api/event";

const BROWSER_CONTEXT_ATTACHMENT_REQUEST_EVENT =
  "browser-agent://attach-current-context";

export type BrowserContextAttachmentRequest = {
  workspaceId?: string | null;
  browserSessionId?: string | null;
};

type BrowserContextAttachmentRequestListener = (
  request: BrowserContextAttachmentRequest,
) => void;

const browserContextAttachmentRequestListeners =
  new Set<BrowserContextAttachmentRequestListener>();

export function requestBrowserContextAttachment(
  request: BrowserContextAttachmentRequest = {},
): void {
  for (const listener of browserContextAttachmentRequestListeners) {
    listener(request);
  }
  try {
    const label = getCurrentWindow().label ?? null;
    if (label === "main") {
      return;
    }
    void emitTo("main", BROWSER_CONTEXT_ATTACHMENT_REQUEST_EVENT, request).catch(() => {});
  } catch {
    // Non-Tauri test/runtime cases only need local listeners.
  }
}

export function subscribeBrowserContextAttachmentRequests(
  listener: BrowserContextAttachmentRequestListener,
): () => void {
  let disposed = false;
  let unlisten: (() => void) | null = null;
  browserContextAttachmentRequestListeners.add(listener);
  try {
    getCurrentWindow()
      .listen<BrowserContextAttachmentRequest>(
        BROWSER_CONTEXT_ATTACHMENT_REQUEST_EVENT,
        (event) => {
          if (!disposed) {
            listener(event.payload);
          }
        },
      )
      .then((handler) => {
        if (disposed) {
          handler();
          return;
        }
        unlisten = handler;
      })
      .catch(() => {});
  } catch {
    // Non-Tauri test/runtime cases only need local listeners.
  }
  return () => {
    disposed = true;
    unlisten?.();
    browserContextAttachmentRequestListeners.delete(listener);
  };
}
