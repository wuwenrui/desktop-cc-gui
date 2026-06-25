## Context

历史会话的 lightweight mode 是为 render-heavy timeline 减少 Markdown、tool output、diff 等重内容渲染成本。当前实现会把 heavy projection row 替换为 `messages-lightweight-row-summary`，但 virtualizer wrapper 仍可能保留旧的 measured size，并通过 `minHeight` 撑出大段空白。进一步的视觉回归表明，问题不只在 row height：`show earlier history` 仍在使用基于 `scrollHeight delta` 的 viewport restore，而 lightweight operation bar / history sticky header 又渲染在 `messages-full` 之外，导致展开历史后出现 viewport 抖动、顶部卡片裁剪，以及 banner / sticky / rows 分属不同 top-offset contract 的重叠问题。

## Goals / Non-Goals

**Goals:**

- 让 lightweight summary row 的视觉高度与 virtualized placeholder height 一致压缩。
- 在 lightweight/detail hydration 切换时用 bounded remeasure 收敛 virtualizer size cache。
- 将 lightweight mode banner 变成 compact mode bar，并让顶部 operation surfaces 与 rows 共享同一 padded flow contract。
- 在点击 `show earlier history` 后切入稳定历史展开模式，避免 viewport restore / top inset hack 引发抖动、空白和裁剪。
- 保留现有 render-safe、live row override、sticky history pinning 的数据与行为契约。

**Non-Goals:**

- 不重写 `useVirtualizer` 接入方式。
- 不改变 `ConversationItem`、history loader、runtime events 或 Tauri commands。
- 不改变 heavy row 判定阈值与 lightweight mode 启用策略。

## Decisions

### Decision 1: Lightweight summary row uses compact virtual placeholder height

采用 feature-local helper 判断当前 row 是否将渲染 lightweight summary。虚拟行 wrapper 计算 `placeholderHeight` 时，如果命中 lightweight summary，使用专用 compact height estimate，而不是旧 `virtualRow.size`。

Alternatives considered:

- 只调 CSS：无法覆盖 virtualizer old measured size。
- 全量 `measure()` 后依赖真实 DOM 高度：仍可能先出现大洞，且切换时机不稳定。

### Decision 2: Bounded remeasure on lightweight mode signature changes

新增 lightweight row signature，当 lightweight row 集合、detail hydration 状态或 mode 状态变化时，通过 existing RAF pattern 触发一次 `timelineVirtualizer.measure()`。这复用当前 timeline 中已有的 bounded remeasure 思路，不引入新的 scheduler。

Alternatives considered:

- 每个 row ref 单独测量：代码更复杂，且容易和 `measureElement` 重复。
- 禁用 virtualization：违背性能目标。

### Decision 3: Expanded history switches to stable document flow without scroll-height restore

`show earlier history` 是一个显式“查看更早内容”的动作，不应继续维持“插入内容后保住原 viewport”的 infinite-scroll 语义。历史展开后统一退出 absolute virtual canvas，改用 stable document flow；手动展开不再执行 `scrollHeight delta` restore，而是让 viewport 回到 revealed history head。只有 jump-to-message 触发的隐式展开才继续由 anchor scroll 接管定位。

Alternatives considered:

- 保留 `scrollHeight delta` restore：会持续把新揭示的顶部 operation card 推出 viewport，上下抖动也会和 layout mode 切换相互放大。
- 继续只在 lightweight mode 下关闭 virtual canvas：普通长历史线程仍会保留 absolute row canvas，无法彻底消掉展开后的空白和重叠。

### Decision 4: Top operation surfaces move into the shared `messages-full` flow

lightweight mode bar 与 history sticky header 必须跟 timeline rows 共享同一 top-padding / topbar contract。实现上把这些顶部 surfaces 移入 `messages-full`，删除针对 timeline root 的额外 top inset hack，并让 history sticky header 继续只锚定 `main-topbar-height`，不再依赖“lightweight bar 额外偏移 36px”的补丁。

Alternatives considered:

- 在 timeline root 继续追加 `padding-top` / `scroll-padding-top`：只能制造新的空白，无法解决 top surfaces 与 rows 使用不同 padding contract 的根问题。
- 继续把 banner 留在 `messages-full` 外，只调 sticky `top`：会反复回到“顶部卡片被吃掉/被覆盖”的 offset patch 循环。

## Risks / Trade-offs

- [Risk] Compact estimate 过低导致 summary row 内容溢出。→ Mitigation: summary row 保持单行/紧凑 wrapping，并在 mode 切换后触发 remeasure。
- [Risk] 手动展开后 viewport 回到历史头部，和过去“尽量保住原视口”的行为不同。→ Mitigation: 该动作本身语义就是 reveal earlier messages；jump-to-message 路径仍保留 anchor 定位。
- [Risk] 测试环境无法真实测量 layout。→ Mitigation: 用 DOM attributes / helper tests 锁定 placeholder path 与 data contract，CSS 用 focused selector tests。

## Migration Plan

1. 添加 helper 与 CSS contract。
2. 把 expanded history 的 manual reveal / jump reveal 分开，移除错误的 viewport restore。
3. 更新 focused tests。
4. 运行 OpenSpec validation、focused Vitest、typecheck。

Rollback: revert touched frontend files and this OpenSpec change; no persisted data migration is involved.

## Open Questions

- None.
