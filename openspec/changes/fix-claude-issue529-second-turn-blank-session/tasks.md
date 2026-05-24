## 1. Reproduction And Backend Truth

- [x] 1.1 Add or extend a focused Claude history fixture that models Issue #529 second-turn transcript shape; input: synthetic JSONL with first turn, synthetic resume rows, second user, tool-use, final assistant; output: restored messages are non-empty and synthetic rows are hidden; validation: focused Rust test.
- [x] 1.2 Verify Claude session listing/source fact projection keeps the same canonical session identity when rows omit explicit `session_id`; input: filename + `cwd` evidence; output: listed summary can be used to load the same session; validation: focused Rust test.

## 2. Frontend Activation And Surface Preservation

- [x] 2.1 Add a focused frontend activation/reopen regression for an issue-shaped Claude session; input: mocked history load/catalog rows; output: selected thread keeps readable rows after late reconcile; validation: focused Vitest.
- [x] 2.2 Apply the smallest needed code fix in the existing Claude thread action/session catalog path; input: failing test evidence; output: no blank selected thread after successful history load; validation: focused Rust/Vitest.

## 3. Guardrails

- [x] 3.1 Run focused backend/frontend tests for touched paths and strict OpenSpec validation; output: command results recorded.
- [x] 3.2 Confirm Codex behavior is unchanged by either focused existing test coverage or no touched Codex runtime path; output: final notes document the boundary.
