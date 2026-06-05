import { describe, expect, it } from "vitest";
import {
  buildBrowserActionPreview,
  resolveBrowserActionGate,
} from "./browserActionPreview";
import type { BrowserAgentSettings, BrowserPlatformCapability } from "../types";

const settings: Pick<
  BrowserAgentSettings,
  "allowNavigationActions" | "allowElementActions" | "allowFormSubmitActions"
> = {
  allowNavigationActions: true,
  allowElementActions: true,
  allowFormSubmitActions: true,
};

const platformCapability: Pick<
  BrowserPlatformCapability,
  "navigationActions" | "elementActions" | "formSubmitActions"
> = {
  navigationActions: "supported",
  elementActions: "supported",
  formSubmitActions: "supported",
};

describe("BrowserActionPreview", () => {
  it("creates preview-first safe navigation actions that still require confirmation", () => {
    const preview = buildBrowserActionPreview({
      actionId: "action-1",
      browserSessionId: "session-1",
      action: "scroll",
      targetDescription: "Scroll down",
      reason: "User asked to inspect lower content.",
      beforeSnapshotId: "snapshot-1",
      settings,
      platformCapability,
    });

    expect(preview).toMatchObject({
      action: "scroll",
      riskLevel: "low",
      requiresUserConfirmation: true,
      blockedByDefault: false,
      gate: {
        allowed: true,
        blockedReasons: ["requires_user_confirmation"],
      },
    });
  });

  it("keeps click type select and submit blocked by default", () => {
    for (const action of ["click", "type", "select", "submit"] as const) {
      const gate = resolveBrowserActionGate(action, settings, platformCapability);

      expect(gate.allowed).toBe(false);
      expect(gate.blockedReasons).toContain("mutating_action_blocked_by_default");
    }
  });

  it("redacts secret-like values in action previews", () => {
    const preview = buildBrowserActionPreview({
      actionId: "action-1",
      browserSessionId: "session-1",
      action: "type",
      targetDescription: "Password input",
      value: "password: hunter2",
      reason: "AI proposed filling the field.",
      settings,
      platformCapability,
    });

    expect(preview.valuePreview).toContain("[redacted]");
    expect(preview.blockedByDefault).toBe(true);
    expect(preview.privacyNotice).toContain("redacted");
  });
});
