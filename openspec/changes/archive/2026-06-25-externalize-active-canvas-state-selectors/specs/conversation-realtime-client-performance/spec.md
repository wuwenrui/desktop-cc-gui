## MODIFIED Requirements

### Requirement: Realtime Performance Budget MUST Include Shell Invalidation Evidence
Realtime client performance diagnostics SHALL distinguish Canvas render pressure from Shell control invalidation.

#### Scenario: Active canvas updates do not broadcast through the shell
- **WHEN** an active stream repeatedly mutates canvas-only state such as `activeItems`, `threadItemsByThread`, live status maps, token usage, or rate-limit snapshots
- **THEN** canvas rendering MAY update or coalesce according to the canvas lane policy
- **AND** non-canvas Shell controls SHALL observe only narrow summary or selector-derived facts
- **AND** unchanged selector results SHALL NOT trigger subscribers.

#### Scenario: Live advisory panels preserve urgent input state
- **WHEN** Composer and StatusPanel consume active stream advisory data through selectors
- **THEN** deferred live props MAY lag behind the active canvas snapshot
- **AND** Composer draft text, IME state, attachments, selected model/provider, and send callbacks SHALL remain urgent local/layout props
- **AND** StatusPanel dock rendering SHALL use selector-derived live content without forcing unrelated Shell controls to consume full active canvas objects.
