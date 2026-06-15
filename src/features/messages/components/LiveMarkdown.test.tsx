// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  LightweightMarkdown,
  resolveAdaptiveProgressiveRevealStepMs,
  resolveProgressiveRevealValue,
} from "./LiveMarkdown";

describe("LightweightMarkdown", () => {
  it("keeps stable blocks mounted while append-only streaming extends the tail", () => {
    const initialValue = [
      "### 第一部分",
      "",
      "- 第一条",
      "- 第二条",
      "",
      "尾段还在继续",
    ].join("\n");
    const nextValue = `${initialValue}\n继续补充这一段的后续内容`;

    const { container, rerender } = render(
      <LightweightMarkdown value={initialValue} />,
    );

    const stableHeadingNode = container.querySelector("h3");
    const stableListNode = container.querySelector("ul");

    expect(stableHeadingNode?.textContent).toBe("第一部分");
    expect(stableListNode?.textContent).toContain("第一条");

    rerender(<LightweightMarkdown value={nextValue} />);

    expect(container.querySelector("h3")).toBe(stableHeadingNode);
    expect(container.querySelector("ul")).toBe(stableListNode);
    expect(container.textContent).toContain("继续补充这一段的后续内容");
  });

  it("widens the reveal chunk when a long stream falls behind in the tail", () => {
    const visibleValue = `${"段落内容\n".repeat(900)}`;
    const targetValue = `${visibleValue}${"### 小节\n- 条目\n".repeat(220)}`;

    const nextValue = resolveProgressiveRevealValue(
      visibleValue,
      targetValue,
      360,
    );

    expect(nextValue.length).toBeGreaterThan(visibleValue.length + 720);
    expect(nextValue.length).toBeLessThan(targetValue.length);
  });

  it("relaxes reveal cadence and flushes immediately for extreme tail backlog", () => {
    const visibleValue = `${"段落内容\n".repeat(1_600)}`;
    const targetValue = `${visibleValue}${"### 小节\n- 条目\n".repeat(900)}`;

    expect(
      resolveAdaptiveProgressiveRevealStepMs(
        visibleValue.length,
        targetValue.length - visibleValue.length,
        28,
      ),
    ).toBeGreaterThan(28);
    expect(resolveProgressiveRevealValue(visibleValue, targetValue, 360)).toBe(targetValue);
  });

  it("flushes small pending text without chunking", () => {
    const visibleValue = "已经显示的内容。";
    const targetValue = `${visibleValue}${"补充".repeat(40)}`;

    expect(resolveProgressiveRevealValue(visibleValue, targetValue, 360)).toBe(targetValue);
  });

  it("keeps structural markdown boundaries readable during progressive reveal", () => {
    const visibleValue = "前文\n".repeat(60);
    const pendingPrefix = "正文继续 ".repeat(45);
    const targetValue = [
      visibleValue,
      pendingPrefix,
      "\n### 新标题",
      "标题下正文 ".repeat(80),
    ].join("");

    const nextValue = resolveProgressiveRevealValue(visibleValue, targetValue, 120);

    expect(nextValue.length).toBeGreaterThan(visibleValue.length);
    expect(nextValue.length).toBeLessThan(targetValue.length);
    expect(targetValue.slice(nextValue.length)).toMatch(/^### 新标题/);
  });

  it("keeps long pending reveal partial below the extreme backlog threshold", () => {
    const visibleValue = "已显示段落\n".repeat(80);
    const pendingValue = [
      "第一段内容 ".repeat(160),
      "\n> 引用块\n",
      "第二段内容 ".repeat(160),
      "\n```ts\nconst value = 1;\n```\n",
      "第三段内容 ".repeat(160),
    ].join("");
    const targetValue = `${visibleValue}${pendingValue}`;

    const nextValue = resolveProgressiveRevealValue(visibleValue, targetValue, 360);

    expect(nextValue.length).toBeGreaterThan(visibleValue.length + 360);
    expect(nextValue.length).toBeLessThan(targetValue.length);
  });
});
