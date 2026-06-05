import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";

export type DragDropPayload = {
  type: "enter" | "over" | "leave" | "drop";
  position: { x: number; y: number };
  paths?: string[];
};

export type DragDropEvent = {
  payload: DragDropPayload;
};

type Listener = (event: DragDropEvent) => void;

type SubscriptionOptions = {
  onError?: (error: unknown) => void;
};

let unlisten: (() => void) | null = null;
let listenPromise: Promise<() => void> | null = null;
const listeners = new Set<Listener>();
const FORWARDED_WINDOW_DRAG_DROP_EVENT = "main-window://drag-drop";
const DUPLICATE_DROP_WINDOW_MS = 250;
let lastDispatchedDrop:
  | { signature: string; timestamp: number }
  | null = null;

function dragDropSignature(event: DragDropEvent): string {
  const { payload } = event;
  const roundedX = Math.round(payload.position.x);
  const roundedY = Math.round(payload.position.y);
  const paths = (payload.paths ?? []).join("\n");
  return `${payload.type}:${roundedX}:${roundedY}:${paths}`;
}

function isDuplicateDropEvent(event: DragDropEvent): boolean {
  if (event.payload.type !== "drop") {
    return false;
  }
  const signature = dragDropSignature(event);
  const now = Date.now();
  if (
    lastDispatchedDrop &&
    lastDispatchedDrop.signature === signature &&
    now - lastDispatchedDrop.timestamp < DUPLICATE_DROP_WINDOW_MS
  ) {
    return true;
  }
  lastDispatchedDrop = { signature, timestamp: now };
  return false;
}

function dispatchDragDropEvent(event: DragDropEvent) {
  if (isDuplicateDropEvent(event)) {
    return;
  }
  for (const listener of listeners) {
    try {
      listener(event);
    } catch (error) {
      console.error("[drag-drop] listener failed", error);
    }
  }
}

function start(options?: SubscriptionOptions) {
  if (unlisten || listenPromise) {
    return;
  }
  let currentWindow: ReturnType<typeof getCurrentWindow>;
  try {
    currentWindow = getCurrentWindow();
  } catch (error) {
    options?.onError?.(error);
    return;
  }
  listenPromise = Promise.all([
    currentWindow.onDragDropEvent((event) => {
      dispatchDragDropEvent(event as DragDropEvent);
    }) as Promise<() => void>,
    listen<DragDropPayload>(FORWARDED_WINDOW_DRAG_DROP_EVENT, (event) => {
      dispatchDragDropEvent({ payload: event.payload });
    }),
  ]).then((handlers) => () => {
    for (const handler of handlers) {
      handler();
    }
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
}

function stop() {
  if (!unlisten) {
    return;
  }
  try {
    unlisten();
  } catch {
    // Ignore double-unlisten when tearing down.
  }
  unlisten = null;
}

export function subscribeWindowDragDrop(
  onEvent: Listener,
  options?: SubscriptionOptions,
) {
  listeners.add(onEvent);
  start(options);
  return () => {
    listeners.delete(onEvent);
    if (listeners.size === 0) {
      stop();
    }
  };
}
