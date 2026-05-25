## ADDED Requirements

### Requirement: Claude Code Live Text MUST Remain Visible Beyond Preview Limits

Claude Code live assistant text visibility MUST continue beyond ordinary preview and list-summary limits during long outputs.

#### Scenario: long Claude output continues after preview budget
- **WHEN** a Claude Code turn is processing
- **AND** assistant text deltas continue after the active text exceeds the ordinary preview truncation budget
- **THEN** the live assistant message MUST continue visible text progression from the untruncated body
- **AND** the UI MUST NOT append new output after an inserted ellipsis caused by preview truncation

#### Scenario: interrupted long Claude output restores visible text
- **WHEN** a Claude Code turn streamed long assistant text
- **AND** the client closed before Claude history contained the final assistant body
- **THEN** reopening the session MUST restore the latest trusted local assistant text when a matching shadow transcript exists
- **AND** the restored surface MUST remain readable instead of rendering an empty or thinking-only conversation

#### Scenario: mitigation remains model-independent
- **WHEN** a Claude Code long-output visibility issue occurs across models or providers
- **THEN** diagnostics MUST classify the issue by engine, stream, reducer, render, and recovery evidence
- **AND** it MUST NOT require model-specific fingerprints to protect long-output visibility
