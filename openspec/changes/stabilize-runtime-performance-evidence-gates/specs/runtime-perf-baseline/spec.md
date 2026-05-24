## ADDED Requirements

### Requirement: Perf Baseline Reports MUST Expose Evidence Class

Perf baseline reports MUST expose whether each scenario is measured, proxy, unsupported, or manual-only so consumers do not mistake a successful script for release-grade runtime proof.

#### Scenario: long-list browser-scroll proxy is explicit
- **WHEN** the long-list `S-LL-1000` scroll metric is generated without browser-level evidence
- **THEN** the report MUST classify the scroll evidence as `proxy`
- **AND** the report MUST include the missing browser-scroll gate as the next action

#### Scenario: cold-start unsupported timing remains explicit
- **WHEN** `firstPaintMs` or `firstInteractiveMs` cannot be collected for Tauri webview cold start
- **THEN** the report MUST classify the metric as `unsupported`
- **AND** the report MUST include the unsupported reason from the baseline source

### Requirement: Perf Evidence Aggregation MUST Keep Raw Baseline Values Traceable

The evidence gate MUST preserve links from the aggregate summary back to raw perf baseline JSON sources.

#### Scenario: aggregate report references source files
- **WHEN** the runtime performance evidence report is generated
- **THEN** each summarized scenario MUST list the source JSON or report file used
- **AND** missing source files MUST be classified as `unsupported` or `manual-only` with a reason

### Requirement: Browser Long-List Scroll Gate MUST Use Explicit Unsupported Fallback

The `S-LL-1000` browser scroll gate MUST record browser-level scroll evidence when a supported local browser is available and MUST write an explicit unsupported result when it is not available.

#### Scenario: browser scroll gate records measured evidence
- **WHEN** a supported Chrome/Chromium-compatible browser and CDP transport are available
- **THEN** the browser scroll gate MUST write a `S-LL-1000` browser scroll metric with evidence class `measured`
- **AND** the metric MUST include frame count, dropped-frame estimate, duration, scroll height, and viewport height details

#### Scenario: browser scroll gate records unsupported evidence
- **WHEN** no supported browser or CDP transport is available
- **THEN** the browser scroll gate MUST write a `S-LL-1000` browser scroll metric with `value: null`
- **AND** the metric MUST include an `unsupportedReason`
