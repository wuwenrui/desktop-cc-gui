import { describe, expect, it } from "vitest";
import { classifyMessageMarkdownHeavyIslands } from "./messageMarkdownHeavyIslands";
import { classifyMessageMarkdownPrecomputeThreshold } from "./messageMarkdownPrecompute";

describe("message markdown heavy islands", () => {
  it("classifies heavy Markdown categories for conversation rendering", () => {
    const markdown = [
      "| file | lines | status |",
      "| --- | ---: | --- |",
      "| a.ts | 12 | read |",
      "| b.ts | 13 | read |",
      "| c.ts | 14 | read |",
      "| d.ts | 15 | read |",
      "```ts",
      "const value = true;",
      "```",
      "```markdown",
      "```ts",
      "nested",
      "```",
      "```",
      "```mermaid",
      "flowchart TD",
      "```",
      "$$x = y + z$$",
      "<tool_call name=\"read_file\"><path>SECRET.md</path></tool_call>",
    ].join("\n");

    const summary = classifyMessageMarkdownHeavyIslands(markdown);

    expect(summary.categoryCounts.table).toBe(1);
    expect(summary.categoryCounts["code-block"]).toBeGreaterThan(0);
    expect(summary.categoryCounts["nested-markdown-fence"]).toBe(1);
    expect(summary.categoryCounts.mermaid).toBe(1);
    expect(summary.categoryCounts.math).toBe(1);
    expect(summary.categoryCounts["tool-call-xml"]).toBe(1);
    expect(summary.totalHeavyIslands).toBeGreaterThanOrEqual(6);
  });

  it("does not record raw Markdown content in classifier output", () => {
    const summary = classifyMessageMarkdownHeavyIslands([
      "<tool_call name=\"read_file\"><path>SECRET_SHOULD_NOT_LEAK.md</path></tool_call>",
      "```ts",
      "const password = 'SECRET_SHOULD_NOT_LEAK';",
      "```",
    ].join("\n"));
    const serializedSummary = JSON.stringify(summary);

    expect(serializedSummary).not.toContain("SECRET_SHOULD_NOT_LEAK");
    expect(serializedSummary).not.toContain("read_file");
  });

  it("routes complex Markdown into precompute without requiring large length", () => {
    expect(classifyMessageMarkdownPrecomputeThreshold("| a | b |\n| - | - |\n| 1 | 2 |")).toBe(
      "below-threshold",
    );
    expect(classifyMessageMarkdownPrecomputeThreshold([
      "| a | b |",
      "| - | - |",
      "| 1 | 2 |",
      "| 3 | 4 |",
      "| 5 | 6 |",
      "| 7 | 8 |",
    ].join("\n"))).toBe("complexity");
    expect(classifyMessageMarkdownPrecomputeThreshold("```mermaid\nflowchart TD\n```")).toBe(
      "complexity",
    );
  });
});
