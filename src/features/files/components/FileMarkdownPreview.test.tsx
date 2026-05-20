/** @vitest-environment jsdom */
import { act } from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadKatexAssets } from "../../markdown/markdownMath";
import { FileMarkdownPreview } from "./FileMarkdownPreview";

vi.mock("@tauri-apps/plugin-opener", () => ({
  openUrl: vi.fn(),
}));

function makeParagraphMarkdown(lineCount: number) {
  return Array.from({ length: lineCount }, (_, index) => `paragraph-${index + 1}`)
    .join("\n");
}

describe("FileMarkdownPreview render budget", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("renders medium markdown progressively instead of mounting all lines at once", () => {
    vi.useFakeTimers();

    render(
      <FileMarkdownPreview
        documentKey="docs:medium"
        value={makeParagraphMarkdown(500)}
      />,
    );

    const preview = screen.getByTestId("file-markdown-preview");
    expect(preview.getAttribute("data-markdown-render-projection")).toBe("progressive");
    expect(preview.getAttribute("data-markdown-visible-lines")).toBe("360");
    expect(screen.queryByText("paragraph-500")).toBeNull();

    act(() => {
      vi.runOnlyPendingTimers();
    });

    expect(preview.getAttribute("data-markdown-visible-lines")).toBe("500");
    expect(preview.textContent).toContain("paragraph-500");
  });

  it("uses a bounded projection for very large markdown documents", () => {
    render(
      <FileMarkdownPreview
        documentKey="docs:large"
        value={makeParagraphMarkdown(7_000)}
      />,
    );

    const preview = screen.getByTestId("file-markdown-preview");
    expect(preview.getAttribute("data-markdown-render-projection")).toBe("bounded");
    expect(preview.getAttribute("data-markdown-visible-lines")).toBe("1800");
    expect(screen.getByTestId("file-markdown-render-budget")).toBeTruthy();
    expect(preview.textContent).not.toContain("paragraph-7000");
  });

  it("keeps annotation draft rerenders inside the projected markdown window", () => {
    vi.useFakeTimers();
    const markdown = makeParagraphMarkdown(500);
    const { rerender } = render(
      <FileMarkdownPreview
        documentKey="docs:annotation"
        value={markdown}
        annotationDraft={{ lineRange: { startLine: 4, endLine: 4 }, body: "" }}
        renderAnnotationDraft={() => <div>draft</div>}
      />,
    );

    rerender(
      <FileMarkdownPreview
        documentKey="docs:annotation"
        value={markdown}
        annotationDraft={{ lineRange: { startLine: 4, endLine: 4 }, body: "typed" }}
        renderAnnotationDraft={() => <div>draft</div>}
      />,
    );

    const preview = screen.getByTestId("file-markdown-preview");
    expect(preview.getAttribute("data-markdown-render-projection")).toBe("progressive");
    expect(preview.getAttribute("data-markdown-visible-lines")).toBe("360");
    expect(preview.textContent).not.toContain("paragraph-500");
  });

  it("defers heavy code blocks outside the visible lazy budget", () => {
    const heavyCode = Array.from({ length: 120 }, (_, index) => `const line${index} = ${index};`)
      .join("\n");
    render(
      <FileMarkdownPreview
        documentKey="docs:heavy-code"
        value={[
          "```ts",
          heavyCode,
          "```",
          "",
          makeParagraphMarkdown(500),
        ].join("\n")}
      />,
    );

    expect(screen.getByTestId("file-markdown-heavy-placeholder")).toBeTruthy();
    expect(screen.queryByText("const line119 = 119;")).toBeNull();
  });

  it("keeps invalid fenced math fallback local to that block", async () => {
    await loadKatexAssets();

    render(
      <FileMarkdownPreview
        documentKey="docs:invalid-math"
        value={[
          "before math",
          "",
          "```math",
          "\\definitelyinvalid{",
          "```",
          "",
          "after math",
        ].join("\n")}
      />,
    );

    expect(screen.getByText("before math")).toBeTruthy();
    expect(screen.getByText("after math")).toBeTruthy();
    expect(screen.getByText("\\definitelyinvalid{")).toBeTruthy();
  });
});
