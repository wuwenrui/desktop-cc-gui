use super::types::{
    BrowserCapabilityState, BrowserPlatform, BrowserPlatformCapability, BrowserWebviewRuntime,
};

#[cfg(any(
    test,
    not(any(target_os = "macos", target_os = "windows", target_os = "linux"))
))]
fn unsupported(platform: BrowserPlatform, reason: &str) -> BrowserPlatformCapability {
    BrowserPlatformCapability {
        platform,
        webview_runtime: BrowserWebviewRuntime::Unknown,
        browser_dock: BrowserCapabilityState::Unsupported,
        snapshot_capture: BrowserCapabilityState::Unsupported,
        screenshot_capture: BrowserCapabilityState::Unsupported,
        navigation_actions: BrowserCapabilityState::Unsupported,
        element_actions: BrowserCapabilityState::Unsupported,
        form_submit_actions: BrowserCapabilityState::Unsupported,
        diagnostics_capture: BrowserCapabilityState::Unsupported,
        unsupported_reasons: vec![reason.to_string()],
        degraded_reasons: Vec::new(),
    }
}

fn supported_webview(
    platform: BrowserPlatform,
    runtime: BrowserWebviewRuntime,
    degraded_reasons: Vec<String>,
) -> BrowserPlatformCapability {
    BrowserPlatformCapability {
        platform,
        webview_runtime: runtime,
        browser_dock: BrowserCapabilityState::Supported,
        snapshot_capture: BrowserCapabilityState::Degraded,
        screenshot_capture: BrowserCapabilityState::Degraded,
        navigation_actions: BrowserCapabilityState::Degraded,
        element_actions: BrowserCapabilityState::Unsupported,
        form_submit_actions: BrowserCapabilityState::Unsupported,
        diagnostics_capture: BrowserCapabilityState::Degraded,
        unsupported_reasons: Vec::new(),
        degraded_reasons,
    }
}

pub(crate) fn current_platform_capability() -> BrowserPlatformCapability {
    #[cfg(target_os = "macos")]
    {
        return supported_webview(
            BrowserPlatform::Macos,
            BrowserWebviewRuntime::Wkwebview,
            vec![
                "Read-only snapshot capture returns bounded page metadata and may degrade when live DOM transport is unavailable.".to_string(),
                "Element and form actions remain disabled until a later phase.".to_string(),
            ],
        );
    }

    #[cfg(target_os = "windows")]
    {
        return supported_webview(
            BrowserPlatform::Windows,
            BrowserWebviewRuntime::Webview2,
            vec![
                "WebView2 runtime availability must be checked before Browser Dock launch."
                    .to_string(),
                "Read-only snapshot capture returns bounded page metadata and may degrade when live DOM transport is unavailable.".to_string(),
            ],
        );
    }

    #[cfg(target_os = "linux")]
    {
        return supported_webview(
            BrowserPlatform::Linux,
            BrowserWebviewRuntime::Webkitgtk,
            vec![
                "WebKitGTK behavior can vary by distribution and AppImage runtime.".to_string(),
                "Read-only snapshot capture returns bounded page metadata and may degrade when live DOM transport is unavailable.".to_string(),
            ],
        );
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
    {
        unsupported(
            BrowserPlatform::Unsupported,
            "Browser Agent is not supported on this platform.",
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn unsupported_marks_every_capability_unavailable() {
        let capability = unsupported(BrowserPlatform::Unsupported, "not available");
        assert_eq!(capability.browser_dock, BrowserCapabilityState::Unsupported);
        assert_eq!(
            capability.snapshot_capture,
            BrowserCapabilityState::Unsupported
        );
        assert_eq!(capability.webview_runtime, BrowserWebviewRuntime::Unknown);
        assert_eq!(capability.unsupported_reasons, vec!["not available"]);
    }

    #[test]
    fn supported_webview_keeps_mutating_actions_disabled_for_mvp() {
        let capability = supported_webview(
            BrowserPlatform::Macos,
            BrowserWebviewRuntime::Wkwebview,
            vec!["capture pending".to_string()],
        );
        assert_eq!(capability.browser_dock, BrowserCapabilityState::Supported);
        assert_eq!(
            capability.snapshot_capture,
            BrowserCapabilityState::Degraded
        );
        assert_eq!(
            capability.element_actions,
            BrowserCapabilityState::Unsupported
        );
        assert_eq!(
            capability.form_submit_actions,
            BrowserCapabilityState::Unsupported
        );
    }
}
