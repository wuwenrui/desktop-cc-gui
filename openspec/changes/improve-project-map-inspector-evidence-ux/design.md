## Context

Project Knowledge Map 已经具备 graph、inspector、Task queue、generation worker、persistence 和 i18n substrate。当前问题集中在 inspector 可用性：顶部和详情里都有 `Refresh` 语义，候选只显示数量，证据链只能看不能追，详情宽度不足导致结构化内容被压成窄列。

本变更是前端窄 scope UX 收口，不改变生成 worker、不改变 persistence schema、不引入新依赖。

## Goals / Non-Goals

**Goals:**

- 清理低价值 Refresh 入口，让操作层级聚焦到 Collect / Task / Complete / Calibrate。
- 让 candidate badge 成为候选定位入口，而不是只显示数字。
- 为 candidate node 增加解释性 notice，降低“候选是否已生效”的认知成本。
- 扩大 inspector 展开宽度约 50%，提升证据链阅读效率。
- 将 related artifacts 与 evidence sources 渲染成可追溯的 link-style chip/button。
- 下钻进入下层后提供“返回上次”路径，避免用户只看到下层视图却不知道如何回到刚才的上下文。
- 收紧 graph layout 的 overview/focus 半径与 collision gap，在不重叠前提下降低节点之间的空旷感。
- 将画布控制与详情返回控制收敛成 button group，并移除中英混排的冗余按钮文字。

**Non-Goals:**

- 不实现 candidate apply / reject 状态机。
- 不新增打开编辑器、跳转 git commit、打开 conversation 的跨面板导航命令。
- 不修改 ProjectMapNode / ProjectMapSource / ProjectMapRelatedArtifact 类型。
- 不改 AI prompt、worker queue 或 Tauri persistence contract。

## Decisions

### Decision 1: 删除 Refresh 入口，保留 Calibrate 作为 evidence update 主路径

当前 `Refresh evidence` 与 `Calibrate` 对用户而言都像“重新检查这个节点”，但前者语义弱且截图中已经形成冗余。采用删除 topbar refresh 与 detail action refresh 的方案，保留 Calibrate 作为明确的节点级证据更新入口。

Alternative A：保留 Refresh 并改文案。问题是仍会留下两个近似动作。
Alternative B：把 Refresh 合并进 Calibrate 的 secondary menu。当前没有 menu 组件需求，YAGNI。

### Decision 2: Candidate badge 先做定位与解释，不做审核状态机

候选逻辑的核心缺口是“怎么用”。本轮将 badge 改为 button，点击选择第一个 candidate node 并展开 inspector；inspector 里显示 candidate notice，解释 `createCandidate` 默认只是 evidence-backed draft。

Alternative A：直接做完整 candidate drawer + apply/reject。产品更完整，但要牵动 persistence 与 auto-ingestion 状态机，超出本轮 UI 优化。
Alternative B：只补 tooltip。成本低，但不能把用户带到候选内容。

### Decision 3: Evidence link UX 使用现有 metadata 渲染，不新增导航副作用

`ProjectMapRelatedArtifact` 和 `ProjectMapSource` 已有 `type`、`label`、`path`、`line`、`ref`、`hash`、`excerpt`。本轮只把这些字段渲染成 link-style controls：有 trace metadata 的用 button 视觉和 title/secondary text；无 trace metadata 的仍为只读 chip。点击暂不跨面板跳转，避免猜测现有 file/spec/commit navigation contract。

Alternative A：点击直接打开文件或 spec。体验更强，但需要确认跨模块 navigation API，容易猜接口。
Alternative B：全部静态展示。无法解决证据链“link UX”的诉求。

### Decision 4: Inspector 宽度通过 CSS token 局部调整

当前 `.project-map-detail-panel` 固定宽度偏窄。采用 CSS 局部调整，将 expanded width 从当前窄列扩大约 50%，collapsed rail 保持原紧凑宽度，并用 max-width 保护主 canvas。

### Decision 5: Drilldown history 是 UI state，不进入 dataset schema

“返回上次”只描述当前用户在 graph 中的视图导航，不是 ProjectMap 数据事实。采用 component-local `viewHistory` 保存上一帧 `focusNodeId + selectedNodeId`，下钻时 push，返回上次时 pop；返回总览时清空 history。这样不污染 persistence schema，也不会影响 AI 生成 payload。

### Decision 6: 紧凑布局优先调半径，保留 collision resolver

节点距离过远来自 focus/overview 半径和 expanded slots 过大。采用降低 overview hub radius、focus child/context radius、expanded slot offset 与 node gap 的方式收紧布局；不删除 `resolveGraphNodeCollisions()`，继续把“不重叠”作为硬约束。

### Decision 7: 同类导航按钮使用 button group，不再堆叠

缩放、重置、返回上次/上层都属于当前画布视图控制；详情里的收起详情、返回上次/上层、返回总览都属于当前 inspector 视图控制。采用横向 button group 合并同类动作，减少垂直占位，并把中文 locale 中的 `Back / Reset / Zoom` 等英文辅助词移除，避免按钮看起来像两个动作。返回逻辑不能只依赖 history stack；当 focus view 没有历史栈时，必须提供返回父层/总览的 fallback。

## Risks / Trade-offs

- [Risk] `ProjectMapPanel.tsx` 已较大，继续加 JSX 会加剧复杂度。→ Mitigation：只新增小型 helper component / pure formatting helper，不抽跨 feature abstraction。
- [Risk] link-style button 没有真实跳转可能被误解。→ Mitigation：文案和样式表达为 trace/control，当前只承载可复制/可读路径，不伪装成外部链接。
- [Risk] inspector 变宽影响窄屏 canvas。→ Mitigation：CSS 使用 `clamp` / max-width，collapsed rail 不变。
- [Risk] 布局收紧可能导致拥挤数据集节点重叠。→ Mitigation：保留 collision resolver，并用 component test 覆盖 crowded overview / focused graph 不重叠。
- [Risk] button group 合并后按钮变宽可能遮挡 canvas。→ Mitigation：只合并左上角低数量控制项，并使用 compact padding / overflow hidden 分隔。

## Migration Plan

1. 更新 `ProjectMapPanel.tsx` action hierarchy、candidate button、candidate notice、artifact/source rendering、drilldown view history。
2. 更新 `project-map.css` inspector width、candidate notice、trace chip、button group、返回上次控件样式和紧凑布局常量。
3. 更新 zh/en i18n 文案。
4. 更新 focused component tests。
5. 运行 OpenSpec 与前端验证。

Rollback：恢复本 change touched files 即可；无数据迁移与 schema 变化。

## Open Questions

- Candidate apply / reject 是否进入下一轮独立 change。
- Evidence trace click 后是否应打开 File Viewer、Spec Hub 或 Git History；这需要先查清并统一跨面板 navigation contract。
