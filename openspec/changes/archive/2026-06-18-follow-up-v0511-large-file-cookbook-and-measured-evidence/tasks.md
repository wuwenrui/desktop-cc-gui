## 1. Large-file wave3

- [x] Split `src/services/tauri.ts` session wrappers into `src/services/tauri/session.ts`.
- [x] Split permission wrappers into `src/services/tauri/permission.ts`.
- [x] Split app-server wrappers into `src/services/tauri/appServer.ts`.
- [x] Preserve `src/services/tauri.ts` public facade and existing import compatibility.
- [x] Extract `useFileTreeViewState.ts` from `FileTreePanel.tsx`.
- [x] Extract `FileTreeRefreshControls.tsx` from `FileTreePanel.tsx`.
- [x] Run `npm run check:large-files`; no new module may enter near-threshold advisory debt.

## 2. Recovery cookbook

- [x] Update `.trellis/spec/backend/codex-provider-scoped-runtime.md` with recovery failure playbook.
- [x] Document `staleRecoveryClassification.reasonCode` / `staleReason` / `userAction`.
- [x] Add GEMINI / CLAUDE provider recovery template.
- [x] Link the cookbook back to `codex-stale-thread-binding-recovery` and `codex-message-recovery-hook`.

## 3. Measured evidence producers

- [x] Add runtime producers for at least 10 remaining proxy metrics, or explicitly document why each cannot be measured yet.
- [x] Keep unsupported/proxy rows honest when no real source artifact exists.
- [x] Update `scripts/perf-v0511-runtime-evidence.test.mjs` for every producer.
- [x] Regenerate `docs/perf/v0511-runtime-evidence.json` and aggregate perf reports.

## 4. Validation

- [x] `npm run typecheck`
- [x] `npm run lint`
- [x] `npm run check:large-files`
- [x] `node --test scripts/perf-v0511-runtime-evidence.test.mjs scripts/perf-archive-readiness.test.mjs`
- [x] `npm run perf:baseline:all`
- [x] `npm run perf:archive-readiness -- --json`
- [x] `openspec validate follow-up-v0511-large-file-cookbook-and-measured-evidence --strict --no-interactive`
