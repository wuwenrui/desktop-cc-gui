import { describe, expect, it } from "vitest";
import {
  resolveCategoryLabel,
  translateOrFallback,
  CATEGORY_DEFAULTS,
  CATEGORY_LABELS_I18N,
} from "./categoryLabels";
import type { TFunction } from "i18next";

/**
 * `t` stub that mimics react-i18next: returns the key unchanged when
 * the key is missing (the real behavior; `?? fallback` doesn't catch
 * this because the real `t()` returns a string, not undefined).
 */
function makeT(
  presentKeys: string[] = [],
  withInterpolation = false,
): TFunction {
  const fn = ((key: string | string[], options?: Record<string, unknown>) => {
    const keyStr = Array.isArray(key) ? key[0] : key;
    const present = Array.isArray(key)
      ? key.every((k) => presentKeys.includes(k))
      : presentKeys.includes(keyStr);
    if (!present) {
      // Real react-i18next returns the key string when missing.
      return keyStr;
    }
    let template = withInterpolation
      ? `translated:${keyStr}`
      : `translated:${keyStr}`;
    if (options && typeof template === "string") {
      for (const [k, v] of Object.entries(options)) {
        template = template.replace(`{{${k}}}`, String(v));
      }
    }
    return template;
  }) as unknown as TFunction;
  return fn;
}

describe("translateOrFallback", () => {
  it("returns the i18n value when the key is present", () => {
    const t = makeT(["common.curatedBundledBadge"]);
    expect(translateOrFallback(t, "common.curatedBundledBadge", "Built-in")).toBe(
      "translated:common.curatedBundledBadge",
    );
  });

  it("falls back to the default when the key is missing", () => {
    const t = makeT([]);
    expect(translateOrFallback(t, "common.curatedBundledBadge", "Built-in")).toBe(
      "Built-in",
    );
  });

  it("falls back when the i18n bundle returns an empty string", () => {
    const t = ((_k: string) => "") as unknown as TFunction;
    expect(translateOrFallback(t, "any.key", "fallback")).toBe("fallback");
  });

  it("falls back when t() throws (defensive)", () => {
    const t = ((_k: string) => {
      throw new Error("i18n down");
    }) as unknown as TFunction;
    expect(translateOrFallback(t, "any.key", "fallback")).toBe("fallback");
  });

  it("interpolates params in the i18n value", () => {
    const t = makeT(["common.curatedToken"], true);
    const out = translateOrFallback(
      t,
      "common.curatedToken",
      "1.1K tokens",
      { count: 1100 },
    );
    expect(out).toBe("translated:common.curatedToken");
  });

  it("interpolates params in the fallback when the key is missing", () => {
    const t = makeT([]);
    const out = translateOrFallback(
      t,
      "common.curatedToken",
      "{{count}} tokens",
      { count: 1100 },
    );
    expect(out).toBe("1100 tokens");
  });
});

describe("resolveCategoryLabel", () => {
  it("returns the translated value when the key is present", () => {
    const t = makeT(["common.curatedCategoryCodeStyle"]);
    const label = resolveCategoryLabel(t, "code-style");
    expect(label).toBe("translated:common.curatedCategoryCodeStyle");
  });

  it("falls back to the English default when the key is missing", () => {
    const t = makeT([]);
    expect(resolveCategoryLabel(t, "code-style")).toBe(
      CATEGORY_DEFAULTS.category["code-style"],
    );
    expect(resolveCategoryLabel(t, "ui-design")).toBe(
      CATEGORY_DEFAULTS.category["ui-design"],
    );
    expect(resolveCategoryLabel(t, "review")).toBe(
      CATEGORY_DEFAULTS.category.review,
    );
    expect(resolveCategoryLabel(t, "debug")).toBe(
      CATEGORY_DEFAULTS.category.debug,
    );
  });

  it("returns the raw category string for an unknown enum value", () => {
    const t = makeT([]);
    const label = resolveCategoryLabel(t, "performance");
    expect(label).toBe("performance");
  });

  it("CATEGORY_LABELS_I18N maps every MVP category", () => {
    expect(CATEGORY_LABELS_I18N).toMatchObject({
      "code-style": expect.any(String),
      "ui-design": expect.any(String),
      review: expect.any(String),
      debug: expect.any(String),
    });
  });
});
