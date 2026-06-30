## 1. Implementation

- [x] 1.1 P1: Extend stale settlement classification in `useThreadUserInput.ts`; input is runtime error + response + timeout-aware settlement context, output is pending queue cleanup for stale request.
- [x] 1.2 P1: Wire timeout-aware submit/skip handling in `RequestUserInputMessage.tsx`; input is local `0:00` countdown, output is local card settlement without fatal error when runtime reports stale.

## 2. Tests

- [x] 2.1 P1: Add hook tests for timed-out submit stale cleanup and ordinary submit failure retry behavior.
- [x] 2.2 P1: Add component tests for `0:00` Submit / Skip stale cleanup.

## 3. Verification

- [x] 3.1 P1: Run focused Vitest for touched hook/component suites.
- [x] 3.2 P1: Run `npm run typecheck`.
- [x] 3.3 P1: Run `openspec validate fix-user-input-stale-submit-settlement --strict --no-interactive`.
