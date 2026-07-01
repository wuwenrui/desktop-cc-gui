## ADDED Requirements

### Requirement: The App MUST Provide Frame-Drop Attribution Diagnostics Usable In Packaged Builds

The renderer MUST be able to record frame drops with contextual attribution and export them as pasteable text, without depending on build-time performance flags, so users can locate and report conversation jank in packaged (WKWebView) builds.

#### Scenario: frame drops are recorded with context when diagnostics are enabled
- **WHEN** the runtime performance diagnostics switch is enabled
- **AND** a frame interval exceeds the warn or severe threshold
- **THEN** a bounded frame-drop diagnostic MUST be recorded with frame delta, level, streaming state, visible row count, and last interaction label
- **AND** it MUST NOT contain prompt, assistant, tool, or file content

#### Scenario: long-task observation degrades gracefully when unsupported
- **WHEN** the performance diagnostics switch is enabled
- **AND** the runtime does not support the longtask PerformanceObserver entry type
- **THEN** an unsupported diagnostic MUST be recorded once
- **AND** frame-drop detection MUST continue via requestAnimationFrame

#### Scenario: one-click export of the jank scene
- **WHEN** the user triggers the performance report export
- **THEN** the app MUST produce a pasteable text summary of recent frame drops, long tasks, and performance metrics
- **AND** when clipboard write is unavailable it MUST fall back to a downloadable text file

#### Scenario: diagnostics collection is off by default
- **WHEN** the user has not enabled the performance diagnostics switch
- **THEN** the requestAnimationFrame frame-drop monitor and the longtask observer MUST NOT run
