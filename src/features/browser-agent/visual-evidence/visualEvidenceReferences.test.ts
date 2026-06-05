import { describe, expect, it } from "vitest";
import {
  buildBrowserOcrTextSupplement,
  buildBrowserScreenshotReference,
} from "./visualEvidenceReferences";

describe("visual evidence references", () => {
  it("creates screenshot metadata refs without allowing model payload by default", () => {
    const ref = buildBrowserScreenshotReference({
      refId: "shot-1",
      browserSessionId: "session-1",
      snapshotId: "snapshot-1",
      capturedAt: 1000,
      captureAvailable: true,
    });

    expect(ref.storage).toBe("metadata_only");
    expect(ref.modelPayloadAllowed).toBe(false);
    expect(ref.diagnostic?.aiMessage).not.toContain("binary is included");
  });

  it("sanitizes and budgets OCR text supplements", () => {
    const supplement = buildBrowserOcrTextSupplement({
      refId: "ocr-1",
      screenshotRefId: "shot-1",
      text: "token=abc123 Visible receipt text",
      capturedAt: 1000,
      charBudget: 80,
      modelPayloadAllowed: true,
    });

    expect(supplement.text).toContain("[redacted]");
    expect(supplement.redactedKinds).toContain("token");
    expect(supplement.modelPayloadAllowed).toBe(true);
  });
});
