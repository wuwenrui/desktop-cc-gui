import { describe, expect, it } from "vitest";
import type { ThreadSummary } from "../../../types";
import {
  isWeakSessionDisplayTitle,
  mergeSessionDisplaySummary,
  projectSessionDisplaySummaries,
} from "./sessionDisplayProjection";

describe("sessionDisplayProjection", () => {
  it("classifies ordinal agent and generic session names as weak titles", () => {
    expect(isWeakSessionDisplayTitle("Agent 202")).toBe(true);
    expect(isWeakSessionDisplayTitle("Claude Session")).toBe(true);
    expect(isWeakSessionDisplayTitle("分析左侧栏消失问题")).toBe(false);
  });

  it("keeps a meaningful title when a later candidate only has Agent N", () => {
    const previous: ThreadSummary = {
      id: "claude:session-1",
      name: "分析左侧栏消失问题",
      updatedAt: 100,
      engineSource: "claude",
      threadKind: "native",
    };
    const next: ThreadSummary = {
      id: "claude:session-1",
      name: "Agent 202",
      updatedAt: 120,
      engineSource: "claude",
      threadKind: "native",
    };

    expect(mergeSessionDisplaySummary(previous, next).name).toBe("分析左侧栏消失问题");
  });

  it("does not downgrade a generic session fallback to ordinal Agent title", () => {
    const previous: ThreadSummary = {
      id: "claude:session-1",
      name: "Claude Session",
      updatedAt: 100,
      engineSource: "claude",
      threadKind: "native",
    };
    const next: ThreadSummary = {
      id: "claude:session-1",
      name: "Agent 202",
      updatedAt: 120,
      engineSource: "claude",
      threadKind: "native",
    };

    expect(mergeSessionDisplaySummary(previous, next).name).toBe("Claude Session");
  });

  it("lets custom and mapped titles override weak or meaningful candidates", () => {
    const previous: ThreadSummary = {
      id: "claude:session-1",
      name: "旧标题",
      updatedAt: 100,
      engineSource: "claude",
      threadKind: "native",
    };

    expect(
      mergeSessionDisplaySummary(
        previous,
        { ...previous, name: "新标题", updatedAt: 120 },
        { customTitle: "自定义标题" },
      ).name,
    ).toBe("自定义标题");
    expect(
      mergeSessionDisplaySummary(
        previous,
        { ...previous, name: "新标题", updatedAt: 120 },
        { mappedTitle: "映射标题", customTitle: "自定义标题" },
      ).name,
    ).toBe("映射标题");
  });

  it("projects degraded continuity candidates without resurrecting excluded rows", () => {
    const projected = projectSessionDisplaySummaries({
      baseSummaries: [
        {
          id: "claude:current",
          name: "当前",
          updatedAt: 200,
          engineSource: "claude",
          threadKind: "native",
        },
      ],
      candidateSummaries: [
        {
          id: "claude:hidden",
          name: "隐藏",
          updatedAt: 150,
          engineSource: "claude",
          threadKind: "native",
        },
        {
          id: "claude:last-good",
          name: "上次可见",
          updatedAt: 140,
          engineSource: "claude",
          threadKind: "native",
        },
      ],
      excludedThreadIds: new Set(["claude:hidden"]),
    });

    expect(projected.map((entry) => entry.id)).toEqual([
      "claude:current",
      "claude:last-good",
    ]);
  });
});
