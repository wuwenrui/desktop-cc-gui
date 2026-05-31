import { describe, expect, it } from "vitest";
import {
  buildBrowserContextAttachment,
  formatBrowserContextPrompt,
  parseBrowserContextPrompt,
  stripBrowserContextPrompt,
} from "./attachment";
import type { BrowserContextSnapshot } from "../types";

function makeSnapshot(overrides: Partial<BrowserContextSnapshot> = {}): BrowserContextSnapshot {
  return {
    snapshotId: "snapshot-1",
    browserSessionId: "session-1",
    workspaceId: "workspace-1",
    capturedAt: 1000,
    source: {
      url: "https://example.com/page",
      normalizedUrl: "https://example.com/page",
      title: "Example Page",
      origin: "https://example.com",
    },
    page: {
      visibleText: "Visible page facts for the model.",
      textTruncated: false,
      headings: [],
      landmarks: [],
      links: [],
      buttons: [],
      forms: [],
      selectedText: null,
    },
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
    },
    availability: "available",
    ...overrides,
  };
}

describe("browser attachment utilities", () => {
  it("builds, formats, parses, and strips bounded browser context", () => {
    const attachment = buildBrowserContextAttachment(makeSnapshot(), {
      now: 1100,
      staleAfterMs: 5000,
    });

    const prompt = formatBrowserContextPrompt(attachment);
    const parsed = parseBrowserContextPrompt(`${prompt}\n\nUser request`);

    expect(parsed).toMatchObject({
      title: "Example Page",
      url: "https://example.com/page",
      stale: false,
    });
    expect(stripBrowserContextPrompt(`${prompt}\n\nUser request`)).toBe("User request");
  });
});
