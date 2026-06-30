## 1. Implementation

- [x] 1.1 Re-check `Messages.tsx` state synchronization paths that can replay during active streaming; input is the React `#185` stack and current message render code, output is the minimal risky updater list, validation is code inspection against the render contract.
- [x] 1.2 Add idempotent guards for semantically unchanged `Set`-backed helper state; input is existing `expandedItems` logic, output is a minimal frontend diff, validation is TypeScript compile through focused tests.

## 2. Verification

- [x] 2.1 Add a regression test for repeated semantically identical active streaming renders; input is `Messages` test harness, output is a failing-before/passing-after test.
- [x] 2.2 Run focused Vitest for the touched message test file and OpenSpec validation for this change; output is command evidence.
