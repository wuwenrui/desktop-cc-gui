import { describe, expect, it } from "vitest";
import { resolveBrowserVisualEvidenceGate } from "./visualEvidenceGate";

describe("resolveBrowserVisualEvidenceGate", () => {
  it("blocks visual model payload before explicit confirmation", () => {
    const gate = resolveBrowserVisualEvidenceGate({
      settings: {
        allowReadOnlySnapshots: true,
      },
      platformCapability: {
        screenshotCapture: "supported",
        degradedReasons: [],
        unsupportedReasons: [],
      },
      userConfirmedModelPayload: false,
    });

    expect(gate).toMatchObject({
      state: "supported",
      requiresExplicitConfirmation: true,
      modelPayloadAllowed: false,
    });
    expect(gate.privacyNotice).toContain("not sent before explicit confirmation");
  });

  it("allows visual model payload only after confirmation when supported", () => {
    const gate = resolveBrowserVisualEvidenceGate({
      settings: {
        allowReadOnlySnapshots: true,
      },
      platformCapability: {
        screenshotCapture: "supported",
        degradedReasons: [],
        unsupportedReasons: [],
      },
      userConfirmedModelPayload: true,
    });

    expect(gate.modelPayloadAllowed).toBe(true);
  });

  it("reports unsupported and degraded capability separately", () => {
    const unsupportedGate = resolveBrowserVisualEvidenceGate({
      settings: {
        allowReadOnlySnapshots: false,
      },
      platformCapability: {
        screenshotCapture: "unsupported",
        degradedReasons: [],
        unsupportedReasons: ["linux_webkitgtk_capture_unavailable"],
      },
      userConfirmedModelPayload: true,
    });
    const degradedGate = resolveBrowserVisualEvidenceGate({
      settings: {
        allowReadOnlySnapshots: true,
      },
      platformCapability: {
        screenshotCapture: "degraded",
        degradedReasons: ["platform_thumbnail_only"],
        unsupportedReasons: [],
      },
      userConfirmedModelPayload: true,
    });

    expect(unsupportedGate.state).toBe("unsupported");
    expect(unsupportedGate.modelPayloadAllowed).toBe(false);
    expect(unsupportedGate.unsupportedReasons).toContain("screenshot_capture_unsupported");
    expect(degradedGate.state).toBe("degraded");
    expect(degradedGate.modelPayloadAllowed).toBe(true);
    expect(degradedGate.degradedReasons).toContain("screenshot_capture_degraded");
  });
});
