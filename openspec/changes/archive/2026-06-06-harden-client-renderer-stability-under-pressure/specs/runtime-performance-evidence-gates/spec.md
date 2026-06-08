## ADDED Requirements

### Requirement: Renderer stability evidence MUST be classified before release or archive claims
Performance and stability evidence reports SHALL classify renderer pressure and recovery evidence by collection strength before claiming release-grade improvement.

#### Scenario: evidence report covers renderer stability
- **WHEN** a report claims improvement for white-screen, WebView/WebContent crash, renderer unresponsive, long-run pressure, or multi-engine streaming stability
- **THEN** the report MUST classify each evidence item as measured, proxy, manual-only, or unsupported
- **AND** measured evidence MUST identify the source such as native process event, backend heartbeat watchdog, WebView/Tauri profiler, PerformanceObserver, OS process snapshot, or equivalent platform signal

#### Scenario: platform evidence is unavailable
- **WHEN** a platform cannot provide memory, process, long-task, native process failure, or profiler evidence
- **THEN** the report MUST mark that signal as unsupported with reason
- **AND** it MUST NOT present proxy or manual-only evidence as release-grade measured evidence
