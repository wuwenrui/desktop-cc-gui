import type {
  BrowserAgentSettings,
  BrowserPlatformCapability,
  BrowserVisualEvidenceGate,
} from "../types";

export type BrowserVisualEvidenceGateInput = {
  settings: Pick<BrowserAgentSettings, "allowReadOnlySnapshots">;
  platformCapability: Pick<
    BrowserPlatformCapability,
    "screenshotCapture" | "degradedReasons" | "unsupportedReasons"
  >;
  userConfirmedModelPayload: boolean;
};

export function resolveBrowserVisualEvidenceGate(
  input: BrowserVisualEvidenceGateInput,
): BrowserVisualEvidenceGate {
  const unsupportedReasons = [...input.platformCapability.unsupportedReasons];
  const degradedReasons = [...input.platformCapability.degradedReasons];
  if (!input.settings.allowReadOnlySnapshots) {
    unsupportedReasons.push("read_only_snapshots_disabled");
  }
  if (input.platformCapability.screenshotCapture === "unsupported") {
    unsupportedReasons.push("screenshot_capture_unsupported");
  }
  if (input.platformCapability.screenshotCapture === "degraded") {
    degradedReasons.push("screenshot_capture_degraded");
  }
  const state = unsupportedReasons.length > 0
    ? "unsupported"
    : degradedReasons.length > 0
      ? "degraded"
      : "supported";
  return {
    state,
    requiresExplicitConfirmation: true,
    modelPayloadAllowed: state !== "unsupported" && input.userConfirmedModelPayload,
    degradedReasons,
    unsupportedReasons,
    privacyNotice:
      "Visual evidence is opt-in. Screenshot, OCR, or model image payloads are not sent before explicit confirmation.",
  };
}
