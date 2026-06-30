## 1. Refresh Isolation

- [x] 1.1 [P0][input: `src/features/models/refreshCodexModelConfig.ts`][output: Codex model selector refresh no longer calls runtime reload][verify: `vitest run src/features/models/refreshCodexModelConfig.test.ts`] Remove `reloadCodexRuntimeConfig` from selector catalog refresh and update focused tests.
- [x] 1.2 [P0][depends: 1.1][input: `src/features/vendors/hooks/useCodexProviderManagement.ts`][output: provider add/edit/delete/switch paths do not implicitly restart active Codex runtime][verify: focused hook/test or static assertion] Guard provider management from calling `reloadCodexRuntimeConfig` except explicit settings reload actions.

## 2. Provider Model Catalogs

- [x] 2.1 [P0][input: `src/features/composer/components/ChatInputBox/modelOptions.ts`][output: Codex hydrated catalog still includes custom models][verify: `vitest run src/features/composer/components/ChatInputBox/modelOptions.test.ts`] Merge Codex custom models into dynamic/hydrated catalogs with dedupe.
- [x] 2.2 [P0][depends: 2.1][input: `useEngineController`, `useAppShellComposerModelSection`, Composer props][output: grouped selector receives provider-scoped model catalogs][verify: focused model selection tests] Pass per-provider catalog facts so non-active Claude/Codex groups can render their own models.
- [x] 2.3 [P1][input: `src/features/vendors/hooks/useCodexProviderManagement.ts`, `VendorSettingsPanel` custom model storage][output: provider-scoped Codex custom models sync into composer-visible catalog after load/save][verify: vendor/provider focused tests] Merge provider `customModels` into global Codex custom model store without duplicates.

## 3. Validation

- [x] 3.1 [P0][depends: 1.x,2.x][input: changed frontend files][output: focused tests pass][verify: `vitest run src/features/models/refreshCodexModelConfig.test.ts src/features/composer/components/ChatInputBox/modelOptions.test.ts`] Run focused test suites and fix regressions.
- [x] 3.2 [P0][depends: 3.1][input: OpenSpec change][output: strict OpenSpec validation passes][verify: `openspec validate --changes fix-provider-model-catalog-and-codex-refresh-isolation --strict --no-interactive`] Validate the OpenSpec change.
- [x] 3.3 [P1][depends: 3.1][input: TypeScript project][output: type contracts remain valid][verify: `npm run typecheck`] Run typecheck or report blocker.
