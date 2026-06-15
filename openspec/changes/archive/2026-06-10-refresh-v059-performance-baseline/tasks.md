# Tasks / 任务

## Planning / 规划

- [x] 确认当前 package version 与 git commit。
- [x] 记录 roadmap source 为 `docs/perf/v0.5.8-performance-optimization-roadmap.md`，执行目标为 `ccgui@0.5.9`。

## Implementation / 实施

- [x] 运行 `npm run perf:baseline:all`。
- [x] 写入 immutable `docs/perf/history/v0.5.9-baseline.json` 与 `docs/perf/history/v0.5.9-baseline.md`。
- [x] 更新 latest `docs/perf/baseline.json` 与 `docs/perf/baseline.md`。
- [x] 重新生成 `docs/perf/runtime-evidence-gates.json` 与 `docs/perf/runtime-evidence-gates.md`。
- [x] 增加 `v0.5.6 -> v0.5.9` comparison table。
- [x] 增加 observed、target、hardFail、evidenceClass budget fields。

## Validation / 验证

- [x] 运行 `npm run check:bundle-chunking`。
- [x] 运行 `npm run perf:long-list:browser-scroll`，若不支持则记录 unsupported evidence。
- [x] 运行 `openspec validate refresh-v059-performance-baseline --strict --no-interactive`。
- [x] 人工 review generated markdown，确认 proxy/unsupported 没有被包装成 measured。
