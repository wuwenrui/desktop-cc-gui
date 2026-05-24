## ADDED Requirements

### Requirement: Claude Sidebar Reopen MUST Not Clear Loaded Rows During Late Truth Reconcile

When a Claude sidebar entry is reopened and readable history rows are already loaded, late native truth or catalog reconcile MUST preserve those rows until it can converge to a canonical replacement or explicit failure.

#### Scenario: late reconcile cannot blank issue-shaped Claude history
- **WHEN** a user clicks a Claude sidebar entry for an issue-shaped second-turn session
- **AND** history load returns readable rows for that entry
- **AND** native truth or workspace catalog reconciliation finishes later
- **THEN** the selected conversation MUST keep the readable rows or converge to the canonical replacement rows
- **AND** it MUST NOT clear the conversation into a blank surface without an explicit recoverable failure state

#### Scenario: authoritative removal still wins
- **WHEN** native truth proves the Claude session is deleted, archived, hidden, or out of the current workspace scope
- **THEN** sidebar parity recovery MUST remove or suppress the row
- **AND** it MUST NOT preserve last-good rows as if the session still existed
