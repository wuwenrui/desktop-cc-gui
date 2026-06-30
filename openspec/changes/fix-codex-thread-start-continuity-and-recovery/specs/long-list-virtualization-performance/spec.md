## MODIFIED Requirements

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

#### Scenario: static history updates do not trigger live auto-follow
- **WHEN** a conversation receives or re-renders static history rows while no turn is working and no assistant finalization is pending
- **THEN** live auto-follow MUST NOT call programmatic bottom scroll solely because those history rows changed
- **AND** live auto-follow MAY resume when active work or assistant finalization is present
