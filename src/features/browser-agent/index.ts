export { BrowserDock } from "./components/BrowserDock";
export {
  BROWSER_AGENT_ATTACHMENT_STALE_AFTER_MS,
  BROWSER_AGENT_CLOSED_SESSION_CLEANUP_AFTER_MS,
  BROWSER_AGENT_EVIDENCE_RETENTION_DAYS,
  BROWSER_AGENT_EVIDENCE_RETENTION_POLICY,
} from "./constants";
export type { BrowserEvidenceRetentionPolicy } from "./constants";
export {
  buildBrowserContextAttachment,
  buildBrowserContextSnapshot,
  formatBrowserContextPrompt,
  isBrowserContextAttachmentStale,
  parseBrowserContextPrompt,
  sanitizeBrowserSnapshotText,
  stripBrowserContextPrompt,
} from "./utils";
export type {
  BrowserContextAttachmentOptions,
  BrowserSnapshotBuilderInput,
  BrowserSnapshotSanitizationResult,
} from "./utils";
export type * from "./types";
