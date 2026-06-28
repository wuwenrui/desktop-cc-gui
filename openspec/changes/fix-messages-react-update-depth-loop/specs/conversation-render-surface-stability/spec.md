## ADDED Requirements

### Requirement: Message Render Helper State MUST Be Idempotent

Conversation message rendering MUST avoid committing semantically unchanged helper state from effects, layout effects, timers, or RAF callbacks, especially for `Set` / `Map` / array-backed UI state used by expansion, anchors, and streaming presentation helpers.

#### Scenario: repeated streaming render does not exceed React update depth

- **WHEN** an active conversation rerenders repeatedly with the same workspace, thread, live reasoning ids, and visible message semantics
- **THEN** the message render surface MUST NOT submit a new helper state object solely because an input array or derived collection received a new reference
- **AND** React MUST NOT reach `Maximum update depth exceeded`

#### Scenario: changed helper state still commits

- **WHEN** a genuinely new reasoning, explore, anchor, or message id changes the intended helper state
- **THEN** the message render surface MUST commit the new helper state
- **AND** existing live row visibility and latest reasoning auto-expand behavior MUST remain intact
