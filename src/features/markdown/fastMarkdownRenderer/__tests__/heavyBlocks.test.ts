import { describe, expect, it } from "vitest";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import {
  CODE_BLOCK_FIXTURE,
  COMBINED_FIXTURE,
  DISPLAY_MATH_FIXTURE,
  INLINE_MATH_FIXTURE,
  MERMAID_FIXTURE,
  RAW_HTML_FIXTURE,
  TABLE_FIXTURE,
} from "./fixtures";
import { extractHeavyBlocks } from "../heavyBlocks";

function parseMarkdown(markdown: string) {
  return unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkMath)
    .parse(markdown);
}

describe("extractHeavyBlocks", () => {
  it("classifies mermaid and math code fences by language", () => {
    const root = parseMarkdown(`${MERMAID_FIXTURE}\n${DISPLAY_MATH_FIXTURE}\n`);
    const blocks = extractHeavyBlocks(root, 1);

    const mermaid = blocks.find((block) => block.kind === "mermaid");
    const math = blocks.find((block) => block.kind === "math");
    expect(mermaid).toBeDefined();
    expect(mermaid?.language).toBe("mermaid");
    expect(math).toBeDefined();
    expect(math?.language).toBeNull();
  });

  it("labels non-mermaid/non-math code fences as code-block", () => {
    const root = parseMarkdown(CODE_BLOCK_FIXTURE);
    const blocks = extractHeavyBlocks(root, 1);

    expect(blocks).toHaveLength(1);
    expect(blocks[0].kind).toBe("code-block");
    expect(blocks[0].language).toBe("ts");
    expect(blocks[0].contentHash).toMatch(/^[a-z0-9]+$/);
  });

  it("captures inline math as heavy math blocks", () => {
    const root = parseMarkdown(INLINE_MATH_FIXTURE);
    const blocks = extractHeavyBlocks(root, 1);

    expect(blocks).toHaveLength(1);
    expect(blocks[0].kind).toBe("math");
    expect(blocks[0].startLine).toBe(1);
  });

  it("captures tables as heavy table blocks with deterministic ids", () => {
    const root = parseMarkdown(TABLE_FIXTURE);
    const firstPass = extractHeavyBlocks(root, 1);
    const secondPass = extractHeavyBlocks(root, 1);

    expect(firstPass).toHaveLength(1);
    expect(firstPass[0].kind).toBe("table");
    expect(firstPass[0].blockId).toBe(secondPass[0].blockId);
  });

  it("captures raw HTML blocks as html-raw heavy blocks", () => {
    const root = parseMarkdown(RAW_HTML_FIXTURE);
    const blocks = extractHeavyBlocks(root, 1);

    const rawHtml = blocks.find((block) => block.kind === "html-raw");
    expect(rawHtml).toBeDefined();
    expect(rawHtml?.contentHash).toMatch(/^[a-z0-9]+$/);
  });

  it("walks nested children of the combined fixture", () => {
    const root = parseMarkdown(COMBINED_FIXTURE);
    const blocks = extractHeavyBlocks(root, 1);

    const kinds = blocks.map((block) => block.kind).sort();
    // Combined fixture has ts code fence, mermaid fence, and display math.
    expect(kinds).toEqual(expect.arrayContaining(["code-block", "mermaid", "math"]));
    // Each block has stable start/end lines within the body.
    for (const block of blocks) {
      expect(block.endLine).toBeGreaterThanOrEqual(block.startLine);
    }
  });

  it("uses bodyStartLine to project line numbers for embedded fragments", () => {
    const root = parseMarkdown(CODE_BLOCK_FIXTURE);
    const blocks = extractHeavyBlocks(root, 100);

    expect(blocks[0].startLine).toBeGreaterThanOrEqual(100);
    expect(blocks[0].endLine).toBeGreaterThanOrEqual(blocks[0].startLine);
  });
});
