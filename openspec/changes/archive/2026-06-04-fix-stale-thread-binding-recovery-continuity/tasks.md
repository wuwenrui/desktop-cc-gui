## 1. Contract

- [x] 1.1 Create OpenSpec proposal for stale binding continuity regression closure.
- [x] 1.2 Create design describing pure active-thread canonicalization helper.
- [x] 1.3 Add delta spec for active thread map canonicalization before lifecycle use.

## 2. Implementation

- [x] 2.1 Extract active thread map canonicalization decision into a pure helper.
- [x] 2.2 Route `useThreads` active-thread canonicalization effect through the helper.
- [x] 2.3 Preserve existing recovery strategy, UI actions, and runtime retry semantics.

## 3. Validation

- [x] 3.1 Run focused thread storage regression tests.
- [x] 3.2 Run focused `useThreads` regression tests if production hook behavior changes require it.
- [x] 3.3 Run `npm run typecheck`.
- [x] 3.4 Run strict OpenSpec validation for this change.
