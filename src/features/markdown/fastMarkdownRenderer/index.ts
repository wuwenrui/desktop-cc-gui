export type {
  CompileFastMarkdownArgs,
  FastMarkdownCompileCacheKey,
  FastMarkdownFallbackReason,
  FastMarkdownFeatureFlags,
  FastMarkdownHeavyBlock,
  FastMarkdownRenderDiagnostics,
  FastMarkdownRenderResult,
  FastMarkdownRendererProfileId,
  MarkdownHeavyBlockKind,
  MarkdownOutlineEntry,
  MarkdownSourceLineAnchor,
} from "./types";

export {
  getCachedFastMarkdownRender,
  setCachedFastMarkdownRender,
  clearFastMarkdownRenderCache,
  getFastMarkdownRenderCacheSize,
} from "./cache";

export {
  compileFastMarkdown,
  isFastMarkdownProfile,
} from "./compile";

export {
  extractMarkdownOutline,
  slugifyHeadingTitle,
} from "./parserOutline";

export { extractHeavyBlocks } from "./heavyBlocks";

export { attachSourceLineAttrs } from "./sourceLineAttrs";

export {
  sanitizeFastMarkdownHtml,
  isSafeHref,
} from "./sanitize";

export {
  resolveFastMarkdownRendererProfile,
  resolveFastMarkdownProfileInputs,
} from "./resolveProfile";

export { useFastMarkdownRender } from "./useFastMarkdownRender";

export {
  compileFastMarkdownInWorker,
  compileFastMarkdownWithWorkerFallback,
  disposeFastMarkdownWorker,
} from "./workerAdapter";

export {
  FileMarkdownFastPreview,
  type FileMarkdownFastPreviewProps,
} from "./FileMarkdownFastPreview";
