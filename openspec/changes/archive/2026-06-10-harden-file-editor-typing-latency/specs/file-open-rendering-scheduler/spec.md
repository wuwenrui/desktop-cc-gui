## MODIFIED Requirements

### Requirement: Editor line-range tracking MUST not block cursor interaction

Editor cursor, selection, and typing changes MUST keep the file editor responsive and MUST NOT synchronously force cross-surface recomputation for every line click, cursor move, selection change, or keystroke.

#### Scenario: editor line affordance updates locally first
- **WHEN** the user clicks, types on, or selects a different line in editor mode
- **THEN** the file panel MAY update its local line label and annotation affordance immediately
- **AND** that local update MUST NOT require app-shell or Composer active-file reference state to round-trip first

#### Scenario: composer file reference publication is delayed and coalesced
- **WHEN** editor line range changes repeatedly through typing, clicks, cursor movement, or drag selection
- **THEN** the global active-file line reference consumed by Composer/context ledger MUST be published through a delayed, coalesced, or low-priority path
- **AND** intermediate line ranges MAY be dropped as long as the latest range is available before send/context injection

#### Scenario: delayed editor range publication cannot target stale files
- **WHEN** the active file, view surface, or component mount state changes while a line-range publication is pending
- **THEN** the pending publication MUST be cancelled or ignored
- **AND** it MUST NOT publish a stale line range for a previously active file

