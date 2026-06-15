# Parallelize Bootstrap Locale Loading

## Goal

执行 OpenSpec change `parallelize-bootstrap-locale-loading`，缩短 renderer pre-render critical path，并将 startup locale loading 收敛为 only current locale。

## Requirements

- Audit bootstrap startup ordering。
- 尽早并行 `import("./App")` 与 current locale initialization。
- 非关键 input history restore/migration 不阻塞 first render，除非发现 correctness invariant。
- `src/i18n` startup path 不再静态导入所有 locale resources。
- 保持 language switch、fallback、saveLanguage behavior。
- 增加或保持 startup trace milestones。

## Acceptance Criteria

- [x] App shell render 不依赖非关键 input history restore。
- [x] Startup 只加载 current locale。
- [x] Language switch tests pass。
- [x] `npm run typecheck` and focused tests pass。

## Verification Notes

- 2026-06-10 rerun: focused startup/i18n/language tests 8/8 passed。
- 2026-06-10 rerun: `npm run typecheck`、`npm run lint`、`npm run build`、`npm run check:bundle-chunking` passed。
- 2026-06-10 rerun: `openspec validate parallelize-bootstrap-locale-loading --strict --no-interactive` passed。
- 2026-06-10 user-run manual desktop startup / renderer-ready / composer typing before-after history hydration smoke test passed。
