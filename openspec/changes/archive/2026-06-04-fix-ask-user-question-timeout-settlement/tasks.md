## 1. OpenSpec Contract

- [x] 1.1 Create proposal for stale AskUserQuestion timeout settlement.
- [x] 1.2 Create design for stale classifier and retry-preserving failure boundary.
- [x] 1.3 Add delta spec for user input response roundtrip semantics.

## 2. Frontend Settlement Behavior

- [x] 2.1 Classify already-settled AskUserQuestion timeout/cancel errors narrowly.
- [x] 2.2 Remove pending request on stale timeout/cancel settlement.
- [x] 2.3 Clear optimistic processing residue on stale settlement.
- [x] 2.4 Preserve ordinary submit failure as retryable.

## 3. Regression Coverage

- [x] 3.1 Cover successful submit audit item and request removal.
- [x] 3.2 Cover ordinary submit failure preserving request.
- [x] 3.3 Cover stale dismiss/timeout settlement removing pending request.
- [x] 3.4 Run focused hook tests.
- [x] 3.5 Run `npm run typecheck`.
- [x] 3.6 Run strict OpenSpec validation.
