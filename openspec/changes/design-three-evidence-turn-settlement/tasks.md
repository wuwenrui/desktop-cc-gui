# Tasks

- [x] 1.1 [P0][Input: 现有 lifecycle/realtime/liveness specs][Output: three-evidence proposal/design][Verify: review design completeness] 固化三证结算顶层设计与 staged rollout。
- [x] 1.2 [P0][Input: conversation lifecycle contract][Output: OpenSpec delta for shared settlement coordinator][Verify: `openspec validate design-three-evidence-turn-settlement --strict --no-interactive`] 记录 lifecycle 层 contract。
- [x] 1.3 [P0][Input: engine runtime contract][Output: OpenSpec delta for evidence normalization][Verify: `openspec validate design-three-evidence-turn-settlement --strict --no-interactive`] 记录跨引擎 adapter 归一化要求。
- [x] 1.4 [P1][Input: realtime diagnostics contract][Output: OpenSpec delta for dry-run diagnostics and long-task protection][Verify: `openspec validate design-three-evidence-turn-settlement --strict --no-interactive`] 记录 diagnostics 与防误伤边界。
- [x] 1.5 [P0][Input: 会话隔离补充要求][Output: scope gate/session isolation design and spec deltas][Verify: `openspec validate design-three-evidence-turn-settlement --strict --no-interactive`] 补充 workspace/thread/turn/runtime lease/foreground ownership 隔离 contract。
- [x] 1.6 [P0][Input: pure decision helper 补充要求][Output: helper interface/side-effect boundary contract][Verify: `openspec validate design-three-evidence-turn-settlement --strict --no-interactive`] 补充纯函数 decision helper 的输入、输出、顺序和副作用边界。
- [x] 1.7 [P0][Input: 前后端职责与丢 terminal event 讨论][Output: reconciliation source/status query/replay contract][Verify: `openspec validate design-three-evidence-turn-settlement --strict --no-interactive`] 重构提案，明确 realtime event delivery 与 authoritative reconciliation 分层。
- [x] 2.1 [P1][Input: proposal/design/spec deltas][Output: follow-up implementation change][Verify: separate implementation plan] 已拆分 Phase 1 implementation change `implement-three-evidence-dry-run-settlement`；后续 Phase 2/3 继续拆分 backend/runtime status query、missed terminal replay、cross-engine parity tests、guarded residue cleanup。
