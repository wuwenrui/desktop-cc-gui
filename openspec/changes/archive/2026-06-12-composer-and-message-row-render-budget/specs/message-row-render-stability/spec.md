## ADDED Requirements

### Requirement: Message Rows MUST Use Stable Identity Across Live Updates

Message row rendering MUST keep stable identity for history rows while a live assistant row changes. Memoization MUST be based on explicit ids, versions, and source versions rather than incidental object identity.

#### Scenario: history rows stay stable during live token ingress

- **WHEN** an assistant turn emits a streaming delta for the active live row
- **THEN** rows before the live row SHOULD NOT rerender
- **AND** any unavoidable history row rerender MUST be counted, attributed to a row subtype, and kept within the documented budget.

#### Scenario: derived data is memoized by source version

- **WHEN** a row or timeline projection derives maps, sets, grouped tool data, markdown metadata, or sticky state from row inputs
- **THEN** the derived value MUST be cached by a stable `sourceVersion`
- **AND** unchanged source versions MUST reuse the previous derived value.

#### Scenario: row subtype boundaries preserve behavior

- **WHEN** a row subtype is wrapped in a memo boundary or split into a child component
- **THEN** existing visual behavior, accessibility labels, actions, and copy/export behavior MUST remain equivalent
- **AND** the change MUST include a focused regression test for that subtype or an explicit manual-only qualifier.

### Requirement: Message Row Render Budgets MUST Be Reported As Content-Safe Evidence

Renderer diagnostics and runtime evidence gates MUST expose message-row render budget fields without recording conversation content.

#### Scenario: row render counts are reported per thread

- **WHEN** renderer diagnostics emit a message-row budget report
- **THEN** the report MUST include active thread id, live row render count, history row render count, affected subtype ids, evidence class, and sample window
- **AND** it MUST NOT include prompt text, assistant body text, tool output, or file content.

#### Scenario: gate distinguishes proxy from measured evidence

- **WHEN** render counts come from fixture or jsdom tests
- **THEN** the evidence class MUST be `proxy`
- **AND** the gate MUST NOT describe it as release-grade measured runtime proof.
