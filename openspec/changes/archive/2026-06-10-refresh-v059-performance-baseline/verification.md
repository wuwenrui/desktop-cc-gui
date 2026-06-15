# Verification / 验证记录

## Environment / 环境

- Branch: `feature/v0.5.9`
- Package version: `ccgui@0.5.9`
- Baseline commit recorded in artifacts: `70390d1e06851a4355140604506ea24f7ba4db2d`
- Roadmap source: `docs/perf/v0.5.8-performance-optimization-roadmap.md`

## Commands / 命令

- `npm run perf:baseline:all` passed。
- `npm run check:bundle-chunking` passed，输出 `[bundle-chunking] ok`。
- `npm run perf:long-list:browser-scroll` passed，`browserScrollFrameDropPct` 记录为 measured evidence。
- `node --test scripts/generate-runtime-evidence-report.test.mjs` passed，5 tests passed。
- `openspec validate refresh-v059-performance-baseline --strict --no-interactive` passed。

## Evidence / 证据

- `docs/perf/baseline.{json,md}` 已刷新为 `v0.5.9`。
- `docs/perf/history/v0.5.9-baseline.{json,md}` 已写入 canonical history copy。
- `docs/perf/baseline.json` 包含 `comparison.status = "available"`，source 为 `docs/perf/history/v0.5.6-baseline.json`。
- `docs/perf/baseline.json` 中 7 个 metrics 包含 structured `budget` metadata。
- `docs/perf/runtime-evidence-gates.{json,md}` 已重新生成，包含 `Target` / `Hard Fail` budget columns。
- `S-CS-COLD/firstPaintMs` 与 `S-CS-COLD/firstInteractiveMs` 仍保持 `unsupported`，未伪造成 measured。

## Notes / 说明

- `npm` 输出了既有 config warning：`Unknown user config "electron_mirror"` / `Unknown env config "electron-mirror"`。命令本身通过，本 change 未处理 npm config hygiene。
- 当前 evidence 仍包含大量 fixture/proxy metric；这些只适合作 regression comparison，不是 release-grade runtime proof。
