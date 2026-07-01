import type { AppSettings } from "../../../types";

type TypographySettings = Pick<
  AppSettings,
  "uiFontFamily" | "codeFontFamily" | "codeFontSize"
>;

export type AppTypographyCssVars = Record<`--${string}`, string>;

function formatPx(value: number): string {
  return `${Number.isInteger(value) ? value : Number(value.toFixed(2))}px`;
}

function normalizeCodeFontSize(codeFontSize: number): number {
  return Number.isFinite(codeFontSize) ? codeFontSize : 11;
}

export function buildAppTypographyCssVars(
  settings: TypographySettings,
): AppTypographyCssVars {
  const codeFontSize = normalizeCodeFontSize(settings.codeFontSize);
  const codeFontSizePx = formatPx(codeFontSize);

  return {
    "--ui-font-family": settings.uiFontFamily,
    "--code-font-family": settings.codeFontFamily,
    "--code-font-size": codeFontSizePx,
    "--app-font-size-xs": "10px",
    "--app-font-size-sm": "12px",
    "--app-font-size-md": "13px",
    "--app-font-size-lg": "16px",
    "--client-caption-font-size": "var(--app-font-size-xs)",
    "--client-meta-font-size": "var(--app-font-size-sm)",
    "--client-content-font-size": "var(--app-font-size-md)",
    "--client-title-font-size": "var(--app-font-size-lg)",
  };
}
