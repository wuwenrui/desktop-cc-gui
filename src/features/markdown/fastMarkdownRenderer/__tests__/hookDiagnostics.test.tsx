// @vitest-environment jsdom
import { render, waitFor, act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useFastMarkdownRender } from "../useFastMarkdownRender";
import type {
  CompileFastMarkdownArgs,
  FastMarkdownRenderResult,
} from "../types";

const workerMock = vi.hoisted(() => {
  type PendingRequest = {
    args: CompileFastMarkdownArgs;
    resolve: (result: FastMarkdownRenderResult) => void;
    reject: (error: Error) => void;
  };
  return {
    requests: [] as PendingRequest[],
    compile: vi.fn((args: CompileFastMarkdownArgs) => (
      new Promise<FastMarkdownRenderResult>((resolve, reject) => {
        workerMock.requests.push({ args, resolve, reject });
      })
    )),
  };
});

vi.mock("../workerAdapter", () => ({
  compileFastMarkdownWithWorkerFallback: workerMock.compile,
}));

import { hookDiagnostics } from "../hookDiagnostics";

function HookHarness(props: { rawMarkdown: string }) {
  const renderState = useFastMarkdownRender({
    documentKey: "hook-diagnostics-doc",
    rawMarkdown: props.rawMarkdown,
    featureFlags: { fastHtmlRendererEnabled: true },
    rendererProfile: "fast-html",
  });
  return (
    <output
      data-testid="hook-state"
      data-status={renderState.status}
    />
  );
}

function makeRenderResult(contentHash: string, html: string): FastMarkdownRenderResult {
  const cacheKey = `hook-diagnostics-doc:fast-html:${contentHash}:full:fast|no-bounded`;
  return {
    cacheKey,
    contentHash,
    html,
    outline: [],
    sourceLineAnchors: [],
    heavyBlocks: [],
    rendererProfile: "fast-html",
    diagnostics: {
      profile: "fast-html",
      contentHash,
      cacheKey,
      cacheState: "miss",
      compileDurationMs: 1,
      sanitizeDurationMs: 1,
      totalSourceLines: 1,
      totalHeadings: 1,
      totalHeavyBlocks: 0,
      fallbackReason: "none",
      truncated: false,
      featureFlagApplied: true,
    },
  };
}

describe("useFastMarkdownRender hook diagnostics", () => {
  beforeEach(() => {
    workerMock.requests.length = 0;
    workerMock.compile.mockClear();
    hookDiagnostics.reset();
  });

  it("records a stale visible-result drop when a newer snapshot wins", async () => {
    const { rerender } = render(<HookHarness rawMarkdown="# First" />);
    await waitFor(() => expect(workerMock.requests).toHaveLength(1));
    rerender(<HookHarness rawMarkdown="# Second" />);
    await waitFor(() => expect(workerMock.requests).toHaveLength(2));

    // Resolve the *first* (now stale) request — hook should drop it.
    await act(async () => {
      workerMock.requests[0].resolve(makeRenderResult("first", "<h1>First</h1>"));
    });
    expect(hookDiagnostics.snapshot().staleVisibleResultDropCount).toBeGreaterThanOrEqual(1);

    // Resolve the *current* request — visible content should converge.
    await act(async () => {
      workerMock.requests[1].resolve(makeRenderResult("second", "<h1>Second</h1>"));
    });
  });
});
