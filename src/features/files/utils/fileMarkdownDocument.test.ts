import { afterEach, describe, expect, it } from "vitest";
import {
  clearFileMarkdownDocumentCacheForTests,
  compileFileMarkdownDocument,
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
});
