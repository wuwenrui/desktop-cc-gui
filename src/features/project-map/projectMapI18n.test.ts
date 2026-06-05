import { describe, expect, it } from "vitest";

import en from "../../i18n/locales/en";
import zh from "../../i18n/locales/zh";

const GENERATED_NODE_KIND_KEYS = [
  "interface",
  "record",
  "runtime",
  "tech-stack",
  "cross-cutting",
];

const SOURCE_TYPE_KEYS = [
  "file",
  "symbol",
  "spec",
  "task",
  "document",
  "commit",
  "test",
  "conversation",
];

function readLocalePath(locale: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((current, segment) => {
    if (!current || typeof current !== "object") {
      return undefined;
    }
    return (current as Record<string, unknown>)[segment];
  }, locale);
}

describe("project map i18n coverage", () => {
  it("covers AI-generated node kinds in zh-CN and en-US", () => {
    const missing = GENERATED_NODE_KIND_KEYS.flatMap((nodeKind) => {
      const key = `projectMap.nodeKind.${nodeKind}`;
      return [zh, en].some((locale) => {
        const value = readLocalePath(locale as Record<string, unknown>, key);
        return typeof value !== "string" || value.trim().length === 0;
      })
        ? [key]
        : [];
    });

    expect(missing).toEqual([]);
  });

  it("covers visible source type labels in zh-CN and en-US", () => {
    const missing = SOURCE_TYPE_KEYS.flatMap((sourceType) => {
      const key = `projectMap.sourceType.${sourceType}`;
      return [zh, en].some((locale) => {
        const value = readLocalePath(locale as Record<string, unknown>, key);
        return typeof value !== "string" || value.trim().length === 0;
      })
        ? [key]
        : [];
    });

    expect(missing).toEqual([]);
  });
});
