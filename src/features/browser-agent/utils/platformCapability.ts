import type {
  BrowserCapabilityState,
  BrowserPlatformCapability,
} from "../types";

function unsupportedCapability(
  platform: BrowserPlatformCapability["platform"],
  reason: string,
): BrowserPlatformCapability {
  return {
    platform,
    webviewRuntime: "unknown",
    browserDock: "unsupported",
    snapshotCapture: "unsupported",
    screenshotCapture: "unsupported",
    navigationActions: "unsupported",
    elementActions: "unsupported",
    formSubmitActions: "unsupported",
    diagnosticsCapture: "unsupported",
    unsupportedReasons: [reason],
    degradedReasons: [],
  };
}

function supportedCapability(
  platform: BrowserPlatformCapability["platform"],
  webviewRuntime: BrowserPlatformCapability["webviewRuntime"],
  degradedReasons: string[],
  advancedActionState: BrowserCapabilityState,
): BrowserPlatformCapability {
  return {
    platform,
    webviewRuntime,
    browserDock: "supported",
    snapshotCapture: "degraded",
    screenshotCapture: "degraded",
    navigationActions: "degraded",
    elementActions: advancedActionState,
    formSubmitActions: advancedActionState,
    diagnosticsCapture: "degraded",
    unsupportedReasons: [],
    degradedReasons,
  };
}

export function getBrowserPlatformCapability(
  platform: string,
): BrowserPlatformCapability {
  if (platform === "macos") {
    return supportedCapability(
      "macos",
      "wkwebview",
      [
        "Read-only snapshot capture is not wired yet.",
        "Element and form actions remain disabled until a later phase.",
      ],
      "unsupported",
    );
  }

  if (platform === "windows") {
    return supportedCapability(
      "windows",
      "webview2",
      [
        "WebView2 runtime availability must be checked before Browser Dock launch.",
        "Read-only snapshot capture is not wired yet.",
      ],
      "unsupported",
    );
  }

  if (platform === "linux") {
    return supportedCapability(
      "linux",
      "webkitgtk",
      [
        "WebKitGTK behavior can vary by distribution and AppImage runtime.",
        "Read-only snapshot capture is not wired yet.",
      ],
      "unsupported",
    );
  }

  return unsupportedCapability(
    "unsupported",
    `Browser Agent is not supported on platform: ${platform || "unknown"}.`,
  );
}
