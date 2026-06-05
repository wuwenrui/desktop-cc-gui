import type {
  BrowserOcrTextSupplement,
  BrowserPrivacyReport,
  BrowserScreenshotReference,
} from "../types";
import { sanitizeBrowserSnapshotText } from "../utils/snapshotSanitizer";

export type BrowserScreenshotReferenceInput = {
  refId: string;
  browserSessionId: string;
  snapshotId: string;
  capturedAt: number;
  captureAvailable: boolean;
  degradedReason?: string | null;
};

export function buildBrowserScreenshotReference(
  input: BrowserScreenshotReferenceInput,
): BrowserScreenshotReference {
  return {
    refId: input.refId,
    browserSessionId: input.browserSessionId,
    snapshotId: input.snapshotId,
    capturedAt: input.capturedAt,
    kind: "thumbnail_reference",
    storage: "metadata_only",
    modelPayloadAllowed: false,
    diagnostic: input.captureAvailable
      ? {
          diagnosticId: `screenshot-ref-${input.snapshotId}`,
          severity: "info",
          userMessage: "Screenshot thumbnail reference is available as metadata only.",
          aiMessage:
            "Screenshot reference metadata exists, but image binary is not included by default.",
        }
      : {
          diagnosticId: `screenshot-ref-degraded-${input.snapshotId}`,
          severity: "warning",
          userMessage: input.degradedReason || "Screenshot thumbnail reference is unavailable.",
          aiMessage:
            input.degradedReason || "Screenshot reference is degraded or unavailable.",
        },
  };
}

export function buildBrowserOcrTextSupplement(input: {
  refId: string;
  screenshotRefId: string;
  text: string;
  capturedAt: number;
  charBudget: number;
  privacy?: Pick<BrowserPrivacyReport, "redactedKinds">;
  modelPayloadAllowed: boolean;
}): BrowserOcrTextSupplement {
  const sanitized = sanitizeBrowserSnapshotText(input.text);
  const boundedText = sanitized.text.slice(0, input.charBudget);
  return {
    refId: input.refId,
    screenshotRefId: input.screenshotRefId,
    text: boundedText,
    capturedAt: input.capturedAt,
    charBudget: input.charBudget,
    truncated: sanitized.text.length > input.charBudget,
    redactedKinds: [
      ...(input.privacy?.redactedKinds ?? []),
      ...sanitized.privacy.redactedKinds,
    ],
    modelPayloadAllowed: input.modelPayloadAllowed,
  };
}
