import { describe, expect, it } from "vitest";
import {
  analyzeStreamingMarkdownComplexity,
  EMPTY_STREAMING_MARKDOWN_COMPLEXITY,
  resolveAssistantMessageStreamingThrottleMs,
  resolveReasoningStreamingThrottleMs,
} from "./messagesStreamingComplexity";

const assistantMessage = {
  id: "assistant-1",
  kind: "message" as const,
  role: "assistant" as const,
  text: "",
};

describe("messagesStreamingComplexity", () => {
  it("returns the empty complexity singleton for blank text", () => {
    expect(analyzeStreamingMarkdownComplexity(" \n\t ")).toBe(
      EMPTY_STREAMING_MARKDOWN_COMPLEXITY,
    );
  });

  it("classifies structured markdown before the huge threshold", () => {
    const complexity = analyzeStreamingMarkdownComplexity([
      "### 总览",
      "### 设计",
      "### 验证",
      "- 第一条",
      "- 第二条",
      "- 第三条",
      "- 第四条",
      "- 第五条",
      "- 第六条",
      "```ts",
      "const value = 1;",
      "```",
    ].join("\n"));

    expect(complexity.isStructuredHeavy).toBe(true);
    expect(complexity.isLarge).toBe(true);
    expect(complexity.isHuge).toBe(false);
  });

  it("resolves staged Codex throttle from complexity", () => {
    const complexity = analyzeStreamingMarkdownComplexity(
      Array.from({ length: 14 }, (_, index) => `- 第 ${index + 1} 条结论`).join("\n"),
    );

    expect(resolveAssistantMessageStreamingThrottleMs(
      assistantMessage,
      true,
      "codex",
      null,
      null,
      complexity,
    )).toBe(160);
  });

  it("lets mitigation profile override assistant and reasoning throttles", () => {
    const complexity = analyzeStreamingMarkdownComplexity("short output");
    const mitigationProfile = {
      id: "claude-qwen-windows-render-safe" as const,
      messageStreamingThrottleMs: 120,
      reasoningStreamingThrottleMs: 260,
    };

    expect(resolveAssistantMessageStreamingThrottleMs(
      assistantMessage,
      true,
      "claude",
      mitigationProfile,
      null,
      complexity,
    )).toBe(120);
    expect(resolveReasoningStreamingThrottleMs(true, mitigationProfile, null)).toBe(260);
  });

  it("keeps completed markdown on history-safe throttle", () => {
    const complexity = analyzeStreamingMarkdownComplexity("# completed");

    expect(resolveAssistantMessageStreamingThrottleMs(
      assistantMessage,
      false,
      "codex",
      null,
      null,
      complexity,
    )).toBe(80);
    expect(resolveReasoningStreamingThrottleMs(false, null, null)).toBe(80);
  });
});

import { analyzeStreamingMarkdownComplexityDelta } from "./messagesStreamingComplexity";

describe("analyzeStreamingMarkdownComplexityDelta", () => {
  it("returns prev when delta is empty or whitespace-only", () => {
    const full = analyzeStreamingMarkdownComplexity("hello\n- one");
    expect(analyzeStreamingMarkdownComplexityDelta(full, "hello\n- one", "")).toBe(full);
    expect(analyzeStreamingMarkdownComplexityDelta(full, "hello\n- one", "   \n\n")).toBe(full);
  });

  it("classifies medium size when delta crosses the length threshold (length-jump branch)", () => {
    const base = analyzeStreamingMarkdownComplexity("Hello world");
    const next = analyzeStreamingMarkdownComplexityDelta(
      base,
      "Hello world",
      " ".repeat(260) + "this pushes the text past the medium minimum",
    );
    expect(next.isMedium).toBe(true);
    expect(next.isLarge).toBe(false);
    expect(next.isHuge).toBe(false);
  });

  it("matches the full scan when delta continues the previous line", () => {
    const prevText = "hello";
    const deltaText = " world";
    const base = analyzeStreamingMarkdownComplexity(prevText);
    const next = analyzeStreamingMarkdownComplexityDelta(base, prevText, deltaText);
    expect(next).toEqual(analyzeStreamingMarkdownComplexity(prevText + deltaText));
  });

  it("matches the full scan when delta starts on a new line", () => {
    const prevText = "intro";
    const deltaText = "\n## section\n- item";
    const base = analyzeStreamingMarkdownComplexity(prevText);
    const next = analyzeStreamingMarkdownComplexityDelta(base, prevText, deltaText);
    expect(next).toEqual(analyzeStreamingMarkdownComplexity(prevText + deltaText));
  });

  it("counts headings appended on top of an existing list-heavy stream", () => {
    const base = analyzeStreamingMarkdownComplexity([
      "- one",
      "- two",
      "- three",
      "- four",
      "- five",
      "- six",
    ].join("\n"));
    const next = analyzeStreamingMarkdownComplexityDelta(
      base,
      base.trimmedText,
      "\n## new section\n### sub a\n### sub b\n",
    );
    expect(next.headingCount).toBe(base.headingCount + 3);
    expect(next.isStructuredHeavy).toBe(true);
  });

  it("tracks fenced code block entries that span the prev/delta boundary", () => {
    const base = analyzeStreamingMarkdownComplexity("intro paragraph\n");
    const next = analyzeStreamingMarkdownComplexityDelta(
      base,
      "intro paragraph\n",
      "```ts\nconst x = 1;\nconst y = 2;\n```\n",
    );
    expect(next.fencedCodeBlockCount).toBe(1);
    expect(next.fencedCodeLineCount).toBe(2);
    // close of fence toggles insideCodeFence back to false, so the next
    // appended paragraph should not be classified as a code line
    const after = analyzeStreamingMarkdownComplexityDelta(
      next,
      next.trimmedText,
      "\nplain text after fence",
    );
    expect(after.fencedCodeLineCount).toBe(next.fencedCodeLineCount);
    expect(after.trimmedText.endsWith("plain text after fence")).toBe(true);
  });

  it("handles non-ASCII Chinese streaming text without breaking counts", () => {
    const base = analyzeStreamingMarkdownComplexity("第 1 行\n第 2 行\n");
    const next = analyzeStreamingMarkdownComplexityDelta(
      base,
      "第 1 行\n第 2 行\n",
      "第 3 行结论\n第 4 行结论\n",
    );
    expect(next.lineCount).toBeGreaterThan(base.lineCount);
    expect(next.trimmedText).toContain("第 3 行结论");
  });
});
