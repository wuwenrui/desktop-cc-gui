export const DEFAULT_UI_FONT_FAMILY =
  "\"SF Pro Text\", \"SF Pro Display\", -apple-system, BlinkMacSystemFont, \"Segoe UI\", \"Helvetica Neue\", sans-serif";

export const LEGACY_MONACO_UI_FONT_FAMILY =
  "Monaco, \"SF Pro Text\", \"SF Pro Display\", -apple-system, \"Helvetica Neue\", sans-serif";

export const DEFAULT_CODE_FONT_FAMILY =
  "Monaco, \"SF Mono\", \"SFMono-Regular\", Menlo, monospace";

export const CODE_FONT_SIZE_DEFAULT = 11;
export const CODE_FONT_SIZE_MIN = 9;
export const CODE_FONT_SIZE_MAX = 16;

export function normalizeFontFamily(
  value: string | null | undefined,
  fallback: string,
) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}

export function normalizeUiFontFamily(value: string | null | undefined) {
  const normalized = normalizeFontFamily(value, DEFAULT_UI_FONT_FAMILY);
  return normalized === LEGACY_MONACO_UI_FONT_FAMILY
    ? DEFAULT_UI_FONT_FAMILY
    : normalized;
}

export function clampCodeFontSize(value: number) {
  if (!Number.isFinite(value)) {
    return CODE_FONT_SIZE_DEFAULT;
  }
  return Math.min(CODE_FONT_SIZE_MAX, Math.max(CODE_FONT_SIZE_MIN, value));
}
