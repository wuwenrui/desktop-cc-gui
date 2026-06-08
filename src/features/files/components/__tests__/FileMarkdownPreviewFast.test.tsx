// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { FileMarkdownPreviewFast } from "../FileMarkdownPreviewFast";
import { clearFastMarkdownRenderCache } from "../../../markdown/fastMarkdownRenderer/cache";

beforeEach(() => {
  clearFastMarkdownRenderCache();
});

afterEach(() => {
  clearFastMarkdownRenderCache();
  vi.restoreAllMocks();
});

/**
 * Smoke test for the FileMarkdownPreviewFast opt-in wrapper.
 *
 * The wrapper is intentionally thin: it routes between the
 * existing rich `FileMarkdownPreview` and the new fast
 * `FileMarkdownFastPreview` based on the `rendererProfile` prop,
 * and fails closed to the rich path when the fast path reports
 * a fallback. The rich path itself is covered by its own test
 * suite, so this file only verifies the routing contract.
 *
 * Note: every render call is wrapped in `act()` so the async
 * compile path inside `useFastMarkdownRender` (which is an
 * un-awaited promise) flushes its state updates before the test
 * moves on. Without the `act` wrap, the initial idle render
 * returns the rich path (because the hook's IDLE_RESULT reports
 * shouldFallback=true) and the test exits before the effect
 * flips the state to the fast preview surface.
 */
async function renderUnderAct(element: React.ReactElement) {
  let result: ReturnType<typeof render> | null = null;
  await act(async () => {
    result = render(element);
  });
  return result!;
}

