## ADDED Requirements

### Requirement: Startup CSS MUST Be Limited To First-Screen Critical Styling

renderer bootstrap path MUST 只加载 initial shell 与 immediately visible controls 所需 CSS；feature-only styles MUST defer 到 feature activation path。

#### Scenario: bootstrap CSS has explicit first-screen ownership

- **WHEN** CSS file is imported by `src/bootstrap.ts`
- **THEN** stylesheet MUST be classified as critical or first-visible-shell styling
- **AND** classification MUST cover app shell, sidebar shell, main layout, minimal messages, minimal composer, or shared primitive styling
- **AND** feature-only surfaces not visible on first render MUST NOT be imported directly by bootstrap

#### Scenario: feature CSS loads on feature activation

- **WHEN** user first opens file preview, diff view, settings, SpecHub, Git History, Kanban, WorkspaceHome, browser agent, search palette, or intent canvas
- **THEN** feature-specific CSS required for that surface MUST be loaded by the feature activation path or lazy feature entry
- **AND** app shell MUST remain usable while that CSS loads

### Requirement: Lazy CSS Loading MUST Preserve Visual Stability

CSS 从 bootstrap 移出后，feature first-open MUST 保持 visual stability，不能把 broken unstyled panel 作为稳定状态。

#### Scenario: feature first-open avoids unstyled flash

- **WHEN** lazily styled feature surface opens for the first time
- **THEN** surface MUST either wait for required CSS before showing detailed content or render a stable feature-level skeleton
- **AND** it MUST NOT show visibly broken unstyled panel as steady state

#### Scenario: first-screen visual parity is preserved

- **WHEN** app starts on desktop or compact layout
- **THEN** initial shell, sidebar, active conversation shell, and composer controls MUST retain existing visible layout contract
- **AND** non-first-screen CSS deferral MUST NOT remove shared focus, accessibility, or scrollbar primitives used by first screen
