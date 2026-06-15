# Refresh v0.5.9 Performance Baseline

## Goal

执行 OpenSpec change `refresh-v059-performance-baseline`，为当前 `ccgui@0.5.9` 分支刷新 performance baseline 与 runtime evidence gates。

## Requirements

- 使用当前 `package.json.version` 与 git commit 作为 baseline evidence anchor。
- 运行现有 perf baseline suite，优先复用现有脚本。
- 写入 latest baseline 与 immutable history baseline。
- 保留 `measured` / `proxy` / `unsupported` / `manual-only` evidence class。
- 增加 previous/current comparison 与 budget fields，如现有脚本不支持则补脚本。

## Acceptance Criteria

- [ ] `docs/perf/baseline.{json,md}` 显示 `v0.5.9` 与当前 commit。
- [ ] `docs/perf/history/v0.5.9-baseline.{json,md}` 存在。
- [ ] `docs/perf/runtime-evidence-gates.{json,md}` 已刷新且 evidence class 明确。
- [ ] `openspec validate refresh-v059-performance-baseline --strict --no-interactive` passes。
- [ ] 相关 perf gate 命令结果已记录。

## Technical Notes

- Source roadmap: `docs/perf/v0.5.8-performance-optimization-roadmap.md`。
- Current implementation target: `ccgui@0.5.9`。