describe("FileMarkdownPreviewFast", () => {
  it("renders the fast preview when a fast profile is selected", async () => {
    await renderUnderAct(
      <FileMarkdownPreviewFast
        value="# title\n\nparagraph"
        documentKey="doc-fast"
        rendererProfile="fast-html"
        featureFlags={{ fastHtmlRendererEnabled: true }}
      />,
    );

    // After the compile resolves, the fast preview mounts a div
    // carrying data-testid="file-markdown-fast-preview". We poll
    // because the wrapper flips the fast path on the second tick
    // (the hook's pending state) and on the third tick (the
    // resolved state).
    await waitFor(() => {
      const fastNode = screen.queryByTestId("file-markdown-fast-preview");
      expect(fastNode).toBeTruthy();
    });
  });

  it("renders the rich preview when no profile is provided", async () => {
    await renderUnderAct(
      <FileMarkdownPreviewFast
        value="# title"
        documentKey="doc-rich-default"
      />,
    );
    // Rich path uses the existing `data-testid="file-markdown-preview"`.
    expect(screen.queryByTestId("file-markdown-preview")).toBeTruthy();
  });

  it("renders parser-derived outline for the default rich preview", async () => {
    const scrollIntoView = vi.fn();
    const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
    HTMLElement.prototype.scrollIntoView = scrollIntoView;

    try {
      await renderUnderAct(
        <FileMarkdownPreviewFast
          value={"# Title\n\n## Details\n\nBody"}
          documentKey="doc-rich-outline"
          t={(key) => {
            if (key === "files.previewOutlineTitle") {
              return "目录";
            }
            if (key === "files.documentPreviewOutlineEmpty") {
              return "未检测到目录";
            }
            return key;
          }}
        />,
      );

      const expandOutlineButton = await screen.findByRole("button", {
        name: "Show outline",
      });
      fireEvent.click(expandOutlineButton);

      const detailsOutlineButton = await screen.findByRole("button", {
        name: /Details/,
      });
      expect(screen.getByRole("navigation", { name: "目录" })).toBeTruthy();

      fireEvent.click(detailsOutlineButton);

      await waitFor(() => {
        expect(scrollIntoView).toHaveBeenCalled();
      });
    } finally {
      HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
    }
  });

  it("auto-collapses unpinned outline after selection", async () => {
    const scrollIntoView = vi.fn();
    const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
    HTMLElement.prototype.scrollIntoView = scrollIntoView;

    try {
      await renderUnderAct(
        <FileMarkdownPreviewFast
          value={"# Title\n\n## Details\n\nBody"}
          documentKey="doc-rich-outline-autocollapse"
        />,
      );

      fireEvent.click(await screen.findByRole("button", { name: "Show outline" }));
      fireEvent.click(await screen.findByRole("button", { name: /Details/ }));

      await waitFor(() => {
        expect(scrollIntoView).toHaveBeenCalledTimes(1);
        expect(screen.getByRole("button", { name: "Show outline" })).toBeTruthy();
      });
    } finally {
      HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
    }
  });

  it("keeps pinned outline open and supports selecting the same entry twice", async () => {
    const scrollIntoView = vi.fn();
    const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
    HTMLElement.prototype.scrollIntoView = scrollIntoView;

    try {
      await renderUnderAct(
        <FileMarkdownPreviewFast
          value={"# Title\n\n## Details\n\nBody"}
          documentKey="doc-rich-outline-repeat"
        />,
      );

      fireEvent.click(await screen.findByRole("button", { name: "Show outline" }));
      fireEvent.click(await screen.findByRole("button", { name: "Pin outline" }));

      const detailsOutlineButton = await screen.findByRole("button", {
        name: /Details/,
      });
      fireEvent.click(detailsOutlineButton);
      fireEvent.click(detailsOutlineButton);

      await waitFor(() => {
        expect(scrollIntoView).toHaveBeenCalledTimes(2);
      });
      expect(screen.queryByRole("button", { name: "Show outline" })).toBeNull();
    } finally {
      HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
    }
  });

  it("auto-collapses unpinned outline when the pointer leaves the outline panel", async () => {
    await renderUnderAct(
      <FileMarkdownPreviewFast
        value={"# Title\n\n## Details\n\nBody"}
        documentKey="doc-rich-outline-mouseleave"
      />,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Show outline" }));
    fireEvent.mouseLeave(await screen.findByRole("navigation", { name: "Outline" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Show outline" })).toBeTruthy();
    });
  });

  it("keeps pinned outline open when the pointer leaves the outline panel", async () => {
    await renderUnderAct(
      <FileMarkdownPreviewFast
        value={"# Title\n\n## Details\n\nBody"}
        documentKey="doc-rich-outline-pinned-mouseleave"
      />,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Show outline" }));
    fireEvent.click(await screen.findByRole("button", { name: "Pin outline" }));
    fireEvent.mouseLeave(await screen.findByRole("navigation", { name: "Outline" }));

    await waitFor(() => {
      expect(screen.getByRole("navigation", { name: "Outline" })).toBeTruthy();
    });
    expect(screen.queryByRole("button", { name: "Show outline" })).toBeNull();
  });

  it("supports collapsing and expanding nested outline sections", async () => {
    await renderUnderAct(
      <FileMarkdownPreviewFast
        value={"# Title\n\n## Details\n\nBody"}
        documentKey="doc-rich-outline-tree-collapse"
      />,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Show outline" }));
    expect(await screen.findByRole("button", { name: /Details/ })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Collapse section" }));
    expect(screen.queryByRole("button", { name: /Details/ })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Expand section" }));
    expect(await screen.findByRole("button", { name: /Details/ })).toBeTruthy();
  });

  it("renders the rich preview when an explicit rich profile is passed", async () => {
    await renderUnderAct(
      <FileMarkdownPreviewFast
        value="# title"
        documentKey="doc-rich-explicit"
        rendererProfile="rich-react"
      />,
    );
    expect(screen.queryByTestId("file-markdown-preview")).toBeTruthy();
  });

  it("renders the rich preview when low-cost-readable profile is passed", async () => {
    await renderUnderAct(
      <FileMarkdownPreviewFast
        value="# title"
        documentKey="doc-readable"
        rendererProfile="low-cost-readable"
      />,
    );
    expect(screen.queryByTestId("file-markdown-preview")).toBeTruthy();
  });

  it("falls back to the rich preview when the fast path reports a fallback", async () => {
    // Force the compile pipeline to fail so the hook reports a real
    // runtime fallback. This is the contract: the wrapper must
    // degrade to the rich path AND surface the fallback via the
    // callback so telemetry can capture the reason.
    const compileSpy = vi
      .spyOn(await import("../../../markdown/fastMarkdownRenderer/compile"), "compileFastMarkdown")
      .mockRejectedValueOnce(new Error("simulated compile failure"));

    const onFallback = vi.fn();
    await renderUnderAct(
      <FileMarkdownPreviewFast
        value="hello"
        documentKey="doc-fallback"
        rendererProfile="fast-html"
        featureFlags={{ fastHtmlRendererEnabled: true }}
        onFastRendererFallback={onFallback}
      />,
    );

    // The fast preview returns `null` when shouldFallback is true,
    // so the wrapper degrades to the rich path. We assert that the
    // rich testid eventually shows up.
    await waitFor(() => {
      expect(screen.queryByTestId("file-markdown-preview")).toBeTruthy();
    });
    expect(onFallback).toHaveBeenCalled();
    expect(compileSpy).toHaveBeenCalled();
  });

  it("stays on the fast path when the compile succeeds", async () => {
    await renderUnderAct(
      <FileMarkdownPreviewFast
        value={"# heading\n\nbody"}
        documentKey="doc-fast-success"
        rendererProfile="fast-html"
        featureFlags={{ fastHtmlRendererEnabled: true }}
      />,
    );
    await waitFor(() => {
      const node = screen.queryByTestId("file-markdown-fast-preview");
      expect(node?.getAttribute("data-fast-renderer-marker")).toBe("ready");
    });
  });

  it("does not call onFastRendererFallback when the fast path succeeds", async () => {
    const onFallback = vi.fn();
    await renderUnderAct(
      <FileMarkdownPreviewFast
        value={"# heading\n\nbody"}
        documentKey="doc-fast-no-fallback"
        rendererProfile="fast-html"
        featureFlags={{ fastHtmlRendererEnabled: true }}
        onFastRendererFallback={onFallback}
      />,
    );
    await waitFor(() => {
      const node = screen.queryByTestId("file-markdown-fast-preview");
      expect(node?.getAttribute("data-fast-renderer-marker")).toBe("ready");
    });
    expect(onFallback).not.toHaveBeenCalled();
  });
});
