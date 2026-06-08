import { describe, expect, it } from "vitest";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import {
  CHINESE_HEADINGS_FIXTURE,
  COMBINED_FIXTURE,
  DUPLICATE_HEADINGS_FIXTURE,
  SIMPLE_HEADING_PARAGRAPH,
} from "./fixtures";
import { extractMarkdownOutline, slugifyHeadingTitle } from "../parserOutline";

function parseMarkdown(markdown: string) {
  return unified().use(remarkParse).use(remarkGfm).parse(markdown);
}

describe("slugifyHeadingTitle", () => {
  it("lowercases ASCII text and collapses punctuation to dashes", () => {
    expect(slugifyHeadingTitle("Hello, World!")).toBe("hello-world");
  });

  it("preserves CJK characters verbatim", () => {
    expect(slugifyHeadingTitle("项目概览")).toBe("项目概览");
  });

  it("falls back to 'heading' for empty input", () => {
    expect(slugifyHeadingTitle("")).toBe("heading");
  });

  it("falls back to 'heading' when slug becomes empty after stripping", () => {
    expect(slugifyHeadingTitle("!!!")).toBe("heading");
  });

  it("replaces whitespace with single dashes", () => {
    expect(slugifyHeadingTitle("  multiple   spaces  ")).toBe("multiple-spaces");
  });
});

describe("extractMarkdownOutline", () => {
  it("captures simple heading depth, title, and line range", () => {
    const root = parseMarkdown(SIMPLE_HEADING_PARAGRAPH);
    const outline = extractMarkdownOutline(root, 1);

    expect(outline).toHaveLength(2);
    expect(outline[0]).toMatchObject({
      depth: 1,
      title: "Title",
      anchor: "title",
      startLine: 1,
      endLine: 1,
      ordinal: 0,
    });
    expect(outline[1]).toMatchObject({
      depth: 2,
      title: "Subsection",
      anchor: "subsection",
      ordinal: 1,
    });
    expect(outline[0].id).toMatch(/^outline-0-/);
    expect(outline[1].id).toMatch(/^outline-1-/);
  });

  it("produces stable disambiguated anchors for duplicate headings", () => {
    const root = parseMarkdown(DUPLICATE_HEADINGS_FIXTURE);
    const outline = extractMarkdownOutline(root, 1);

    const anchors = outline.map((entry) => entry.anchor);
    expect(anchors).toEqual(["intro", "intro-1", "intro-2"]);
    expect(new Set(anchors).size).toBe(anchors.length);
  });

  it("preserves Chinese heading titles and slugifies them deterministically", () => {
    const root = parseMarkdown(CHINESE_HEADINGS_FIXTURE);
    const outline = extractMarkdownOutline(root, 1);

    expect(outline.map((entry) => entry.title)).toEqual([
      "项目概览",
      "安装与配置",
      "依赖说明",
      "快速开始",
    ]);
    expect(outline[0].anchor).toBe("项目概览");
    expect(outline[1].anchor).toBe("安装与配置");
  });

  it("respects bodyStartLine offset for sub-document fragments", () => {
    const root = parseMarkdown(SIMPLE_HEADING_PARAGRAPH);
    const outline = extractMarkdownOutline(root, 10);

    expect(outline[0].startLine).toBe(10);
    expect(outline[0].endLine).toBe(10);
    expect(outline[1].startLine).toBeGreaterThanOrEqual(11);
  });

  it("walks the combined fixture and yields an outline that matches the heading list", () => {
    const root = parseMarkdown(COMBINED_FIXTURE);
    const outline = extractMarkdownOutline(root, 1);

    const titles = outline.map((entry) => entry.title);
    expect(titles).toContain("Project Overview");
    expect(titles).toContain("Goals");
    expect(titles).toContain("Architecture");
    expect(titles).toContain("Compile pipeline");
    expect(titles).toContain("Tables");
    expect(titles).toContain("Math");
    expect(titles).toContain("Diagram");
    // Depth must always be a valid h1-h6 number.
    for (const entry of outline) {
      expect([1, 2, 3, 4, 5, 6]).toContain(entry.depth);
    }
  });
});
