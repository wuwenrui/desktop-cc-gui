## ADDED Requirements

### Requirement: Browser Context Snapshot Cards MUST Remain Legible In Light Themes

Composer browser context snapshot cards and their message summary counterparts MUST preserve readable text and distinguishable observation state styling in dark, dim, light, system-light, and Windows WebView2 light surfaces.

#### Scenario: expired composer browser context remains readable on Windows light theme

- **WHEN** a Composer browser context attachment has observation state `expired`
- **AND** the app is running in Windows desktop with system-light or explicit `data-theme="light"`
- **THEN** the browser context card MUST render a solid-enough surface with readable title, kicker, count chips, detail action, refresh action, and remove action
- **AND** the card and state badge MUST expose an expired-specific presentation class rather than reusing stale-only styling
- **AND** the expired state label MUST come from i18n instead of displaying an untranslated raw enum in localized UI

#### Scenario: message summary preserves browser observation state

- **WHEN** a browser context summary card receives an attachment with observation state `expired`, `degraded`, or `unsupported`
- **THEN** the summary card MUST preserve that observation state for rendering
- **AND** the card and badge MUST use a state-specific class and color token
- **AND** it MUST NOT collapse all non-available states into the stale visual treatment

#### Scenario: browser context contrast fix does not change capture semantics

- **WHEN** browser context snapshot cards render with higher contrast styling
- **THEN** Browser Agent capture, freshness calculation, diagnostics, prompt attachment, and privacy redaction semantics MUST remain unchanged
- **AND** the change MUST stay scoped to presentation, i18n labels, and state preservation for summary rendering
