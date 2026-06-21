// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  compileFastMarkdownWithWorkerFallback,
  disposeFastMarkdownWorker,
  getFastMarkdownWorkerDiagnostics,
  resetFastMarkdownWorkerDiagnostics,
} from "../workerAdapter";
import type { CompileFastMarkdownArgs } from "../types";

const baseArgs: CompileFastMarkdownArgs = {
  documentKey: "diagnostics-doc",
  rawMarkdown: "# Heading",
  rendererProfile: "fast-html",
  featureFlags: { fastHtmlRendererEnabled: true },
};

describe("fastMarkdownRenderer worker adapter diagnostics", () => {
  beforeEach(() => {
    resetFastMarkdownWorkerDiagnostics();
  });

  afterEach(() => {
    disposeFastMarkdownWorker();
  });

  it("records a fallback when the worker is not available", async () => {
    // jsdom does not provide a Worker; compileFastMarkdownInWorker will
    // return null and the fallback path will run.
    await compileFastMarkdownWithWorkerFallback(baseArgs);
    const snapshot = getFastMarkdownWorkerDiagnostics();
    expect(snapshot.hasWorker).toBe(false);
    expect(snapshot.fallbackCount).toBeGreaterThanOrEqual(1);
    expect(snapshot.lastFallbackReason).toBe("worker-not-available");
  });

  it("records a dispose and clears pending count", () => {
    disposeFastMarkdownWorker();
    const snapshot = getFastMarkdownWorkerDiagnostics();
    expect(snapshot.disposedCount).toBeGreaterThanOrEqual(1);
    expect(snapshot.pendingRequestCount).toBe(0);
  });
});
