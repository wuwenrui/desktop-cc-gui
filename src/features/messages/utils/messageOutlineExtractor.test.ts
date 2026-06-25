import { describe, expect, it } from "vitest";
import { extractOutlineFromMarkdown } from "./messageOutlineExtractor";

describe("extractOutlineFromMarkdown", () => {
  it("extracts ATX headings with stable duplicate anchors", () => {
    expect(extractOutlineFromMarkdown("# Intro\n\n## API\n\n## API")).toEqual([
      {
        id: "intro",
        depth: 1,
        title: "Intro",
        startLine: 1,
        endLine: 1,
        anchor: "intro",
        ordinal: 1,
      },
      {
        id: "api",
        depth: 2,
        title: "API",
        startLine: 3,
        endLine: 3,
        anchor: "api",
        ordinal: 2,
      },
      {
        id: "api-1",
        depth: 2,
        title: "API",
        startLine: 5,
        endLine: 5,
        anchor: "api-1",
        ordinal: 3,
      },
    ]);
  });

  it("ignores heading-looking lines inside fenced code blocks", () => {
    const outline = extractOutlineFromMarkdown("```ts\n# Not a heading\n```\n# Real");

    expect(outline.map((entry) => entry.title)).toEqual(["Real"]);
  });

  it("strips common inline markdown markers from titles", () => {
    const outline = extractOutlineFromMarkdown("## **Bold** and `code`");

    expect(outline[0]?.title).toBe("Bold and code");
    expect(outline[0]?.anchor).toBe("bold-and-code");
  });
});
