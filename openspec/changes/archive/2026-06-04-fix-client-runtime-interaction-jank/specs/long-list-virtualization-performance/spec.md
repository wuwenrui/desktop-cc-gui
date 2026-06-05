## ADDED Requirements

### Requirement: Long Streaming Timelines SHALL Keep Heavy Derivations Off The Delta Path

Long conversation timelines SHALL preserve a stable parent presentation snapshot during live output growth so per-delta work remains bounded.

#### Scenario: live row grows without full timeline recomputation
- **WHEN** a single assistant or reasoning row receives repeated realtime deltas
- **THEN** the latest live row MUST remain visible through an override or equivalent active-row path
- **AND** grouping, anchors, sticky candidates, final boundary sets, suppressed context sets, and collapsed middle-step projections MUST NOT be recomputed from the full latest timeline on every text delta

#### Scenario: stable snapshot converges after completion
- **WHEN** the streaming turn completes
- **THEN** the stable presentation snapshot MUST converge to canonical latest timeline items
- **AND** final boundaries, anchors, sticky candidates, and collapsed rows MUST reflect the completed conversation without requiring history replay as the only source of truth

### Requirement: Streaming Virtualization SHALL Preserve Active Row Semantics

Any virtualization, content visibility, chunking, or row windowing used during streaming SHALL preserve active row visibility, scroll intent, selection, and copy semantics.

#### Scenario: active streaming row is not recycled away
- **WHEN** timeline virtualization or content visibility is enabled while a row is actively streaming
- **THEN** the active live row MUST remain mounted or otherwise preserve live text, selection, auto-follow intent, and message actions
- **AND** the user MUST NOT see the active response reset, disappear, or wait for history restore

#### Scenario: non-live rows may be bounded
- **WHEN** a long timeline contains many historical rows during an active streaming turn
- **THEN** non-live historical rows MAY be virtualized, hidden with content visibility, or collapsed by a documented projection
- **AND** message order, message identity, anchor navigation, and scroll restoration MUST remain explainable from canonical conversation state

### Requirement: Scroll Work SHALL Be Throttled Without Blocking Input

Auto-follow, scroll restoration, and message jump work SHALL be scheduled so it does not monopolize the main thread during typing or high-frequency streaming.

#### Scenario: auto-follow does not flood smooth scroll work
- **WHEN** a live conversation receives frequent deltas
- **THEN** auto-follow scroll work MUST be throttled, coalesced, or switched to instant behavior during active streaming
- **AND** pending scroll work MUST NOT block Composer input event handling

#### Scenario: manual scroll intent is preserved
- **WHEN** the user scrolls away from the bottom during streaming
- **THEN** throttled auto-follow MUST respect the user's manual scroll intent
- **AND** performance optimization MUST NOT force the viewport back to the live row unless the user re-enables follow behavior
