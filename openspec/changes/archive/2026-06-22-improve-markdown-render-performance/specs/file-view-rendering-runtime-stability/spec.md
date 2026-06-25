## ADDED Requirements

### Requirement: Markdown Scroll Interaction MUST Remain Responsive Under Preview Pressure

Long Markdown file preview scrolling MUST remain bounded in frontend work, and preview-side rendering work MUST NOT block unrelated file view controls, tab switching, or editor state.

#### Scenario: scroll does not trigger markdown compile
- **WHEN** the user scrolls up and down inside a rendered Markdown preview
- **THEN** the system MUST NOT run Markdown parse, sanitize, outline extraction, or file-content IPC reads solely because of scroll position changes
- **AND** scroll-related work MUST remain local to already-rendered DOM, reveal scheduling, or viewport bookkeeping.

#### Scenario: reveal work is scheduled without starving controls
- **WHEN** progressive or bounded preview reveal work is pending
- **THEN** file view controls such as edit/preview toggle, tab close, and annotation draft input MUST remain interactive
- **AND** pending reveal work MUST be cancellable or ignored when the file identity changes.

#### Scenario: concurrent runtime pressure slows markdown reveal cadence
- **WHEN** foreground engine processing, split chat, or another configured render-pressure signal is active
- **THEN** Markdown preview MAY slow progressive reveal cadence
- **AND** it MUST NOT switch to unbounded full-document rich rendering during that pressure window.

### Requirement: Markdown Performance Evidence MUST Distinguish Body Work From Overlay Work

File view performance evidence MUST classify Markdown lag sources separately for body compile/render, annotation overlay updates, outline navigation, heavy block hydration, image load, and external file IO.

#### Scenario: evidence classifies annotation overlay cost
- **WHEN** annotation draft or marker updates are observed during Markdown preview
- **THEN** diagnostics MUST classify whether the update affected only annotation overlay or also forced body render work
- **AND** it MUST NOT report the update as body-render-only without evidence.

#### Scenario: evidence classifies fast fallback reason
- **WHEN** Markdown preview falls back from fast to rich rendering
- **THEN** diagnostics MUST expose a bounded fallback reason such as compile failure, sanitizer failure, local image island unsupported, Mermaid island unsupported, or annotation placement unsupported
- **AND** it MUST NOT include raw Markdown or annotation body content.
