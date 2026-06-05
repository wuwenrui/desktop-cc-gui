## 1. Contract

- [x] 1.1 Create OpenSpec proposal for live user-question pinning closure.
- [x] 1.2 Document existing shared sticky header and bounded live-window design.
- [x] 1.3 Add spec delta for regression coverage and display-only boundary.

## 2. Implementation Review

- [x] 2.1 Confirm live sticky candidates are derived from ordinary user messages.
- [x] 2.2 Confirm live tail window preserves the latest sticky user candidate.
- [x] 2.3 Confirm `MessagesTimeline` uses the shared condensed history sticky header.
- [x] 2.4 Confirm memory-only / pseudo-user rows are excluded from sticky candidates.

## 3. Validation

- [x] 3.1 Run focused live-window utility tests.
- [x] 3.2 Run focused Messages live behavior tests.
- [x] 3.3 Run `npm run typecheck`.
- [x] 3.4 Run strict OpenSpec validation for this change.
- [x] 3.5 Run full strict OpenSpec validation.
