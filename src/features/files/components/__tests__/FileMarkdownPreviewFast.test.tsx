// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { FileMarkdownPreviewFast } from "../FileMarkdownPreviewFast";
import { clearFastMarkdownRenderCache } from "../../../markdown/fastMarkdownRenderer/cache";
import type { CodeAnnotationSelection } from "../../../code-annotations/types";

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
    render(
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
    await screen.findByRole("button", { name: "Show outline" });
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

  it("does not recompile rich outline when only annotation state changes", async () => {
    const compileModule = await import("../../../markdown/fastMarkdownRenderer/compile");
    const compileSpy = vi.spyOn(compileModule, "compileFastMarkdown");
    const annotation: CodeAnnotationSelection = {
      id: "annotation-rich",
      path: "docs/report.md",
      lineRange: { startLine: 3, endLine: 3 },
      body: "rich annotation body",
      source: "file-preview-mode",
    };
    const { rerender } = render(
      <FileMarkdownPreviewFast
        value={"# Title\n\nparagraph"}
        documentKey="doc-rich-outline-annotation-stable"
        annotations={[]}
        renderAnnotationMarker={(item) => (
          <span data-testid="rich-marker">{item.id}</span>
        )}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Show outline" })).toBeTruthy();
    });
    const compileCallCount = compileSpy.mock.calls.length;

    rerender(
      <FileMarkdownPreviewFast
        value={"# Title\n\nparagraph"}
        documentKey="doc-rich-outline-annotation-stable"
        annotations={[annotation]}
        renderAnnotationMarker={(item) => (
          <span data-testid="rich-marker">{item.id}</span>
        )}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("rich-marker").textContent).toBe("annotation-rich");
      expect(compileSpy).toHaveBeenCalledTimes(compileCallCount);
    });
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

    const expandOutlineButton = await screen.findByRole("button", {
      name: "Show outline",
    });
    fireEvent.click(expandOutlineButton);

    const outlineNavigation = await screen.findByRole("navigation", {
      name: "Outline",
    });
    fireEvent.mouseLeave(outlineNavigation);

    expect(await screen.findByRole("button", { name: "Show outline" })).toBeTruthy();
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

  it("falls back to the rich preview for local markdown image references", async () => {
    const onFallback = vi.fn();
    await renderUnderAct(
      <FileMarkdownPreviewFast
        value="![local](assets/images/local.png)"
        documentKey="doc-local-image"
        sourceFilePath="/repo/docs/report.md"
        rendererProfile="fast-html"
        featureFlags={{ fastHtmlRendererEnabled: true }}
        onFastRendererFallback={onFallback}
      />,
    );

    await waitFor(() => {
      expect(screen.queryByTestId("file-markdown-preview")).toBeTruthy();
    });
    expect(screen.getByRole("img", { name: "local" }).getAttribute("src")).toBe(
      "asset://localhost//repo/docs/assets/images/local.png",
    );
    expect(onFallback).toHaveBeenCalledWith(
      "fast-renderer-fallback:local-image-rich-fallback",
    );
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

  it("keeps the fast body mounted when existing annotation markers are present", async () => {
    const annotations: CodeAnnotationSelection[] = [
      {
        id: "annotation-1",
        path: "docs/report.md",
        lineRange: { startLine: 3, endLine: 3 },
        body: "marker body must not enter diagnostics",
        source: "file-preview-mode",
      },
    ];
    const onFallback = vi.fn();

    render(
      <FileMarkdownPreviewFast
        value={"# heading\n\nparagraph"}
        documentKey="doc-fast-annotation-marker"
        rendererProfile="fast-html"
        featureFlags={{ fastHtmlRendererEnabled: true }}
        annotations={annotations}
        renderAnnotationMarker={(annotation) => (
          <span data-testid="fast-marker">{annotation.id}</span>
        )}
        onFastRendererFallback={onFallback}
      />,
    );
    await waitFor(() => {
      const node = screen.queryByTestId("file-markdown-fast-preview");
      expect(node?.getAttribute("data-fast-renderer-marker")).toBe("ready");
      expect(node?.getAttribute("data-markdown-annotation-overlay-count")).toBe("1");
    });
    expect((await screen.findByTestId("fast-marker")).textContent).toBe("annotation-1");
    expect(onFallback).not.toHaveBeenCalledWith(
      "fast-renderer-fallback:annotation-overlay-rich-fallback",
    );
    expect(screen.queryByTestId("file-markdown-preview")).toBeNull();
  });

  it("places nested annotation markers without whole-document rich fallback", async () => {
    const annotations: CodeAnnotationSelection[] = [
      {
        id: "nested-marker",
        path: "docs/report.md",
        lineRange: { startLine: 4, endLine: 4 },
        body: "nested marker body",
        source: "file-preview-mode",
      },
      {
        id: "code-marker",
        path: "docs/report.md",
        lineRange: { startLine: 9, endLine: 9 },
        body: "code marker body",
        source: "file-preview-mode",
      },
    ];
    const onFallback = vi.fn();

    render(
      <FileMarkdownPreviewFast
        value={[
          "# heading",
          "",
          "- outer",
          "  - nested",
          "",
          "```ts",
          "const a = 1;",
          "const b = 2;",
          "```",
        ].join("\n")}
        documentKey="doc-fast-nested-annotation"
        rendererProfile="fast-html"
        featureFlags={{ fastHtmlRendererEnabled: true }}
        annotations={annotations}
        renderAnnotationMarker={(annotation) => (
          <span data-testid="fast-marker">{annotation.id}</span>
        )}
        onFastRendererFallback={onFallback}
      />,
    );

    await waitFor(() => {
      const node = screen.getByTestId("file-markdown-fast-preview");
      expect(node.getAttribute("data-fast-renderer-marker")).toBe("ready");
      expect(node.getAttribute("data-markdown-annotation-overlay-count")).toBe("2");
    });
    expect(screen.getAllByTestId("fast-marker").map((node) => node.textContent)).toEqual([
      "nested-marker",
      "code-marker",
    ]);
    expect(onFallback).not.toHaveBeenCalled();
    expect(screen.queryByTestId("file-markdown-preview")).toBeNull();
  });

  it("omits unplaceable fast annotation markers locally instead of falling back to rich", async () => {
    const annotations: CodeAnnotationSelection[] = [
      {
        id: "outside-marker",
        path: "docs/report.md",
        lineRange: { startLine: 200, endLine: 200 },
        body: "outside body",
        source: "file-preview-mode",
      },
    ];
    const onFallback = vi.fn();

    render(
      <FileMarkdownPreviewFast
        value={"# heading\n\nparagraph"}
        documentKey="doc-fast-unplaceable-annotation"
        rendererProfile="fast-html"
        featureFlags={{ fastHtmlRendererEnabled: true }}
        annotations={annotations}
        renderAnnotationMarker={(annotation) => (
          <span data-testid="fast-marker">{annotation.id}</span>
        )}
        onFastRendererFallback={onFallback}
      />,
    );

    await waitFor(() => {
      const node = screen.getByTestId("file-markdown-fast-preview");
      expect(node.getAttribute("data-fast-renderer-marker")).toBe("ready");
      expect(node.getAttribute("data-markdown-annotation-overlay-count")).toBe("0");
    });
    expect(screen.queryByTestId("fast-marker")).toBeNull();
    expect(onFallback).not.toHaveBeenCalled();
    expect(screen.queryByTestId("file-markdown-preview")).toBeNull();
  });

  it("keeps the fast compile cache key stable while annotation draft text changes", async () => {
    const { rerender } = render(
      <FileMarkdownPreviewFast
        value={"# heading\n\nparagraph"}
        documentKey="doc-fast-draft-cache"
        rendererProfile="fast-html"
        featureFlags={{ fastHtmlRendererEnabled: true }}
        annotationDraft={{ lineRange: { startLine: 3, endLine: 3 }, body: "" }}
        renderAnnotationDraft={(draft) => (
          <span data-testid="fast-draft">{draft.body || "empty"}</span>
        )}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("file-markdown-fast-preview").getAttribute("data-fast-renderer-marker")).toBe("ready");
    });
    expect((await screen.findByTestId("fast-draft")).textContent).toBe("empty");
    const initialCacheKey = screen
      .getByTestId("file-markdown-fast-preview")
      .getAttribute("data-markdown-cache-key");

    await act(async () => {
      rerender(
        <FileMarkdownPreviewFast
          value={"# heading\n\nparagraph"}
          documentKey="doc-fast-draft-cache"
          rendererProfile="fast-html"
          featureFlags={{ fastHtmlRendererEnabled: true }}
          annotationDraft={{ lineRange: { startLine: 3, endLine: 3 }, body: "typed" }}
          renderAnnotationDraft={(draft) => (
            <span data-testid="fast-draft">{draft.body || "empty"}</span>
          )}
        />,
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId("fast-draft").textContent).toBe("typed");
    });
    expect(
      screen.getByTestId("file-markdown-fast-preview").getAttribute("data-markdown-cache-key"),
    ).toBe(initialCacheKey);
  });

  it("reveals bounded fast content before jumping to an outline target outside the current projection", async () => {
    const scrollIntoView = vi.fn();
    const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
    HTMLElement.prototype.scrollIntoView = scrollIntoView;
    const markdown = [
      "# Top",
      "",
      ...Array.from({ length: 700 }, () => ""),
      "",
      "## Tail Heading",
      "",
      "tail body",
    ].join("\n");

    try {
      render(
        <FileMarkdownPreviewFast
          value={markdown}
          documentKey="doc-bounded-outline-reveal"
          rendererProfile="bounded-fast-html"
          featureFlags={{
            fastHtmlRendererEnabled: true,
            boundedFastHtmlRendererEnabled: true,
          }}
        />,
      );

      await waitFor(() => {
        const node = screen.getByTestId("file-markdown-fast-preview");
        expect(node.getAttribute("data-fast-renderer-marker")).toBe("ready");
        expect(node.getAttribute("data-markdown-truncated")).toBe("true");
        expect(node.getAttribute("data-markdown-visible-line-count")).toBe("600");
      });

      fireEvent.click(await screen.findByRole("button", { name: "Show outline" }));
      fireEvent.click(await screen.findByRole("button", { name: /Tail Heading/ }));

      await waitFor(() => {
        const scrollRoot = screen
          .getByTestId("file-markdown-fast-preview")
          .closest(".fvp-markdown-preview-scroll");
        expect(Number(scrollRoot?.getAttribute("data-markdown-bounded-line-limit"))).toBeGreaterThan(700);
        expect(screen.getByRole("heading", { name: "Tail Heading" })).toBeTruthy();
        expect(scrollIntoView).toHaveBeenCalled();
      });
    } finally {
      HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
    }
  }, 15_000);
});
