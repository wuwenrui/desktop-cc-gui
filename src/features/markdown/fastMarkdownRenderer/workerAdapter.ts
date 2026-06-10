import { compileFastMarkdown } from "./compile";
import type {
  CompileFastMarkdownArgs,
  FastMarkdownRenderResult,
} from "./types";

type FastMarkdownWorkerResponse =
  | {
      type: "fast-markdown-result";
      requestId: string;
      result: FastMarkdownRenderResult;
    }
  | {
      type: "fast-markdown-error";
      requestId: string;
      error: {
        name: string;
        message: string;
      };
    };

type PendingWorkerRequest = {
  resolve: (result: FastMarkdownRenderResult) => void;
  reject: (error: Error) => void;
};

let sharedWorker: Worker | null = null;
let listenersAttached = false;
let nextRequestOrdinal = 1;

const pendingRequests = new Map<string, PendingWorkerRequest>();

export async function compileFastMarkdownWithWorkerFallback(
  args: CompileFastMarkdownArgs,
): Promise<FastMarkdownRenderResult> {
  try {
    const workerResult = await compileFastMarkdownInWorker(args);
    if (workerResult) {
      return workerResult;
    }
  } catch (error: unknown) {
    reportWorkerFallback(error);
  }
  return compileFastMarkdown(args);
}

export function compileFastMarkdownInWorker(
  args: CompileFastMarkdownArgs,
): Promise<FastMarkdownRenderResult> | null {
  const worker = getSharedWorker();
  if (!worker) {
    return null;
  }

  const requestId = createRequestId(args.documentKey);
  return new Promise<FastMarkdownRenderResult>((resolve, reject) => {
    pendingRequests.set(requestId, { resolve, reject });
    try {
      worker.postMessage({
        type: "compile-fast-markdown",
        requestId,
        args,
      });
    } catch (error: unknown) {
      pendingRequests.delete(requestId);
      reject(error instanceof Error ? error : new Error(String(error)));
    }
  });
}

export function disposeFastMarkdownWorker() {
  if (sharedWorker) {
    sharedWorker.terminate();
  }
  sharedWorker = null;
  listenersAttached = false;
  rejectAllPendingRequests(new Error("Fast Markdown worker disposed"));
}

function getSharedWorker(): Worker | null {
  if (typeof Worker === "undefined") {
    return null;
  }
  if (!sharedWorker) {
    try {
      sharedWorker = new Worker(new URL("./fastMarkdown.worker.ts", import.meta.url), {
        type: "module",
      });
    } catch {
      sharedWorker = null;
      return null;
    }
  }
  attachWorkerListeners(sharedWorker);
  return sharedWorker;
}

function attachWorkerListeners(worker: Worker) {
  if (listenersAttached) {
    return;
  }
  worker.addEventListener("message", handleWorkerMessage);
  worker.addEventListener("error", handleWorkerError);
  listenersAttached = true;
}

function handleWorkerMessage(event: MessageEvent<unknown>) {
  const message = event.data;
  if (!isWorkerResponse(message)) {
    return;
  }

  const pending = pendingRequests.get(message.requestId);
  if (!pending) {
    return;
  }
  pendingRequests.delete(message.requestId);

  if (message.type === "fast-markdown-error") {
    pending.reject(createWorkerError(message.error));
    return;
  }
  pending.resolve(message.result);
}

function handleWorkerError(event: ErrorEvent) {
  const message = event.message || "Fast Markdown worker failed";
  disposeBrokenWorker(new Error(message));
}

function disposeBrokenWorker(error: Error) {
  if (sharedWorker) {
    sharedWorker.terminate();
  }
  sharedWorker = null;
  listenersAttached = false;
  rejectAllPendingRequests(error);
}

function rejectAllPendingRequests(error: Error) {
  for (const pending of pendingRequests.values()) {
    pending.reject(error);
  }
  pendingRequests.clear();
}

function createRequestId(documentKey: string) {
  const ordinal = nextRequestOrdinal;
  nextRequestOrdinal += 1;
  return `${documentKey}:${ordinal}`;
}

function isWorkerResponse(value: unknown): value is FastMarkdownWorkerResponse {
  if (!isRecord(value)) {
    return false;
  }
  if (
    value.type !== "fast-markdown-result" &&
    value.type !== "fast-markdown-error"
  ) {
    return false;
  }
  if (typeof value.requestId !== "string") {
    return false;
  }
  if (value.type === "fast-markdown-result") {
    return isRecord(value.result);
  }
  return isRecord(value.error) && typeof value.error.message === "string";
}

function createWorkerError(error: { name: string; message: string }) {
  const workerError = new Error(error.message || "Fast Markdown worker compile failed");
  workerError.name = error.name || "Error";
  return workerError;
}

function reportWorkerFallback(error: unknown) {
  const normalized = error instanceof Error ? error : new Error(String(error));
  console.warn(
    "[file-markdown-preview] Fast Markdown worker failed; falling back to main-thread compile.",
    normalized,
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
