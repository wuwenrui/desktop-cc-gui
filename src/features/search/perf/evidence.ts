// Evidence record emitted by `computeUnifiedSearchResults` when an
// `evidenceSink` callback is supplied. Designed for perf fixture tests and
// future diagnostic tooling: the payload is the minimum information
// needed to spot a slow provider, a candidate-count regression, or a
// hydration state change, without exposing any message/file content
// (see Quality Guidelines: search performance metrics MUST be content
// safe).

import type { SearchResultKind } from "../types";

export type SearchProviderTiming = {
  provider: string;
  elapsedMs: number;
  candidateCount: number;
  resultCount: number;
};

export type SearchHydrationState =
  | "active-only"
  | "partial-global"
  | "global";

export type SearchEvidence = {
  query: string;
  elapsedMs: number;
  resultCount: number;
  providerTimings: SearchProviderTiming[];
  hydrationState: SearchHydrationState;
  staleDropCount: number;
  // Aggregate candidate count summed across all providers. Useful for
  // spotting "we are scanning the world again" regressions without having
  // to walk providerTimings in the assertion.
  candidateTotal: number;
  // Wall-clock for the captured evidence; not a perf signal, just an
  // ordering key for buffer readers.
  capturedAt: number;
};

// Append-only buffer used by fixture tests to keep evidence in scope
// across multiple invocations. The buffer is intentionally not
// export-shaped as a Set or Map; tests that want to assert on the most
// recent evidence should call `takeLastEvidence` and ignore the rest.
export class SearchEvidenceBuffer {
  private readonly records: SearchEvidence[] = [];

  push(evidence: SearchEvidence): void {
    this.records.push(evidence);
  }

  get size(): number {
    return this.records.length;
  }

  all(): readonly SearchEvidence[] {
    return this.records;
  }

  last(): SearchEvidence | undefined {
    return this.records[this.records.length - 1];
  }

  clear(): void {
    this.records.length = 0;
  }
}

export function createSearchEvidenceBuffer(): SearchEvidenceBuffer {
  return new SearchEvidenceBuffer();
}

// Convenience helper: pipe a single evidence into a buffer.
export function recordSearchEvidence(
  buffer: SearchEvidenceBuffer,
  evidence: SearchEvidence,
): void {
  buffer.push(evidence);
}

export function takeLastEvidence(
  buffer: SearchEvidenceBuffer,
): SearchEvidence | undefined {
  return buffer.last();
}

// Reduce providerTimings to a single candidate total. Exported so callers
// that build the evidence outside of `computeUnifiedSearchResults` can
// stay consistent with the canonical computation.
export function sumProviderCandidates(
  timings: readonly SearchProviderTiming[],
): number {
  let total = 0;
  for (const timing of timings) {
    total += timing.candidateCount;
  }
  return total;
}

// Map a provider id (as it appears in the timings array) to a stable
// `SearchResultKind` for downstream filtering. The mapping is the same
// one used by the search compute path.
export function providerIdToKind(provider: string): SearchResultKind | null {
  switch (provider) {
    case "files":
      return "file";
    case "threads":
      return "thread";
    case "messages":
      return "message";
    case "kanban":
      return "kanban";
    case "history":
      return "history";
    case "skills":
      return "skill";
    case "commands":
      return "command";
    default:
      return null;
  }
}
