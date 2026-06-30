## ADDED Requirements

### Requirement: Heavy Message Row Hydration MUST Preserve Stable Row Identity

Heavy-row summary, placeholder, hydration, and failure states MUST preserve stable message-row identity and MUST NOT invalidate unrelated completed rows.

#### Scenario: hydration does not change row identity
- **WHEN** a completed heavy message row transitions from summary or placeholder to hydrated detail
- **THEN** the row key, message id, item id, and canonical row identity MUST remain stable
- **AND** virtualization measurement MAY update only the affected row and MUST NOT force unrelated completed rows to remount

#### Scenario: summary actions use canonical payloads
- **WHEN** a heavy row is rendered as a summary, placeholder, or local fallback
- **THEN** copy, export, open-file, open-diff, fork, rewind, and anchor actions MUST use canonical conversation data where those actions are available
- **AND** those actions MUST NOT read truncated placeholder text as the source of truth

#### Scenario: non-visible heavy hydration does not rerender unchanged rows
- **WHEN** one heavy row hydrates, fails, retries, or collapses
- **THEN** unchanged completed rows outside that row MUST keep their memo boundary when their row-affecting fields are unchanged
- **AND** live rows MAY continue to update independently through existing live rendering rules

#### Scenario: stale heavy-row resources are cleaned up
- **WHEN** a heavy row leaves the viewport for longer than the documented retention window, the selected thread changes, or the row content hash changes
- **THEN** stale hydration state, queued work, measurement data, and async result handlers for the old row version MUST be released or ignored
- **AND** cleanup MUST NOT mutate canonical conversation data or remount unrelated completed rows
