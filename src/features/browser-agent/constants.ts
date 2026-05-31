export const BROWSER_AGENT_EVIDENCE_RETENTION_DAYS = 7;
export const BROWSER_AGENT_ATTACHMENT_STALE_AFTER_MS = 5 * 60 * 1000;
export const BROWSER_AGENT_CLOSED_SESSION_CLEANUP_AFTER_MS = 30 * 60 * 1000;

export type BrowserEvidenceRetentionPolicy = {
  evidenceRetentionDays: number;
  attachmentStaleAfterMs: number;
  closedSessionCleanupAfterMs: number;
  rawPagePayloadStored: false;
};

export const BROWSER_AGENT_EVIDENCE_RETENTION_POLICY: BrowserEvidenceRetentionPolicy = {
  evidenceRetentionDays: BROWSER_AGENT_EVIDENCE_RETENTION_DAYS,
  attachmentStaleAfterMs: BROWSER_AGENT_ATTACHMENT_STALE_AFTER_MS,
  closedSessionCleanupAfterMs: BROWSER_AGENT_CLOSED_SESSION_CLEANUP_AFTER_MS,
  rawPagePayloadStored: false,
};
