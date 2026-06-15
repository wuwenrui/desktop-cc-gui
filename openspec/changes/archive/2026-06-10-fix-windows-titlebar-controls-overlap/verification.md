# Verification

## Automated Checks

Executed on 2026-06-10:

```bash
npx vitest run src/styles/layout-swapped-platform-guard.test.ts src/features/layout/components/SidebarToggleControls.test.tsx
openspec validate fix-windows-titlebar-controls-overlap --strict --no-interactive
npm run typecheck
npm run lint
npm run check:large-files
```

Results:

- Focused Vitest: passed, 2 files / 14 tests.
- OpenSpec strict validation: passed for `fix-windows-titlebar-controls-overlap`.
- TypeScript typecheck: passed.
- ESLint: passed.
- Large-file gate: passed, found 0 fail-scope violations.

## Manual / Platform Notes

- Windows runtime visual confirmation is still recommended because this environment is macOS/local development.
- Expected Windows visual outcome: minimize/maximize/close remain at the far-right edge; the swapped floating sidebar restore control is offset left by the window-controls safe zone plus gap.
