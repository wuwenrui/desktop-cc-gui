## ADDED Requirements

### Requirement: Timeline Virtualization SHALL Account For Render Weight

Timeline virtualization SHALL consider render weight in addition to row count so image-heavy or long-content conversations can bound renderer memory and layout work before reaching the large-row threshold.

#### Scenario: image-heavy timeline virtualizes before row-count threshold
- **WHEN** a conversation contains message images, deferred image placeholders, generated image cards, or other image-heavy rows
- **AND** the row count is below the normal long-list threshold
- **THEN** the timeline MAY enable virtualization based on accumulated render weight
- **AND** message order, identity, actions, anchor navigation, and scroll restoration MUST remain based on canonical conversation state

#### Scenario: active streaming row remains reachable under weighted virtualization
- **WHEN** weighted virtualization is enabled while a turn is active
- **THEN** the active live row MUST remain visible or reachable through the existing live-row override semantics
- **AND** virtualization MUST NOT reset live text, copy/fork/rewind controls, or user scroll intent
