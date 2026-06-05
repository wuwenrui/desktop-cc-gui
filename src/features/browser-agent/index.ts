export { BrowserDock } from "./components/BrowserDock";
export { BrowserEvidencePanel } from "./components/BrowserEvidencePanel";
export { BrowserActionAuditTrail } from "./components/BrowserActionAuditTrail";
export { BrowserContextPreview } from "./components/BrowserContextPreview";
export { BrowserContextSummaryCard } from "./components/BrowserContextSummaryCard";
export { useBrowserContextAttachment } from "./hooks/useBrowserContextAttachment";
export {
  BROWSER_AGENT_ATTACHMENT_STALE_AFTER_MS,
  BROWSER_AGENT_CLOSED_SESSION_CLEANUP_AFTER_MS,
  BROWSER_AGENT_EVIDENCE_RETENTION_DAYS,
  BROWSER_AGENT_EVIDENCE_RETENTION_POLICY,
} from "./constants";
export type { BrowserEvidenceRetentionPolicy } from "./constants";
export {
  buildBrowserObservation,
  buildBrowserContextAttachment,
  buildBrowserContextSnapshot,
  deriveBrowserObservationStaleReasons,
  formatBrowserContextPrompt,
  formatBrowserContextPromptOnce,
  isBrowserContextAttachmentStale,
  parseBrowserContextPrompt,
  sanitizeBrowserSnapshotText,
  stripBrowserContextPrompt,
} from "./utils";
export {
  buildBrowserEvidenceCopyText,
  buildBrowserEvidenceViewModel,
  buildBrowserEvidenceViewModelFromTaskRunEvidence,
} from "./evidence";
export {
  buildAnnotatedVisualEvidenceBlockedDiagnostic,
  buildBrowserUserAnnotation,
  formatBrowserUserAnnotationEvidence,
  reconcileBrowserUserAnnotationStaleReasons,
} from "./annotations";
export {
  buildBrowserActionPreview,
  confirmBrowserActionPreview,
  resolveBrowserActionGate,
} from "./actions";
export {
  buildBrowserOcrTextSupplement,
  buildBrowserScreenshotReference,
  resolveBrowserVisualEvidenceGate,
} from "./visual-evidence";
export {
  openBrowserCodeCandidateWithExistingNavigator,
  resolveBrowserCodeCandidateOpenTarget,
} from "./code-bridge";
export type {
  BrowserEvidenceSectionState,
  BrowserEvidenceViewModel,
  BrowserEvidenceViewModelSection,
} from "./evidence";
export type {
  BrowserUserAnnotationContext,
  BrowserUserAnnotationInput,
} from "./annotations";
export type {
  BrowserActionPreviewInput,
  ConfirmBrowserActionInput,
} from "./actions";
export type {
  BrowserVisualEvidenceGateInput,
  BrowserScreenshotReferenceInput,
} from "./visual-evidence";
export type { BrowserCodeCandidateOpenTarget } from "./code-bridge";
export {
  clearActiveBrowserContextSession,
  getActiveBrowserContext,
  setActiveBrowserContextSession,
  subscribeActiveBrowserContext,
} from "./state/activeBrowserContext";
export type { ActiveBrowserContextState } from "./state/activeBrowserContext";
export type {
  BrowserContextAttachmentOptions,
  BrowserSnapshotBuilderInput,
  BrowserSnapshotSanitizationResult,
} from "./utils";
export type * from "./types";
