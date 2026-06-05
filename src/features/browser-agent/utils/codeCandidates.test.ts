import { describe, expect, it } from "vitest";
import { buildBrowserCodeCandidates } from "./codeCandidates";
import type { BrowserContextSnapshot } from "../types";

function makeSnapshot(): BrowserContextSnapshot {
  return {
    snapshotId: "snapshot-1",
    browserSessionId: "session-1",
    workspaceId: "workspace-1",
    capturedAt: 1000,
    freshness: "fresh",
    source: {
      url: "http://localhost:5173/settings/profile",
      normalizedUrl: "http://localhost:5173/settings/profile",
      title: "Profile settings",
      origin: "http://localhost:5173",
      tabLabel: "Profile settings",
      captureReason: "manual_attach",
      workspaceLocalAllowed: true,
    },
    viewport: {
      width: null,
      height: null,
      scrollX: null,
      scrollY: null,
      scrollHeight: null,
      scrollWidth: null,
      devicePixelRatio: null,
    },
    page: {
      visibleText: "Save profile changes",
      pageType: "dashboard",
      primaryContent: null,
      readableBlocks: [],
      noiseDiagnostics: [],
      visualEvidence: [],
      textTruncated: false,
      headings: [
        {
          targetId: "heading-profile",
          role: "heading",
          level: 1,
          text: "Profile settings",
          truncated: false,
        },
      ],
      landmarks: [],
      elementLandmarks: [
        {
          landmarkId: "button-save",
          role: "button",
          label: "Save profile",
          textPreview: null,
          selectorHint: "button[data-testid=save-profile]",
          href: null,
          placeholder: null,
          enabled: true,
          visible: true,
          sensitive: false,
          bounds: null,
        },
      ],
      contentRegions: [],
      links: [],
      buttons: [],
      forms: [],
      selectedText: null,
      languageHint: null,
    },
    codeCandidates: [],
    diagnostics: {
      console: [],
      network: null,
      captureWarnings: [],
    },
    evidence: {
      screenshotRef: null,
      htmlExcerptRef: "browser-evidence-snapshot-1",
    },
    privacy: {
      redactionApplied: false,
      redactedKinds: [],
      omittedKinds: ["raw_dom", "cookies", "headers", "scripts", "styles", "hidden_nodes"],
    },
    budget: {
      charLimit: 12_000,
      visibleTextLimit: 8_000,
      elementLimit: 120,
      formFieldLimit: 80,
      diagnosticLimit: 50,
      tokenEstimate: null,
      truncated: false,
      omittedElementCount: 0,
    },
    availability: "available",
  };
}

describe("buildBrowserCodeCandidates", () => {
  it("returns explainable candidates without definitive ownership claims", () => {
    const candidates = buildBrowserCodeCandidates({
      snapshot: makeSnapshot(),
      workspaceFiles: ["src/pages/settings/profile.tsx"],
    });

    expect(candidates[0]).toMatchObject({
      filePath: "src/pages/settings/profile.tsx",
      reason: "route_match",
      confidence: "medium",
      sourceEvidence: ["/settings/profile"],
      openAction: {
        kind: "open_file",
        filePath: "src/pages/settings/profile.tsx",
      },
    });
    expect(candidates.some((candidate) => candidate.reason === "file_name_match")).toBe(true);
    expect(candidates.some((candidate) => candidate.reason === "heading_match")).toBe(true);
    expect(candidates.some((candidate) => candidate.reason === "button_label_match")).toBe(true);
    expect(candidates.every((candidate) => (candidate.explanation ?? "").length > 0)).toBe(true);
  });

  it("renders low confidence candidates as clues instead of ownership claims", () => {
    const candidates = buildBrowserCodeCandidates({
      snapshot: makeSnapshot(),
    });

    const lowConfidenceCandidate = candidates.find((candidate) => candidate.confidence === "low");

    expect(lowConfidenceCandidate?.explanation).toContain("clue");
    expect(lowConfidenceCandidate?.explanation).not.toContain("owner");
  });

  it("does not produce candidates for external pages", () => {
    const snapshot = makeSnapshot();
    snapshot.source.normalizedUrl = "https://example.com/settings/profile";

    expect(buildBrowserCodeCandidates({ snapshot })).toEqual([]);
  });
});
