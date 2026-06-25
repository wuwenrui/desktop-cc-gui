import type { FastMarkdownFeatureFlags } from "../../markdown/fastMarkdownRenderer";

function isEnabledFlag(value: unknown) {
  return typeof value === "string" && /^(1|true|yes|on)$/i.test(value.trim());
}

function readBooleanStorageFlag(key: string) {
  try {
    if (typeof window === "undefined") {
      return false;
    }
    return isEnabledFlag(window.localStorage.getItem(key));
  } catch {
    return false;
  }
}

export function resolveFileMarkdownFastFeatureFlags(): FastMarkdownFeatureFlags {
  return {
    fastHtmlRendererEnabled:
      isEnabledFlag(import.meta.env.VITE_MOSSX_FILE_MARKDOWN_FAST_HTML) ||
      readBooleanStorageFlag("ccgui.fileMarkdownFastHtml") ||
      readBooleanStorageFlag("mossx.fileMarkdownFastHtml"),
    boundedFastHtmlRendererEnabled:
      isEnabledFlag(import.meta.env.VITE_MOSSX_FILE_MARKDOWN_BOUNDED_FAST_HTML) ||
      readBooleanStorageFlag("ccgui.fileMarkdownBoundedFastHtml") ||
      readBooleanStorageFlag("mossx.fileMarkdownBoundedFastHtml"),
    largeDocumentFastRendererDisabled:
      isEnabledFlag(import.meta.env.VITE_MOSSX_FILE_MARKDOWN_DISABLE_LARGE_FAST_HTML) ||
      readBooleanStorageFlag("ccgui.fileMarkdownDisableLargeFastHtml"),
  };
}
