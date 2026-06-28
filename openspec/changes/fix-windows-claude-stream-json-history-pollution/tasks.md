## 1. History Pollution Filtering

- [x] 1.1 Add a backend high-confidence predicate for leaked Claude stream-json stdin payload text.
- [x] 1.2 Apply the predicate through existing Claude history control-plane classification.
- [x] 1.3 Mirror the predicate in the frontend Claude history loader fallback.

## 2. Regression Coverage

- [x] 2.1 Add Rust tests proving polluted stream-json payload rows do not become summary titles or visible messages.
- [x] 2.2 Add frontend Vitest coverage for the same polluted payload shape and normal JSON discussion preservation.

## 3. Scope Correction

- [x] 3.1 Keep Windows packaging warning cleanup out of this history compatibility change.
- [x] 3.2 Keep Claude pending native-session state unchanged in this history compatibility change.

## 4. Verification

- [x] 4.1 Run focused Rust Claude history tests.
- [x] 4.2 Run focused frontend Claude history loader tests.
- [x] 4.3 Run strict OpenSpec validation.

## 5. Polluted Assistant Echo Recovery

- [x] 5.1 Quarantine assistant-side transcript rows after leaked stream-json stdin payloads until the next real user row.
- [x] 5.2 Mirror assistant-side quarantine in the frontend Claude history loader fallback.
- [x] 5.3 Add backend and frontend loader regression tests for polluted assistant echo rows.
- [x] 5.4 Re-run focused tests, typecheck, release check, and strict OpenSpec validation.
