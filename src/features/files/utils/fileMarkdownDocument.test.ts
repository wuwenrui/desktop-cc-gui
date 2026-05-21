import { afterEach, describe, expect, it } from "vitest";
import {
  clearFileMarkdownDocumentCacheForTests,
  compileFileMarkdownDocument,
  segmentMarkdownDocumentBlocks,
} from "./fileMarkdownDocument";

describe("fileMarkdownDocument", () => {
  afterEach(() => {
    clearFileMarkdownDocumentCacheForTests();
  });

  it("reuses the compiled document for the same content and renderer profile", () => {
    const first = compileFileMarkdownDocument({
      documentKey: "ws:workspace:README.md",
      rawMarkdown: "# Title\n\nBody",
      rendererProfile: "file-markdown-github",
    });
    const second = compileFileMarkdownDocument({
      documentKey: "ws:workspace:README.md",
      rawMarkdown: "# Title\n\nBody",
      rendererProfile: "file-markdown-github",
    });

    expect(second).toBe(first);
    expect(second.body).toBe("# Title\n\nBody");
    expect(second.frontmatterFields).toEqual([]);
  });

  it("keeps source line mapping after math normalization", () => {
    const compiled = compileFileMarkdownDocument({
      documentKey: "ws:workspace:math.md",
      rawMarkdown: [
        "# Math",
        "",
        "$$\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}$$",
        "",
        "target paragraph",
      ].join("\n"),
      rendererProfile: "file-markdown-github",
    });

    expect(compiled.body).toContain("$$\n\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}\n$$");
    expect(compiled.lineMap[4]).toBe(3);
    expect(compiled.lineMap[6]).toBe(5);
  });

    it("selects a bounded render strategy for markdown with many heavy blocks", () => {
    const rawMarkdown = Array.from({ length: 24 }, (_, index) => [
      "```mermaid",
      `graph TD\nA${index}-->B${index}`,
      "```",
    ].join("\n")).join("\n\n");

    const compiled = compileFileMarkdownDocument({
      documentKey: "ws:workspace:heavy.md",
      rawMarkdown,
      rendererProfile: "file-markdown-github",
    });

      expect(compiled.metrics.heavyBlockCount).toBeGreaterThan(20);
      expect(compiled.renderStrategy).toBe("progressive");
    });

    it("segments fenced code and tables without splitting their renderer blocks", () => {
      const compiled = compileFileMarkdownDocument({
        documentKey: "ws:workspace/blocks.md",
        rawMarkdown: [
          "# Title",
          "",
          "```ts",
          "const a = 1;",
          "const b = 2;",
          "```",
          "",
          "| A | B |",
          "| - | - |",
          "| 1 | 2 |",
        ].join("\n"),
        rendererProfile: "file-markdown-github",
      });

      expect(compiled.blocks.map((block) => block.markdown)).toEqual([
        "# Title",
        "```ts\nconst a = 1;\nconst b = 2;\n```",
        "| A | B |\n| - | - |\n| 1 | 2 |",
      ]);
    expect(compiled.blocks[1]).toMatchObject({ startLine: 3, endLine: 6 });
    expect(compiled.blocks[2]).toMatchObject({ startLine: 8, endLine: 10 });
  });

  it("keeps stateful Markdown structures atomic while chunking plain prose", () => {
    const orderedList = Array.from({ length: 100 }, (_, index) => `${index + 1}. item ${index + 1}`)
      .join("\n");
    const plainProse = Array.from({ length: 100 }, (_, index) => `plain line ${index + 1}`)
      .join("\n");
    const blocks = segmentMarkdownDocumentBlocks([
      orderedList,
      "",
      "> quote line 1",
      "> quote line 2",
      "",
      plainProse,
    ].join("\n"));

    expect(blocks[0]?.markdown).toBe(orderedList);
    expect(blocks[1]?.markdown).toBe("> quote line 1\n> quote line 2");
    expect(blocks.slice(2).map((block) => block.markdown.split("\n").length)).toEqual([80, 20]);
  });

  it("detects GFM pipe tables without a leading pipe", () => {
    const blocks = segmentMarkdownDocumentBlocks([
      "A | B",
      "--- | ---",
      "1 | 2",
      "3 | 4",
    ].join("\n"));

    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.markdown).toBe("A | B\n--- | ---\n1 | 2\n3 | 4");
  });
});
