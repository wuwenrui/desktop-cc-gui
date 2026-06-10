import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { compileFastMarkdown } from "../compile";
import {
  clearFastMarkdownRenderCache,
  getFastMarkdownRenderCacheSize,
} from "../cache";
import {
  CHINESE_HEADINGS_FIXTURE,
  COMBINED_FIXTURE,
  DISPLAY_MATH_FIXTURE,
  DUPLICATE_HEADINGS_FIXTURE,
  MERMAID_FIXTURE,
  NESTED_LIST_FIXTURE,
  SIMPLE_HEADING_PARAGRAPH,
  TABLE_FIXTURE,
  TASK_LIST_FIXTURE,
  XSS_INLINE_EVENT_FIXTURE,
  XSS_LINKS_FIXTURE,
} from "./fixtures";

beforeEach(() => {
  clearFastMarkdownRenderCache();
});

afterEach(() => {
  clearFastMarkdownRenderCache();
});

describe("compileFastMarkdown", () => {
  it("produces a deterministic result for the simple fixture", async () => {
    const result = await compileFastMarkdown({
      documentKey: "doc-simple",
      rawMarkdown: SIMPLE_HEADING_PARAGRAPH,
      rendererProfile: "fast-html",
    });

    expect(result.rendererProfile).toBe("fast-html");
    expect(result.diagnostics.fallbackReason).toBe("none");
    expect(result.diagnostics.profile).toBe("fast-html");
    expect(result.diagnostics.featureFlagApplied).toBe(false);
    expect(result.outline).toHaveLength(2);
    expect(result.outline[0].title).toBe("Title");
    expect(result.outline[0].anchor).toBe("title");
    expect(result.html).toContain("<h1");
    expect(result.html).toContain("<h2");
    expect(result.html).toContain("<strong>");
    expect(result.html).toContain("<em>");
    expect(result.html).toContain("https://example.com");
  });

  it("renders tables as <table> elements", async () => {
    const result = await compileFastMarkdown({
      documentKey: "doc-table",
      rawMarkdown: TABLE_FIXTURE,
      rendererProfile: "fast-html",
    });
    expect(result.html).toContain("<table");
    expect(result.html).toContain("<thead");
    expect(result.html).toContain("<tbody");
    expect(result.heavyBlocks.find((b) => b.kind === "table")).toBeDefined();
  });

  it("renders nested lists with <ul>/<li>", async () => {
    const result = await compileFastMarkdown({
      documentKey: "doc-nested-list",
      rawMarkdown: NESTED_LIST_FIXTURE,
      rendererProfile: "fast-html",
    });
    expect(result.html).toContain("<ul");
    expect(result.html).toContain("<li");
  });

  it("renders GitHub-flavored task lists while stripping <input> per sanitizer policy", async () => {
    const result = await compileFastMarkdown({
      documentKey: "doc-task-list",
      rawMarkdown: TASK_LIST_FIXTURE,
      rendererProfile: "fast-html",
    });
    // Sanitizer policy disallows <input> for the file-preview surface;
    // task list text is preserved with the GFM class marker.
    expect(result.html).toContain("task-list-item");
    expect(result.html).toContain("contains-task-list");
    expect(result.html).not.toMatch(/<input/);
    expect(result.html).toContain("done item");
    expect(result.html).toContain("todo item");
  });

  it("classifies mermaid code fences as heavy blocks and emits <pre><code>", async () => {
    const result = await compileFastMarkdown({
      documentKey: "doc-mermaid",
      rawMarkdown: MERMAID_FIXTURE,
      rendererProfile: "fast-html",
    });
    const mermaidBlock = result.heavyBlocks.find((b) => b.kind === "mermaid");
    expect(mermaidBlock).toBeDefined();
    expect(result.html).toContain("<pre");
    expect(result.html).toContain("<code");
  });

  it("captures KaTeX display math", async () => {
    const result = await compileFastMarkdown({
      documentKey: "doc-math",
      rawMarkdown: DISPLAY_MATH_FIXTURE,
      rendererProfile: "fast-html",
    });
    const mathBlock = result.heavyBlocks.find((b) => b.kind === "math");
    expect(mathBlock).toBeDefined();
    // rehype-katex emits elements like .katex or <span class="katex">
    expect(result.html).toMatch(/katex/);
  });

  it("attaches data-source-line-start / data-source-line-end to block elements", async () => {
    const result = await compileFastMarkdown({
      documentKey: "doc-attrs",
      rawMarkdown: SIMPLE_HEADING_PARAGRAPH,
      rendererProfile: "fast-html",
    });
    expect(result.html).toMatch(/data-source-line-start/);
    expect(result.html).toMatch(/data-source-line-end/);
    expect(result.html).toMatch(/data-source-block-id/);
    expect(result.sourceLineAnchors.length).toBeGreaterThan(0);
  });

  it("preserves Chinese heading titles in outline", async () => {
    const result = await compileFastMarkdown({
      documentKey: "doc-chinese",
      rawMarkdown: CHINESE_HEADINGS_FIXTURE,
      rendererProfile: "fast-html",
    });
    expect(result.outline.map((entry) => entry.title)).toEqual([
      "项目概览",
      "安装与配置",
      "依赖说明",
      "快速开始",
    ]);
  });

  it("disambiguates duplicate headings with stable anchors", async () => {
    const result = await compileFastMarkdown({
      documentKey: "doc-dup",
      rawMarkdown: DUPLICATE_HEADINGS_FIXTURE,
      rendererProfile: "fast-html",
    });
    const anchors = result.outline.map((entry) => entry.anchor);
    expect(anchors).toEqual(["intro", "intro-1", "intro-2"]);
    expect(new Set(anchors).size).toBe(anchors.length);
  });

  it("XSS regression: javascript: links are stripped from the HTML output", async () => {
    const result = await compileFastMarkdown({
      documentKey: "doc-xss-links",
      rawMarkdown: XSS_LINKS_FIXTURE,
      rendererProfile: "fast-html",
    });
    expect(result.html.toLowerCase()).not.toMatch(/javascript:/);
    expect(result.html).toContain("https://example.com");
  });

  it("XSS regression: inline event handler attributes are stripped", async () => {
    const result = await compileFastMarkdown({
      documentKey: "doc-xss-events",
      rawMarkdown: XSS_INLINE_EVENT_FIXTURE,
      rendererProfile: "fast-html",
    });
    expect(result.html.toLowerCase()).not.toMatch(/onclick/);
    expect(result.html.toLowerCase()).not.toMatch(/onerror/);
  });

  it("XSS regression: script tags do not survive in the rendered HTML", async () => {
    const result = await compileFastMarkdown({
      documentKey: "doc-xss-script",
      rawMarkdown: ["# title", "", "<script>alert(1)</script>", "", "paragraph"].join("\n"),
      rendererProfile: "fast-html",
    });
    expect(result.html.toLowerCase()).not.toContain("<script");
  });

  it("caches the result by cache key and returns the same content on second call", async () => {
    const first = await compileFastMarkdown({
      documentKey: "doc-cache",
      rawMarkdown: COMBINED_FIXTURE,
      rendererProfile: "fast-html",
    });
    expect(getFastMarkdownRenderCacheSize()).toBe(1);

    const second = await compileFastMarkdown({
      documentKey: "doc-cache",
      rawMarkdown: COMBINED_FIXTURE,
      rendererProfile: "fast-html",
    });

    expect(second.cacheKey).toBe(first.cacheKey);
    expect(second.html).toBe(first.html);
    // Cache size unchanged — LRU did not evict the only entry.
    expect(getFastMarkdownRenderCacheSize()).toBe(1);
  });

  it("uses different cache keys for different profiles on the same content", async () => {
    const fast = await compileFastMarkdown({
      documentKey: "doc-profile",
      rawMarkdown: COMBINED_FIXTURE,
      rendererProfile: "fast-html",
    });
    const bounded = await compileFastMarkdown({
      documentKey: "doc-profile",
      rawMarkdown: COMBINED_FIXTURE,
      rendererProfile: "bounded-fast-html",
      options: { lineLimit: 50 },
    });
    expect(fast.cacheKey).not.toBe(bounded.cacheKey);
  });

  it("bounded profile clamps the input and marks diagnostics as truncated", async () => {
    const lines = ["# top"];
    for (let i = 0; i < 200; i += 1) {
      lines.push(`paragraph line ${i}`);
    }
    lines.push("## tail");
    const markdown = lines.join("\n");

    const result = await compileFastMarkdown({
      documentKey: "doc-bounded",
      rawMarkdown: markdown,
      rendererProfile: "bounded-fast-html",
      options: { lineLimit: 50 },
    });

    expect(result.diagnostics.truncated).toBe(true);
    expect(result.rendererProfile).toBe("bounded-fast-html");
    // The clamped projection should keep the heading but the tail heading
    // may or may not survive depending on line distribution; assert that
    // the parsed source lines <= lineLimit + 1.
    expect(result.diagnostics.totalSourceLines).toBeLessThanOrEqual(51);
  });

  it("returns the same contentHash for identical raw markdown", async () => {
    const a = await compileFastMarkdown({
      documentKey: "doc-hash",
      rawMarkdown: SIMPLE_HEADING_PARAGRAPH,
      rendererProfile: "fast-html",
    });
    const b = await compileFastMarkdown({
      documentKey: "doc-other-key",
      rawMarkdown: SIMPLE_HEADING_PARAGRAPH,
      rendererProfile: "fast-html",
    });
    expect(a.contentHash).toBe(b.contentHash);
    // Different document keys must produce different cache keys.
    expect(a.cacheKey).not.toBe(b.cacheKey);
  });

  it("empty markdown produces a successful but empty result", async () => {
    const result = await compileFastMarkdown({
      documentKey: "doc-empty",
      rawMarkdown: "",
      rendererProfile: "fast-html",
    });
    expect(result.outline).toEqual([]);
    expect(result.heavyBlocks).toEqual([]);
    expect(result.diagnostics.fallbackReason).toBe("none");
  });

  it("diagnostics include compile and sanitize duration, feature flag, profile, and counts", async () => {
    const result = await compileFastMarkdown({
      documentKey: "doc-diagnostics",
      rawMarkdown: COMBINED_FIXTURE,
      rendererProfile: "fast-html",
      featureFlags: { fastHtmlRendererEnabled: true, boundedFastHtmlRendererEnabled: true },
    });
    const d = result.diagnostics;
    expect(d.profile).toBe("fast-html");
    expect(d.contentHash).toBe(result.contentHash);
    expect(d.cacheKey).toBe(result.cacheKey);
    expect(d.compileDurationMs).toBeGreaterThanOrEqual(0);
    expect(d.sanitizeDurationMs).toBeGreaterThanOrEqual(0);
    expect(d.totalSourceLines).toBeGreaterThan(0);
    expect(d.totalHeadings).toBe(result.outline.length);
    expect(d.totalHeavyBlocks).toBe(result.heavyBlocks.length);
    expect(d.fallbackReason).toBe("none");
    expect(d.featureFlagApplied).toBe(true);
  });
});
