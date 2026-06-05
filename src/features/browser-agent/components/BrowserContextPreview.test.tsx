// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BrowserContextPreview } from "./BrowserContextPreview";
import type { BrowserContextAttachment } from "../types";

function makeAttachment(): BrowserContextAttachment {
  return {
    kind: "browser_snapshot",
    attachmentId: "browser-attachment-1",
    browserSessionId: "browser-session-1",
    snapshotId: "browser-snapshot-1",
    workspaceId: "workspace-1",
    title: "文件改动对比显示不正确 · Issue #642",
    url: "https://github.com/example/repo/issues/642",
    capturedAt: 100,
    stale: false,
    freshness: "fresh",
    observation: {
      schemaVersion: 1,
      observationId: "browser-observation-1",
      browserSessionId: "browser-session-1",
      workspaceId: "workspace-1",
      capturedAt: 100,
      state: "available",
      staleReasons: [],
      transport: "webview_dom",
      rendererBinding: "matched",
      source: {
        url: "https://github.com/example/repo/issues/642",
        normalizedUrl: "https://github.com/example/repo/issues/642",
        origin: "https://github.com",
        title: "文件改动对比显示不正确 · Issue #642",
        tabLabel: "Issue #642",
        workspaceLocalAllowed: false,
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
      privacy: {
        redactionApplied: false,
        redactedKinds: [],
        omittedKinds: ["raw_dom", "cookies", "headers"],
      },
      diagnostics: [],
      omittedCapabilities: [],
    },
    summary: "Issue #642 summary",
    visibleTextExcerpt: "Issue body says deleted files should use strikethrough.",
    pageType: "issue",
    primaryContent:
      "Issue body says deleted files should use strikethrough and new files are missing from the diff view.",
    readableBlocks: [
      {
        blockId: "issue-body",
        role: "issue_body",
        text: "图一属于删除文件，是否可参考其他 IDE 的显示划线方式。图二其实是有新增文件，应用没有显示出来。",
        score: 960,
        truncated: false,
      },
    ],
    noiseDiagnostics: [],
    visualEvidence: [
      {
        evidenceId: "issue-image-1",
        kind: "image",
        label: "issue screenshot",
        altText: "diff display screenshot",
        srcOrigin: "https://github.com",
        nearbyText: "图一：删除文件截图。图二：新增文件截图。",
        visible: true,
        sensitive: false,
      },
    ],
    elementCounts: {
      headings: 15,
      links: 27,
      buttons: 7,
      forms: 0,
      landmarks: 1,
      codeCandidates: 0,
      readableBlocks: 1,
      visualEvidence: 1,
    },
    diagnostics: [],
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
    codeCandidates: [],
    privacy: {
      redactionApplied: false,
      redactedKinds: [],
      omittedKinds: ["raw_dom", "cookies", "headers"],
    },
  };
}

describe("BrowserContextPreview", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows evidence details in the composer preview card", () => {
    render(
      <BrowserContextPreview
        attachment={makeAttachment()}
        busy={false}
        onRefresh={vi.fn()}
        onRemove={vi.fn()}
      />,
    );

    expect(screen.getByText("Visual clues 1")).toBeTruthy();
    expect(screen.queryByText(/Issue body says deleted files/)).toBeNull();
    fireEvent.click(screen.getByText("Show capture details"));

    expect(screen.getByText("Primary content")).toBeTruthy();
    expect(screen.getAllByText(/strikethrough/).length).toBeGreaterThan(0);
    expect(screen.getByText(/图一属于删除文件/)).toBeTruthy();
    expect(screen.getByText(/issue screenshot/)).toBeTruthy();
    expect(screen.getByText(/diff display screenshot/)).toBeTruthy();
  });
});
