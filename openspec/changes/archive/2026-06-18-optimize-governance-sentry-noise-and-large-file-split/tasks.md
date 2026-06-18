## 1. OpenSpec contract

- [x] 1.1 Create proposal/design/spec/tasks for governance sentry optimization.
- [x] 1.2 Validate the change with `openspec validate optimize-governance-sentry-noise-and-large-file-split --strict --no-interactive`.

## 2. Large-file hard debt split

- [x] 2.1 Extract boundary-owned Tauri service modules from `src/services/tauri.ts`.
- [x] 2.2 Preserve `src/services/tauri.ts` as the public facade for existing callers.
- [x] 2.3 Verify `src/services/tauri.ts` no longer exceeds `bridge-runtime-critical` fail threshold.

## 3. CI sentry noise reduction

- [x] 3.1 Update `large-file-governance.yml` so PR/push runs parser tests and hard-debt gate only.
- [x] 3.2 Keep near-threshold watch available as manual or scheduled advisory evidence.
- [x] 3.3 Update `heavy-test-noise-sentry.yml` so log artifact upload is failure-scoped.

## 4. Validation

- [x] 4.1 Run `node --test scripts/check-large-files.test.mjs`.
- [x] 4.2 Run `npm run check:large-files:gate`.
- [x] 4.3 Run near-threshold watch in report mode to confirm advisory output remains available.
- [x] 4.4 Run `node --test scripts/check-heavy-test-noise.test.mjs scripts/test-batched.test.mjs`.
- [x] 4.5 Run `npm run typecheck`.
- [x] 4.6 Run `npm run check:heavy-test-noise`.
