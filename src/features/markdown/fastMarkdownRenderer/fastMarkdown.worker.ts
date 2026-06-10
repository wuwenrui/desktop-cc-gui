/// <reference lib="webworker" />

import { compileFastMarkdown } from "./compile";
import type {
  CompileFastMarkdownArgs,
  FastMarkdownRenderResult,
} from "./types";

type FastMarkdownWorkerCompileRequest = {
  type: "compile-fast-markdown";
  requestId: string;
  args: CompileFastMarkdownArgs;
};

type FastMarkdownWorkerCompileSuccess = {
  type: "fast-markdown-result";
  requestId: string;
  result: FastMarkdownRenderResult;
};

type FastMarkdownWorkerCompileError = {
  type: "fast-markdown-error";
  requestId: string;
  error: {
    name: string;
    message: string;
  };
};

const workerScope = self as unknown as DedicatedWorkerGlobalScope;

workerScope.addEventListener("message", (event: MessageEvent<unknown>) => {
  const message = event.data;
  if (!isCompileRequest(message)) {
    return;
  }

  void compileFastMarkdown(message.args)
    .then((result) => {
      workerScope.postMessage({
        type: "fast-markdown-result",
        requestId: message.requestId,
        result,
      } satisfies FastMarkdownWorkerCompileSuccess);
    })
    .catch((error: unknown) => {
      const normalized = normalizeWorkerError(error);
      workerScope.postMessage({
        type: "fast-markdown-error",
        requestId: message.requestId,
        error: normalized,
      } satisfies FastMarkdownWorkerCompileError);
    });
});

function isCompileRequest(value: unknown): value is FastMarkdownWorkerCompileRequest {
  if (!isRecord(value)) {
    return false;
  }
  return (
    value.type === "compile-fast-markdown" &&
    typeof value.requestId === "string" &&
    isRecord(value.args)
  );
}

function normalizeWorkerError(error: unknown): FastMarkdownWorkerCompileError["error"] {
  if (error instanceof Error) {
    return {
      name: error.name || "Error",
      message: error.message || "Fast Markdown worker compile failed",
    };
  }
  return {
    name: "Error",
    message: String(error),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
