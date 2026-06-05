import type {
  BrowserActionGateResolution,
  BrowserActionKind,
  BrowserActionPreview,
  BrowserActionRiskLevel,
  BrowserAgentSettings,
  BrowserPlatformCapability,
} from "../types";
import { sanitizeBrowserSnapshotText } from "../utils/snapshotSanitizer";

export type BrowserActionPreviewInput = {
  actionId: string;
  browserSessionId: string;
  action: BrowserActionKind;
  targetDescription: string;
  value?: string | null;
  reason: string;
  beforeSnapshotId?: string | null;
  settings: Pick<
    BrowserAgentSettings,
    "allowNavigationActions" | "allowElementActions" | "allowFormSubmitActions"
  >;
  platformCapability: Pick<
    BrowserPlatformCapability,
    "navigationActions" | "elementActions" | "formSubmitActions"
  >;
};

const SAFE_NAVIGATION_ACTIONS: BrowserActionKind[] = ["navigate", "reload", "scroll"];
const ELEMENT_ACTIONS: BrowserActionKind[] = ["click", "type", "select"];

function isSafeNavigationAction(action: BrowserActionKind): boolean {
  return SAFE_NAVIGATION_ACTIONS.includes(action);
}

function riskLevelForAction(action: BrowserActionKind): BrowserActionRiskLevel {
  if (isSafeNavigationAction(action)) {
    return "low";
  }
  if (ELEMENT_ACTIONS.includes(action)) {
    return "medium";
  }
  return "high";
}

function expectedEffectForAction(action: BrowserActionKind): string {
  switch (action) {
    case "navigate":
      return "Load the requested page in the active Browser Dock session.";
    case "reload":
      return "Reload the active Browser Dock page.";
    case "scroll":
      return "Scroll the active Browser Dock page.";
    case "click":
      return "Would click a page element, but mutating actions are blocked by default.";
    case "type":
      return "Would type into a page field, but mutating actions are blocked by default.";
    case "select":
      return "Would select a page option, but mutating actions are blocked by default.";
    case "submit":
      return "Would submit a form, but mutating actions are blocked by default.";
  }
}

function redactActionValue(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const sanitized = sanitizeBrowserSnapshotText(value);
  return sanitized.text.trim() || null;
}

export function resolveBrowserActionGate(
  action: BrowserActionKind,
  settings: BrowserActionPreviewInput["settings"],
  platformCapability: BrowserActionPreviewInput["platformCapability"],
): BrowserActionGateResolution {
  const blockedReasons: BrowserActionGateResolution["blockedReasons"] = [
    "requires_user_confirmation",
  ];
  if (isSafeNavigationAction(action)) {
    if (!settings.allowNavigationActions) {
      blockedReasons.push("settings_disabled");
    }
    if (platformCapability.navigationActions === "unsupported") {
      blockedReasons.push("platform_unsupported");
    }
  } else if (ELEMENT_ACTIONS.includes(action)) {
    blockedReasons.push("mutating_action_blocked_by_default");
    if (!settings.allowElementActions) {
      blockedReasons.push("settings_disabled");
    }
    if (platformCapability.elementActions === "unsupported") {
      blockedReasons.push("platform_unsupported");
    }
  } else {
    blockedReasons.push("mutating_action_blocked_by_default");
    if (!settings.allowFormSubmitActions) {
      blockedReasons.push("settings_disabled");
    }
    if (platformCapability.formSubmitActions === "unsupported") {
      blockedReasons.push("platform_unsupported");
    }
  }
  return {
    allowed: blockedReasons.length === 1 && blockedReasons[0] === "requires_user_confirmation",
    blockedReasons,
  };
}

export function buildBrowserActionPreview(
  input: BrowserActionPreviewInput,
): BrowserActionPreview {
  const gate = resolveBrowserActionGate(
    input.action,
    input.settings,
    input.platformCapability,
  );
  const riskLevel = riskLevelForAction(input.action);
  return {
    actionId: input.actionId,
    browserSessionId: input.browserSessionId,
    action: input.action,
    targetDescription: input.targetDescription,
    valuePreview: redactActionValue(input.value),
    reason: input.reason,
    riskLevel,
    requiresUserConfirmation: true,
    blockedByDefault: !isSafeNavigationAction(input.action),
    beforeSnapshotId: input.beforeSnapshotId ?? null,
    expectedEffect: expectedEffectForAction(input.action),
    privacyNotice:
      "Browser actions require explicit confirmation; secret-like values are redacted in previews.",
    gate,
  };
}
