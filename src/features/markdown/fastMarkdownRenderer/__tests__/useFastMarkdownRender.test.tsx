// @vitest-environment jsdom

import { render, screen, waitFor } from "@testing-library/react";
import { act } from "react";
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

function HookHarness(props: { rawMarkdown: string }) {
  const renderState = useFastMarkdownRender({
    documentKey: "worker-hook-doc",
    rawMarkdown: props.rawMarkdown,
    featureFlags: { fastHtmlRendererEnabled: true },
    rendererProfile: "fast-html",
  });

  return (
    <output
      data-testid="hook-state"
      data-status={renderState.status}
      data-profile={renderState.resolvedProfile}
    >
      {renderState.result?.html ?? ""}
    </output>
  );
}

describe("useFastMarkdownRender worker adapter orchestration", () => {
  beforeEach(() => {
    workerMock.requests.length = 0;
    workerMock.compile.mockClear();
  });

  it("ignores stale worker results when a newer markdown snapshot wins", async () => {
    const { rerender } = render(<HookHarness rawMarkdown="# First" />);

    await waitFor(() => expect(workerMock.requests).toHaveLength(1));
    rerender(<HookHarness rawMarkdown="# Second" />);
    await waitFor(() => expect(workerMock.requests).toHaveLength(2));

    await act(async () => {
      workerMock.requests[0].resolve(createRenderResult("first", "<h1>First</h1>"));
    });

    expect(screen.getByTestId("hook-state").textContent).not.toContain("First");

    await act(async () => {
      workerMock.requests[1].resolve(createRenderResult("second", "<h1>Second</h1>"));
    });

    expect(screen.getByTestId("hook-state").getAttribute("data-status")).toBe("ready");
    expect(screen.getByTestId("hook-state").textContent).toContain("Second");
  });
});

function createRenderResult(contentHash: string, html: string): FastMarkdownRenderResult {
  const cacheKey = `worker-hook-doc:fast-html:${contentHash}:full:fast|no-bounded`;
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
