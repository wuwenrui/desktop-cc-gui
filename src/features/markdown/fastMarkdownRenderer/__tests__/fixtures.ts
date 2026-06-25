/**
 * Shared Markdown fixtures for the fast renderer test suite.
 *
 * Every fixture is a deterministic string that exercises a specific
 * branch of the parser, sanitizer, or outline extraction logic. Keep
 * additions surgical — add a new constant per scenario rather than
 * mutating shared text, so individual tests stay isolated.
 */

export const SIMPLE_HEADING_PARAGRAPH = [
  "# Title",
  "",
  "first paragraph with **bold** and *italic* text.",
  "",
  "## Subsection",
  "",
  "second paragraph with `inline code` and a [link](https://example.com).",
  "",
].join("\n");

export const TABLE_FIXTURE = [
  "| col1 | col2 | col3 |",
  "| ---- | ---- | ---- |",
  "| a1   | a2   | a3   |",
  "| b1   | b2   | b3   |",
  "",
  "after table paragraph",
  "",
].join("\n");

export const NESTED_LIST_FIXTURE = [
  "- outer one",
  "  - inner one",
  "    - deeper one",
  "- outer two",
  "  - inner two",
  "",
].join("\n");

export const TASK_LIST_FIXTURE = [
  "- [x] done item",
  "- [ ] todo item",
  "- [x] another done",
  "",
].join("\n");

export const CODE_BLOCK_FIXTURE = [
  "```ts",
  "export const greeting = (name: string) => `hi ${name}`;",
  "```",
  "",
].join("\n");

export const MERMAID_FIXTURE = [
  "```mermaid",
  "graph TD",
  "  A[Start] --> B{Decision}",
  "  B -->|yes| C[OK]",
  "  B -->|no| D[Cancel]",
  "```",
  "",
].join("\n");

export const INLINE_MATH_FIXTURE = [
  "Einstein's relation $E = mc^2$ is the headline.",
  "",
].join("\n");

export const DISPLAY_MATH_FIXTURE = [
  "$$",
  "\\int_{0}^{\\infty} e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}",
  "$$",
  "",
].join("\n");

export const RAW_HTML_FIXTURE = [
  "<div class=\"callout\">",
  "",
  "raw html block",
  "",
  "</div>",
  "",
  "paragraph with <span>nested</span> tag.",
  "",
].join("\n");

/**
 * Source intentionally contains a `javascript:` link and an
 * `onclick` event handler. The compiler MUST strip both; the
 * remaining text is preserved.
 */
export const XSS_LINKS_FIXTURE = [
  "[click me](javascript:alert(1))",
  "",
  "[safe link](https://example.com)",
  "",
].join("\n");

export const XSS_INLINE_EVENT_FIXTURE = [
  "<span onclick=\"alert('xss')\">hover me</span>",
  "",
  '<a href="https://example.com" onerror="alert(1)">safe anchor</a>',
  "",
].join("\n");

export const DUPLICATE_HEADINGS_FIXTURE = [
  "## Intro",
  "",
  "first intro paragraph",
  "",
  "## Intro",
  "",
  "second intro paragraph",
  "",
  "## intro",
  "",
  "third intro paragraph (case variant)",
  "",
].join("\n");

export const CHINESE_HEADINGS_FIXTURE = [
  "# 项目概览",
  "",
  "## 安装与配置",
  "",
  "### 依赖说明",
  "",
  "## 快速开始",
  "",
].join("\n");

export const BLOCKQUOTE_HR_FIXTURE = [
  "> block quote line one",
  "> block quote line two",
  "",
  "---",
  "",
  "after hr",
  "",
].join("\n");

export const IMAGE_FIXTURE = [
  "![alt text](https://example.com/image.png)",
  "",
  "![local](./relative.png)",
  "",
].join("\n");

export function createSyntheticLongMarkdownFixture(lineCount = 6_200): string {
  const lines: string[] = [
    "# Synthetic Long Markdown",
    "",
    "Opening paragraph used by renderer profile tests.",
    "",
    "![remote](https://example.com/remote.png)",
    "",
    "| Segment | Value | Delta | Owner | Status | Notes |",
    "| --- | ---: | ---: | --- | --- | --- |",
  ];

  for (let index = 0; index < 36; index += 1) {
    lines.push(
      `| row-${index} | ${index} | ${index % 7} | team-${index % 5} | active | wide table cell ${index} |`,
    );
  }

  lines.push(
    "",
    "```ts",
    "export function syntheticFixture(value: number) {",
    "  return value * 2;",
    "}",
    "```",
    "",
    "```mermaid",
    "graph TD",
    "  A[Start] --> B[Profile]",
    "  B --> C[Annotation]",
    "```",
    "",
  );

  let sectionIndex = 0;
  while (lines.length < lineCount) {
    sectionIndex += 1;
    lines.push(
      `## Section ${sectionIndex}`,
      "",
      `Paragraph ${sectionIndex} with annotation target text and enough content for source-line anchors.`,
      "",
      "- outer item",
      "  - nested item",
      "",
      `Annotation target ${sectionIndex}`,
      "",
    );
  }

  return lines.slice(0, lineCount).join("\n");
}

/**
 * Combined fixture that exercises the parser, outline, heavy
 * block extraction, sanitizer, and source-line anchor walker in a
 * single pass. Used to assert full-pipeline invariants.
 */
export const COMBINED_FIXTURE = [
  "# Project Overview",
  "",
  "Welcome to **project**. The renderer must surface the outline below:",
  "",
  "## Goals",
  "",
  "1. fast path",
  "2. fail-closed fallback",
  "3. stable source-line anchors",
  "",
  "## Architecture",
  "",
  "### Compile pipeline",
  "",
  "```ts",
  "const compiled = compileFastMarkdown({",
  "  documentKey: 'doc-1',",
  "  rawMarkdown: '# heading',",
  "  rendererProfile: 'fast-html',",
  "});",
  "```",
  "",
  "### Outline",
  "",
  "- first list item",
  "- second list item",
  "  - nested",
  "",
  "## Tables",
  "",
  "| a | b |",
  "| - | - |",
  "| 1 | 2 |",
  "",
  "## Math",
  "",
  "Inline $E = mc^2$ and display:",
  "",
  "$$",
  "\\frac{1}{2}",
  "$$",
  "",
  "## Diagram",
  "",
  "```mermaid",
  "graph LR",
  "  A --> B",
  "```",
  "",
].join("\n");
