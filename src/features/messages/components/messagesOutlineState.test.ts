import { describe, expect, it } from "vitest";
import type { MarkdownOutlineEntry } from "../../markdown/fastMarkdownRenderer";
import {
  areMarkdownOutlinesEqual,
  resolveNextMessageOutlineSnapshot,
} from "./messagesOutlineState";

function heading(
  overrides: Partial<MarkdownOutlineEntry> = {},
): MarkdownOutlineEntry {
  return {
    id: "intro",
    anchor: "intro",
    title: "Intro",
    depth: 1,
    startLine: 1,
    endLine: 1,
    ordinal: 1,
    ...overrides,
  };
}

describe("messages outline state", () => {
  it("treats semantically equal outline entries as equal", () => {
    expect(areMarkdownOutlinesEqual([heading()], [heading()])).toBe(true);
  });

  it("detects heading content changes", () => {
    expect(
      areMarkdownOutlinesEqual([heading()], [heading({ title: "Final" })]),
    ).toBe(false);
  });

  it("preserves the previous snapshot for repeated same-message outline payloads", () => {
    const previous = {
      messageId: "assistant-1",
      outline: [heading()],
    };
    const next = {
      messageId: "assistant-1",
      outline: [heading()],
    };

    expect(resolveNextMessageOutlineSnapshot(previous, next)).toBe(previous);
  });

  it("updates when the same message reports a changed outline", () => {
    const previous = {
      messageId: "assistant-1",
      outline: [heading()],
    };
    const next = {
      messageId: "assistant-1",
      outline: [heading({ title: "Final" })],
    };

    expect(resolveNextMessageOutlineSnapshot(previous, next)).toBe(next);
  });

  it("updates when a different message reports the same outline", () => {
    const previous = {
      messageId: "assistant-1",
      outline: [heading()],
    };
    const next = {
      messageId: "assistant-2",
      outline: [heading()],
    };

    expect(resolveNextMessageOutlineSnapshot(previous, next)).toBe(next);
  });
});
