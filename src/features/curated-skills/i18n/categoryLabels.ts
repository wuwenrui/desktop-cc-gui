/**
 * i18n helpers for the curated-skill UI (V0.5.14+).
 *
 * The MVP ships a minimal English-only i18n bundle. Each key has an
 * English default in `CATEGORY_DEFAULTS` (or in inline callsites for
 * the section-level strings) so the UI never renders a raw i18n key
 * in production, even when the locale bundle is partial.
 *
 * `t()` from react-i18next returns a string (the key itself) when the
 * key is missing — it does NOT return `undefined`. So the `??`
 * operator alone won't catch the missing case. We compare the
 * returned value to the requested key to detect the missing case.
 *
 * Adding a new category to the enum is a V1.1 follow-up; both this
 * map AND the i18n catalog must move in lock-step.
 */

import type { TFunction } from "i18next";

export type CuratedCategory = "code-style" | "ui-design" | "review" | "debug";

export const CATEGORY_LABELS_I18N: Record<CuratedCategory, string> = {
  "code-style": "common.curatedCategoryCodeStyle",
  "ui-design": "common.curatedCategoryUiDesign",
  review: "common.curatedCategoryReview",
  debug: "common.curatedCategoryDebug",
};

/**
 * English defaults for the curated UI. Used as a last-resort fallback
 * when the i18n bundle is missing the corresponding key.
 */
export const CATEGORY_DEFAULTS = {
  bundledBadge: "Built-in",
  loading: "Loading curated skills…",
  error: "Couldn't load curated skills.",
  subtitle:
    "Client-bundled, version-pinned, shipped with the desktop client. No network.",
  addSkill: "Add curated skill",
  // Composed as "Active: <label>". The "active" wording reflects the
  // always-on semantics: enabling a curated skill in Settings means it
  // is in effect for every conversation, so the chip here is
  // declarative (it doesn't offer an on/off affordance).
  activeLabel: "Active",
  // Trailing summary e.g. "2 skills · 1.1K tokens".
  activeTotal: "{{count}} skills · {{tokens}}",
  // Section title shown in the Settings panel header. "Curated" is a
  // product term (curated = hand-picked, version-pinned, shipped with
  // the client) and is left untranslated in the English default to
  // match the visual on the marketing site; the `curatedSectionTitle`
  // i18n key can override this in other locales.
  sectionTitle: "Curated",
  // Per-row inline link that opens the upstream source repo in the
  // system browser. The URL is encoded on the metadata side
  // (`sourceUrl`), not in the i18n bundle.
  viewOnGithub: "View on GitHub",
  viewOnGithubAria: "Open the upstream source for {{name}} in your browser",
  category: {
    "code-style": "Code style",
    "ui-design": "UI design",
    review: "Review",
    debug: "Debug",
  } satisfies Record<CuratedCategory, string>,
};

/**
 * Translate an i18n key with an English fallback. Returns the
 * fallback when:
 *   - the key is empty,
 *   - the i18n bundle returns the key unchanged (missing translation),
 *   - the i18n bundle returns an empty string,
 *   - the call throws (defensive: never crash the UI for a missing
 *     translation).
 *
 * Interpolates `{{varName}}` placeholders against the params object
 * when present, so the same helper covers both static and dynamic
 * strings (e.g. token count).
 */
export function translateOrFallback(
  t: TFunction,
  key: string,
  fallback: string,
  params?: Record<string, string | number>,
): string {
  if (!key) return interpolate(fallback, params);
  let translated: string;
  try {
    const result = params ? t(key, params) : t(key);
    translated = typeof result === "string" ? result : fallback;
  } catch {
    return interpolate(fallback, params);
  }
  if (!translated || translated === key) {
    return interpolate(fallback, params);
  }
  return interpolate(translated, params);
}

function interpolate(
  template: string,
  params?: Record<string, string | number>,
): string {
  if (!params) return template;
  let out = template;
  for (const [k, v] of Object.entries(params)) {
    out = out.replace(new RegExp(`{{${k}}}`, "g"), String(v));
  }
  return out;
}

/**
 * Resolve the user-facing category label, walking the i18n key first
 * and falling back to the English default. Accepts the loose string
 * union to be future-proof against V1.1's category additions.
 */
export function resolveCategoryLabel(
  t: TFunction,
  category: string,
): string {
  const key = CATEGORY_LABELS_I18N[category as CuratedCategory];
  const fallback =
    CATEGORY_DEFAULTS.category[category as CuratedCategory] ?? category;
  if (!key) return fallback;
  return translateOrFallback(t, key, fallback);
}
