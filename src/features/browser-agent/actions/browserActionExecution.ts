import type { BrowserActionPreview, BrowserActionResult } from "../types";

export type ConfirmBrowserActionInput = {
  preview: BrowserActionPreview;
  confirmed: boolean;
  execute: (preview: BrowserActionPreview) => Promise<BrowserActionResult>;
  now?: number;
};

export async function confirmBrowserActionPreview({
  preview,
  confirmed,
  execute,
  now = Date.now(),
}: ConfirmBrowserActionInput): Promise<BrowserActionResult> {
  if (!confirmed) {
    return {
      outcome: "canceled",
      preview,
      auditEntry: {
        actionId: preview.actionId,
        browserSessionId: preview.browserSessionId,
        requestedAt: now,
        completedAt: now,
        action: preview.action,
        targetDescription: preview.targetDescription,
        outcome: "canceled",
        diagnosticMessage: "User did not confirm the browser action; no operation was executed.",
        beforeSnapshotId: preview.beforeSnapshotId,
        afterSnapshotId: null,
        comparison: {
          beforeSnapshotId: preview.beforeSnapshotId,
          afterSnapshotId: null,
          state: "failed",
          diagnostics: ["Action was canceled before execution."],
        },
      },
    };
  }
  if (!preview.gate.allowed) {
    return {
      outcome: "blocked",
      preview,
      auditEntry: {
        actionId: preview.actionId,
        browserSessionId: preview.browserSessionId,
        requestedAt: now,
        completedAt: now,
        action: preview.action,
        targetDescription: preview.targetDescription,
        outcome: "blocked",
        diagnosticMessage: `Browser action blocked: ${preview.gate.blockedReasons.join(", ")}`,
        beforeSnapshotId: preview.beforeSnapshotId,
        afterSnapshotId: null,
        comparison: {
          beforeSnapshotId: preview.beforeSnapshotId,
          afterSnapshotId: null,
          state: "failed",
          diagnostics: preview.gate.blockedReasons,
        },
      },
    };
  }
  return execute(preview);
}
