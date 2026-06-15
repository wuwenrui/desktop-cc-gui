import { describe, expect, it } from "vitest";
import {
  createSearchEvidenceBuffer,
  providerIdToKind,
  recordSearchEvidence,
  sumProviderCandidates,
  takeLastEvidence,
  type SearchEvidence,
  type SearchProviderTiming,
} from "./evidence";

function makeTiming(
  overrides: Partial<SearchProviderTiming> = {},
): SearchProviderTiming {
  return {
    provider: "files",
    elapsedMs: 5,
    candidateCount: 100,
    resultCount: 3,
    ...overrides,
  };
}

function makeEvidence(overrides: Partial<SearchEvidence> = {}): SearchEvidence {
  return {
    query: "hello",
    elapsedMs: 12,
    resultCount: 4,
    providerTimings: [makeTiming()],
    hydrationState: "active-only",
    staleDropCount: 0,
    candidateTotal: 100,
    capturedAt: 1_000,
    ...overrides,
  };
}

describe("SearchEvidenceBuffer", () => {
  it("starts empty", () => {
    const buffer = createSearchEvidenceBuffer();
    expect(buffer.size).toBe(0);
    expect(buffer.last()).toBeUndefined();
    expect(buffer.all()).toEqual([]);
  });

  it("appends evidence in insertion order", () => {
    const buffer = createSearchEvidenceBuffer();
    recordSearchEvidence(buffer, makeEvidence({ query: "a" }));
    recordSearchEvidence(buffer, makeEvidence({ query: "b" }));
    expect(buffer.size).toBe(2);
    expect(buffer.all().map((e) => e.query)).toEqual(["a", "b"]);
    expect(takeLastEvidence(buffer)?.query).toBe("b");
  });

  it("clear empties the buffer", () => {
    const buffer = createSearchEvidenceBuffer();
    recordSearchEvidence(buffer, makeEvidence());
    buffer.clear();
    expect(buffer.size).toBe(0);
  });
});

describe("sumProviderCandidates", () => {
  it("sums candidateCount across timings", () => {
    expect(
      sumProviderCandidates([
        makeTiming({ candidateCount: 10 }),
        makeTiming({ candidateCount: 20 }),
        makeTiming({ candidateCount: 30 }),
      ]),
    ).toBe(60);
  });

  it("returns 0 for an empty list", () => {
    expect(sumProviderCandidates([])).toBe(0);
  });
});

describe("providerIdToKind", () => {
  it("maps known provider ids to their SearchResultKind", () => {
    expect(providerIdToKind("files")).toBe("file");
    expect(providerIdToKind("threads")).toBe("thread");
    expect(providerIdToKind("messages")).toBe("message");
    expect(providerIdToKind("kanban")).toBe("kanban");
    expect(providerIdToKind("history")).toBe("history");
    expect(providerIdToKind("skills")).toBe("skill");
    expect(providerIdToKind("commands")).toBe("command");
  });

  it("returns null for an unknown provider id", () => {
    expect(providerIdToKind("unknown")).toBeNull();
  });
});
