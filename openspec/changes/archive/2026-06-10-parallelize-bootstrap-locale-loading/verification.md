# Verification / 验证记录

## Commands / 命令

- `npx vitest run src/bootstrapApp.test.tsx src/i18n/index.test.ts src/features/settings/components/LanguageSelector.test.tsx src/features/spec/specHubLanguageSwitch.test.ts` passed，8 tests passed。
- `npm run typecheck` passed。
- `npm run lint` passed。
- `npm run build` passed。
- `npm run check:bundle-chunking` passed。
- `openspec validate parallelize-bootstrap-locale-loading --strict --no-interactive` passed。
- 2026-06-10 rerun: focused tests、typecheck、lint、build、bundle chunking、strict OpenSpec validate all passed。

## Evidence / 证据

- `src/bootstrapApp.tsx` now starts `import("./App")`, current-locale `i18nReady`, and `preloadClientStores` without unnecessary serial waits。
- `migrateLocalStorageToFileStore` and `initInputHistoryStore` now run after shell render as post-render bootstrap tasks。
- `src/i18n/index.ts` no longer statically imports both `en` and `zh` startup resources。
- `src/i18n/index.test.ts` verifies startup loads only stored locale and `changeLanguage("en")` loads the target locale on demand。
- Production build emitted separate locale chunks such as `zh-*.js` and `en-*.js`。

## Manual QA / 人工验证

- 2026-06-10 user-run desktop smoke passed: app startup, renderer-ready observation, composer typing before/after input history hydration。
- No startup/input-history regression was reported in the manual pass。

## Notes / 说明

- `npm run build` still reports the pre-existing Vite warning that `FileViewPanel.tsx` is both dynamically and statically imported. This belongs to the later file-preview heavy dependency P0, not this bootstrap/i18n change。
- App gzip remained around `1.30 MiB`; the direct improvement here is startup request timing/current-locale loading, not main chunk size reduction。
