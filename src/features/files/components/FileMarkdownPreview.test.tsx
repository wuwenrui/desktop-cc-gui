/** @vitest-environment jsdom */
import { act } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadKatexAssets } from "../../markdown/markdownMath";
import {
  clearFileMarkdownPreviewRuntimeCachesForTests,
  FileMarkdownPreview,
} from "./FileMarkdownPreview";

vi.mock("@tauri-apps/plugin-opener", () => ({
  openUrl: vi.fn(),
}));

vi.mock("mermaid", () => ({
  default: {
    initialize: vi.fn(),
    render: vi.fn(async (_id: string, source: string) => ({
      svg: `<svg data-mermaid-source="${source.replace(/"/g, "&quot;")}"></svg>`,
    })),
  },
}));

function makeParagraphMarkdown(lineCount: number) {
  return Array.from({ length: lineCount }, (_, index) => `paragraph-${index + 1}`)
    .join("\n");
}

describe("FileMarkdownPreview render budget", () => {
  afterEach(() => {
    clearFileMarkdownPreviewRuntimeCachesForTests();
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

  it("uses a slower progressive cadence under active file render pressure", () => {
    vi.useFakeTimers();

    render(
      <FileMarkdownPreview
        documentKey="docs:pressure"
        value={makeParagraphMarkdown(500)}
        renderPressure={{
          engineProcessing: true,
          editorSplitChatVisible: true,
          activeSurface: "editor",
        }}
      />,
    );

    const preview = screen.getByTestId("file-markdown-preview");
    expect(preview.getAttribute("data-markdown-visible-lines")).toBe("360");

    act(() => {
      vi.advanceTimersByTime(16);
    });
    expect(preview.getAttribute("data-markdown-visible-lines")).toBe("360");

    act(() => {
      vi.advanceTimersByTime(80);
    });
    expect(preview.getAttribute("data-markdown-visible-lines")).toBe("500");
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
    expect(preview.getAttribute("data-markdown-visible-lines")).toBe("2800");
    expect(screen.getByTestId("file-markdown-render-budget")).toBeTruthy();
    expect(preview.textContent).not.toContain("paragraph-7000");
  });

  it("resolves local markdown image paths relative to the source markdown file", () => {
    render(
      <FileMarkdownPreview
        documentKey="docs:local-image"
        value="![forecast](assets/images/overview_forecast_command_center.png)"
        workspaceId="ws-preview"
        sourceFilePath="/repo/docs.vehicle-sales-forecast/01-report.md"
      />,
    );

    expect(screen.getByRole("img", { name: "forecast" }).getAttribute("src")).toBe(
      "asset://localhost//repo/docs.vehicle-sales-forecast/assets/images/overview_forecast_command_center.png",
    );
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

  it("does not flash a revealed table back to the lazy placeholder during annotation rerenders", () => {
    const tableMarkdown = [
      "| 类型 | 典型网站 |",
      "| --- | --- |",
      "| 车企官网 | byd.com |",
    ].join("\n");
    const markdown = [
      tableMarkdown,
      "",
      makeParagraphMarkdown(500),
    ].join("\n");

    const revealedTable = render(
      <FileMarkdownPreview
        documentKey="docs:stable-table"
        value={tableMarkdown}
      />,
    );
    expect(screen.getByText("byd.com")).toBeTruthy();
    revealedTable.unmount();

    const { rerender, unmount } = render(
      <FileMarkdownPreview
        documentKey="docs:stable-table"
        value={markdown}
      />,
    );
    expect(screen.queryByTestId("file-markdown-heavy-placeholder")).toBeNull();
    expect(screen.getByText("byd.com")).toBeTruthy();

    rerender(
      <FileMarkdownPreview
        documentKey="docs:stable-table"
        value={markdown}
        annotationDraft={{ lineRange: { startLine: 1, endLine: 3 }, body: "标注中" }}
        renderAnnotationDraft={() => <div>annotation draft</div>}
      />,
    );

    expect(screen.queryByTestId("file-markdown-heavy-placeholder")).toBeNull();
    expect(screen.getByText("byd.com")).toBeTruthy();

    unmount();
    render(
      <FileMarkdownPreview
        documentKey="docs:stable-table"
        value={markdown}
      />,
    );

    expect(screen.queryByTestId("file-markdown-heavy-placeholder")).toBeNull();
    expect(screen.getByText("byd.com")).toBeTruthy();
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

  it("preserves common markdown block rendering semantics", async () => {
    await loadKatexAssets();

    const { container } = render(
      <FileMarkdownPreview
        documentKey="docs:correctness"
        value={[
          "| Metric | Value |",
          "| :--- | ---: |",
          "| **Speed** | $42$ |",
          "",
          "1. First",
          "   - Nested",
          "   - [x] Done",
          "",
          "$$E=mc^2$$",
          "",
          "```ts",
          "const answer = 42;",
          "```",
        ].join("\n")}
      />,
    );

    const table = container.querySelector(".fvp-file-markdown-table-wrap table");
    expect(table).toBeTruthy();
    expect(table?.querySelectorAll("thead th")).toHaveLength(2);
    expect(table?.querySelector("strong")?.textContent).toBe("Speed");
    expect(container.querySelector("ol ul")).toBeTruthy();
    expect(container.querySelector('input[type="checkbox"]:checked')).toBeTruthy();
    expect(container.querySelector(".katex-display")).toBeTruthy();
    expect(container.querySelector("code.language-ts")?.textContent).toContain("const answer = 42;");
  });

  it("renders flowchart fenced blocks through the Mermaid lifecycle", async () => {
    render(
      <FileMarkdownPreview
        documentKey="docs:flowchart"
        value={[
          "```flowchart",
          "flowchart TD",
          "Start-->End",
          "```",
        ].join("\n")}
      />,
    );

    fireEvent.click(screen.getByRole("tab", { name: /render|渲染/i }));

    const renderedFlowchart = await screen.findByTestId("file-markdown-mermaid-preview");
    expect(renderedFlowchart.innerHTML).toContain("flowchart TD");
    expect(renderedFlowchart.innerHTML).toContain("Start-->End");
  });

  it("restores wide table horizontal scroll after same-document remounts", () => {
    const markdown = [
      "| C1 | C2 | C3 | C4 | C5 |",
      "| --- | --- | --- | --- | --- |",
      "| a | b | c | d | e |",
    ].join("\n");
    const { container, unmount } = render(
      <FileMarkdownPreview
        documentKey="docs:wide-table"
        value={markdown}
      />,
    );

    const tableWrap = container.querySelector(".fvp-file-markdown-table-wrap") as HTMLDivElement;
    tableWrap.scrollLeft = 240;
    fireEvent.scroll(tableWrap);
    unmount();

    const remounted = render(
      <FileMarkdownPreview
        documentKey="docs:wide-table"
        value={markdown}
      />,
    );
    const restoredTableWrap = remounted.container.querySelector(
      ".fvp-file-markdown-table-wrap",
    ) as HTMLDivElement;

    expect(restoredTableWrap.scrollLeft).toBe(240);
  });

  it("keeps wide table horizontal scroll during unrelated annotation rerenders", () => {
    const markdown = [
      "| C1 | C2 | C3 | C4 | C5 |",
      "| --- | --- | --- | --- | --- |",
      "| a | b | c | d | e |",
      "",
      "paragraph outside the table",
    ].join("\n");
    const { container, rerender } = render(
      <FileMarkdownPreview
        documentKey="docs:wide-table-annotation"
        value={markdown}
      />,
    );

    const tableWrap = container.querySelector(".fvp-file-markdown-table-wrap") as HTMLDivElement;
    tableWrap.scrollLeft = 180;
    fireEvent.scroll(tableWrap);

    rerender(
      <FileMarkdownPreview
        documentKey="docs:wide-table-annotation"
        value={markdown}
        annotationDraft={{ lineRange: { startLine: 5, endLine: 5 }, body: "draft" }}
        renderAnnotationDraft={() => <div>annotation draft</div>}
      />,
    );

    const tableWrapAfterRerender = container.querySelector(
      ".fvp-file-markdown-table-wrap",
    ) as HTMLDivElement;
    expect(tableWrapAfterRerender.scrollLeft).toBe(180);
    expect(screen.getByText("annotation draft")).toBeTruthy();
  });

  it("keeps Mermaid source/render switching inside a stable body", async () => {
    render(
      <FileMarkdownPreview
        documentKey="docs:mermaid-stable-switch"
        value={[
          "```mermaid",
          "graph TD",
          "A-->B",
          "```",
        ].join("\n")}
      />,
    );

    const sourceTab = screen.getByRole("tab", { name: /source|源码/i });
    const renderTab = screen.getByRole("tab", { name: /render|渲染/i });
    const body = screen.getByTestId("file-markdown-mermaid-body");

    fireEvent.click(renderTab);
    await screen.findByTestId("file-markdown-mermaid-preview");
    expect(screen.getByTestId("file-markdown-mermaid-body")).toBe(body);

    fireEvent.click(sourceTab);
    expect(screen.getByTestId("file-markdown-mermaid-body")).toBe(body);

    fireEvent.click(renderTab);
    expect(screen.getByTestId("file-markdown-mermaid-body")).toBe(body);
    expect(screen.queryByText(/rendering diagram|正在渲染|files\.markdownMermaidRendering/i))
      .toBeNull();
    expect(screen.getByTestId("file-markdown-mermaid-preview")).toBeTruthy();
  });
});
