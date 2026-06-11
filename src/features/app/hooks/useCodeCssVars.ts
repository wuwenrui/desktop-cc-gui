import { useEffect } from "react";
import type { AppSettings } from "../../../types";
import { buildAppTypographyCssVars } from "../utils/typographyCssVars";

export function useCodeCssVars(appSettings: AppSettings) {
  const { codeFontFamily, codeFontSize, uiFontFamily } = appSettings;

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }
    const root = document.documentElement;
    const typographyVars = buildAppTypographyCssVars({
      codeFontFamily,
      codeFontSize,
      uiFontFamily,
    });
    Object.entries(typographyVars).forEach(([property, value]) => {
      root.style.setProperty(property, value);
    });
  }, [codeFontFamily, codeFontSize, uiFontFamily]);
}
