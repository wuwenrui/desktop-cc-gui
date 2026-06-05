export {
  buildBrowserObservation,
  buildBrowserContextAttachment,
  deriveBrowserObservationStaleReasons,
  formatBrowserContextPrompt,
  formatBrowserContextPromptOnce,
  isBrowserContextAttachmentStale,
  parseBrowserContextPrompt,
  stripBrowserContextPrompt,
} from "./attachment";
export type { BrowserContextAttachmentOptions } from "./attachment";
export {
  buildBrowserContextSnapshot,
  sanitizeBrowserSnapshotText,
} from "./snapshotSanitizer";
export { buildBrowserCodeCandidates } from "./codeCandidates";
export { BROWSER_AGENT_READ_ONLY_CAPTURE_SCRIPT } from "./readOnlyCaptureScript";
export type {
  BrowserSnapshotBuilderInput,
  BrowserSnapshotSanitizationResult,
} from "./snapshotSanitizer";
export type { BrowserCodeCandidateInput } from "./codeCandidates";
