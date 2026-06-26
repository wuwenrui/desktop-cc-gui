## 1. Provider Origin Propagation

- [x] 1.1 [P0] Extend Codex model/custom model TypeScript types with optional `providerProfileId` input/output contract; verify existing disk/config-derived call sites compile unchanged.
- [x] 1.2 [P0] Populate `providerProfileId` when `useCodexProviderManagement` merges managed-provider custom models into the Codex model catalog; verify equivalent model de-duplication still preserves the custom label.
- [x] 1.3 [P0] Expose selected Codex model origin through `composerSelectionResolverRef` so Composer target summary and send path share the same provider binding fact.

## 2. First-Send Thread Creation

- [x] 2.1 [P0] Pass `providerProfileId` from resolved Composer selection into `startThreadForMessageSend` only for Codex first-send thread creation.
- [x] 2.2 [P0] Preserve existing behavior for active-thread sends, disk models, and selections with no provider origin.

## 3. Create-Session Loading Timeout

- [x] 3.1 [P0] Add a bounded client-side timeout to `useCreateSessionLoading` with a diagnosable timeout error and normal cleanup.
- [x] 3.2 [P1] Keep original action rejection semantics when the create-session action fails before the timeout.

## 4. Verification

- [x] 4.1 [P0] Add focused tests for provider origin propagation and Codex first-send provider handoff.
- [x] 4.2 [P0] Add focused tests for create-session loading success, failure, and timeout cleanup.
- [x] 4.3 [P0] Run `openspec validate fix-codex-provider-composer-cold-start-binding --strict --no-interactive`.
- [x] 4.4 [P0] Run focused Vitest suites for touched frontend behavior and `npm run typecheck`.
