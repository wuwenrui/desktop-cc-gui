import { describe, expect, it } from "vitest";
import {
  countFastMarkdownProfileBlocks,
  countMarkdownSourceLines,
  resolveFastMarkdownProfileInputs,
  resolveFastMarkdownRendererProfile,
  FAST_MARKDOWN_RENDERER_LIMITS,
} from "../resolveProfile";
import { createSyntheticLongMarkdownFixture } from "./fixtures";

describe("countMarkdownSourceLines", () => {
  it("returns 0 for empty input", () => {
    expect(countMarkdownSourceLines("")).toBe(0);
  });

  it("counts newlines (LF) without an off-by-one", () => {
    const markdown = "a\nb\nc";
    expect(countMarkdownSourceLines(markdown)).toBe(3);
  });

  it("handles CR/LF line endings", () => {
    const markdown = "a\r\nb\r\nc";
    expect(countMarkdownSourceLines(markdown)).toBe(3);
  });
});

describe("countFastMarkdownProfileBlocks", () => {
  it("counts block and heavy-block pressure for profile selection", () => {
    const metrics = countFastMarkdownProfileBlocks([
      "# Title",
      "",
      "| a | b |",
      "| - | - |",
      "| 1 | 2 |",
      "",
      "```mermaid",
      "graph TD",
      "A --> B",
      "```",
    ].join("\n"));

    expect(metrics.markdownBlockCount).toBeGreaterThanOrEqual(3);
    expect(metrics.heavyBlockCount).toBeGreaterThanOrEqual(2);
  });

  it("captures synthetic long markdown fixture pressure", () => {
    const markdown = createSyntheticLongMarkdownFixture();
    const metrics = countFastMarkdownProfileBlocks(markdown);

    expect(countMarkdownSourceLines(markdown)).toBeGreaterThan(6_000);
    expect(metrics.markdownBlockCount).toBeGreaterThan(
      FAST_MARKDOWN_RENDERER_LIMITS.LARGE_MARKDOWN_BLOCK_BUDGET,
    );
    expect(metrics.heavyBlockCount).toBeGreaterThan(0);
  });
});

describe("resolveFastMarkdownProfileInputs", () => {
  it("defaults bounded line limit to the package constant", () => {
    const inputs = resolveFastMarkdownProfileInputs({
      rawMarkdown: "a",
      featureFlags: { fastHtmlRendererEnabled: true },
    });
    expect(inputs.boundedLineLimit).toBe(FAST_MARKDOWN_RENDERER_LIMITS.DEFAULT_BOUNDED_LINE_LIMIT);
  });

  it("respects caller-supplied bounded line limit", () => {
    const inputs = resolveFastMarkdownProfileInputs({
      rawMarkdown: "a",
      featureFlags: { fastHtmlRendererEnabled: true },
      boundedLineLimit: 42,
    });
    expect(inputs.boundedLineLimit).toBe(42);
  });

  it("treats fastHtmlOnly as false by default", () => {
    const inputs = resolveFastMarkdownProfileInputs({
      rawMarkdown: "a",
      featureFlags: { fastHtmlRendererEnabled: true },
    });
    expect(inputs.fastHtmlOnly).toBe(false);
  });

  it("propagates the fastHtmlOnly override", () => {
    const inputs = resolveFastMarkdownProfileInputs({
      rawMarkdown: "a",
      featureFlags: { fastHtmlRendererEnabled: true },
      fastHtmlOnly: true,
    });
    expect(inputs.fastHtmlOnly).toBe(true);
  });
});

describe("resolveFastMarkdownRendererProfile", () => {
  it("returns rich-react when the fast flag is off", () => {
    const profile = resolveFastMarkdownRendererProfile(
      resolveFastMarkdownProfileInputs({
        rawMarkdown: "small",
        featureFlags: { fastHtmlRendererEnabled: false },
      }),
    );
    expect(profile).toBe("rich-react");
  });

  it("returns fast-html for large documents by default when the fast flag is off", () => {
    const large = Array.from(
      { length: FAST_MARKDOWN_RENDERER_LIMITS.LARGE_MARKDOWN_LINE_BUDGET + 1 },
      (_, index) => `paragraph ${index}`,
    ).join("\n");
    const profile = resolveFastMarkdownRendererProfile(
      resolveFastMarkdownProfileInputs({
        rawMarkdown: large,
        featureFlags: { fastHtmlRendererEnabled: false },
      }),
    );
    expect(profile).toBe("fast-html");
  });

  it("returns rich-react for large documents when the rollback flag disables default fast rendering", () => {
    const large = "x".repeat(FAST_MARKDOWN_RENDERER_LIMITS.LARGE_MARKDOWN_SIZE_BUDGET_BYTES + 1);
    const profile = resolveFastMarkdownRendererProfile(
      resolveFastMarkdownProfileInputs({
        rawMarkdown: large,
        featureFlags: {
          fastHtmlRendererEnabled: false,
          largeDocumentFastRendererDisabled: true,
        },
      }),
    );
    expect(profile).toBe("rich-react");
  });

  it("returns fast-html for small documents when the fast flag is on", () => {
    const profile = resolveFastMarkdownRendererProfile(
      resolveFastMarkdownProfileInputs({
        rawMarkdown: "small body",
        featureFlags: { fastHtmlRendererEnabled: true },
      }),
    );
    expect(profile).toBe("fast-html");
  });

  it("returns bounded-fast-html for large documents when bounded flag is on", () => {
    const large = "x".repeat(FAST_MARKDOWN_RENDERER_LIMITS.FAST_HTML_SIZE_BUDGET_BYTES + 1);
    const profile = resolveFastMarkdownRendererProfile(
      resolveFastMarkdownProfileInputs({
        rawMarkdown: large,
        featureFlags: {
          fastHtmlRendererEnabled: true,
          boundedFastHtmlRendererEnabled: true,
        },
      }),
    );
    expect(profile).toBe("bounded-fast-html");
  });

  it("keeps fast-html for large documents below the bounded threshold when bounded flag is off", () => {
    const large = "x".repeat(FAST_MARKDOWN_RENDERER_LIMITS.FAST_HTML_SIZE_BUDGET_BYTES + 1);
    const profile = resolveFastMarkdownRendererProfile(
      resolveFastMarkdownProfileInputs({
        rawMarkdown: large,
        featureFlags: {
          fastHtmlRendererEnabled: true,
          boundedFastHtmlRendererEnabled: false,
          largeDocumentFastRendererDisabled: true,
        },
      }),
    );
    expect(profile).toBe("fast-html");
  });

  it("forces fast-html when fastHtmlOnly override is set, regardless of flags", () => {
    const profile = resolveFastMarkdownRendererProfile(
      resolveFastMarkdownProfileInputs({
        rawMarkdown: "tiny",
        featureFlags: { fastHtmlRendererEnabled: false },
        fastHtmlOnly: true,
      }),
    );
    expect(profile).toBe("fast-html");
  });

  it("is deterministic — same inputs always produce the same profile", () => {
    const args = {
      rawMarkdown: "abc",
      featureFlags: { fastHtmlRendererEnabled: true } as const,
    };
    const a = resolveFastMarkdownRendererProfile(resolveFastMarkdownProfileInputs(args));
    const b = resolveFastMarkdownRendererProfile(resolveFastMarkdownProfileInputs(args));
    expect(a).toBe(b);
  });
});
