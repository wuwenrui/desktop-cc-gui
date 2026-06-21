/**
 * Markdown worker adapter lifecycle diagnostics.
 *
 * The worker adapter owns only the request lifecycle that does not depend on
 * the caller knowing about the latest visible source. The latest-source
 * protection (i.e. "did a newer content hash or request ordinal supersede
 * this resolution?") belongs to the hook / caller, not the adapter.
 *
 * Diagnostics are content-safe: ids, counts, durations, and bounded reason
 * strings. They MUST NOT include prompt text, assistant body, tool output,
 * or file content.
 */

export type FastMarkdownWorkerDiagnostics = {
  hasWorker: boolean;
  pendingRequestCount: number;
  disposedCount: number;
  fallbackCount: number;
  unknownResponseCount: number;
  staleResultDropCount: number;
  postMessageFailureCount: number;
  lastFallbackReason: string | null;
};

const DEFAULT_DIAGNOSTICS: FastMarkdownWorkerDiagnostics = {
  hasWorker: false,
  pendingRequestCount: 0,
  disposedCount: 0,
  fallbackCount: 0,
  unknownResponseCount: 0,
  staleResultDropCount: 0,
  postMessageFailureCount: 0,
  lastFallbackReason: null,
};

class WorkerDiagnosticsStore {
  private state: FastMarkdownWorkerDiagnostics = { ...DEFAULT_DIAGNOSTICS };

  snapshot(): FastMarkdownWorkerDiagnostics {
    return { ...this.state };
  }

  reset(): void {
    this.state = { ...DEFAULT_DIAGNOSTICS };
  }

  setHasWorker(value: boolean): void {
    this.state.hasWorker = value;
  }

  setPendingCount(value: number): void {
    this.state.pendingRequestCount = Math.max(0, value);
  }

  recordDispose(): void {
    this.state.disposedCount += 1;
    this.state.pendingRequestCount = 0;
  }

  recordFallback(reason: string): void {
    this.state.fallbackCount += 1;
    this.state.lastFallbackReason = reason;
  }

  recordUnknownResponse(): void {
    this.state.unknownResponseCount += 1;
  }

  recordStaleDrop(): void {
    this.state.staleResultDropCount += 1;
  }

  recordPostMessageFailure(): void {
    this.state.postMessageFailureCount += 1;
  }
}

export const workerDiagnostics = new WorkerDiagnosticsStore();
