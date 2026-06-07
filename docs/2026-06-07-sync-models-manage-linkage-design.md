# Sync Models ↔ 管理模型 联动设计

日期: 2026-06-07
范围: lawyer-copilot 桌面端 · 供应商管理 · Claude Code 标签页
状态: 已确认，待出实施计划

## 1. 背景与问题

供应商管理面板的 Claude 标签页有两个独立功能：

- **Sync Models from Site**: 从当前激活 Claude 供应商的站点拉取可用模型，弹出 `SiteModelPicker` 选择并写入配置。
- **管理模型 (自定义模型)**: 通过 `CustomModelDialog` 增删改一份"自定义模型"列表，计数显示在 `自定义模型 (N)` 徽标上。

二者当前**完全没有联动**，且存在一处错配：

- 弹窗多选列表（`SiteModelPicker.tsx:94-113`，区块标题写死 `Codex Models`）的勾选项，确认时被并入 **`codex-custom-models`**（`VendorSettingsPanel.tsx:200-209`）。
- 但 Claude 标签页的 `自定义模型 (N)` 徽标与"管理模型"弹窗读写的是 **`claude-custom-models`**（`VendorSettingsPanel.tsx:126`）。
- 弹窗打开时勾选集恒为空（`SiteModelPicker.tsx:26`），不会预勾选用户已有的模型。

结果：在 Claude 页同步模型，既不会预勾选已维护的模型，勾选的新模型也不会进入该页的"管理模型"列表。

## 2. 目标

让 Sync 弹窗的多选列表与**当前标签页引擎**的"管理模型"列表双向联动：

1. 打开弹窗时，按管理模型列表**预勾选**已有模型。
2. 确认时，新勾选的模型**加入**管理模型；取消勾选的模型**移除**——但仅作用于本次站点返回的模型，避免误删用户手动添加、本次站点未返回的模型。
3. 写回与 `CustomModelDialog` 同源同存储，徽标计数与管理模型弹窗自动刷新。

非目标（本次不做）：

- Codex / Gemini 标签页的 Sync（当前无 Sync 按钮）。
- 改动 Claude 槽位映射（haiku/sonnet/opus）逻辑或其 `canConfirm` 三槽位必填门槛。
- 把槽位选中的模型并入管理模型。
- 把 localStorage 自定义模型迁移到 Rust 后端。

## 3. 现状数据流（已查证）

| 环节 | 位置 |
|---|---|
| Sync 按钮 → `handleSyncSiteModels` | `VendorSettingsPanel.tsx:145-171` |
| 拉取站点模型 `fetchSiteModels` → Tauri `fetch_site_models` → `GET {baseUrl}/v1/models` Bearer 鉴权 | `services/tauri/vendors.ts:106-114` · `src-tauri/src/vendors/commands.rs:908-939` |
| 站点模型结构 `SiteModel = { id, owned_by }` | `src-tauri/src/vendors/commands.rs:896-906` |
| 弹窗组件 `SiteModelPicker`（槽位映射 + 多选勾选） | `SiteModelPicker.tsx:18-135` |
| 确认 `handleSiteModelConfirm`：槽位写 provider env + 切换；勾选并入 codex | `VendorSettingsPanel.tsx:173-219` |
| 管理模型数据结构 `CodexCustomModel = { id, label, description? }` | `types.ts:80-84` |
| 存储键 `claude/codex/gemini-custom-models` | `types.ts:8-14` |
| 读写 hook `usePluginModels`（写后派发 `localStorageChange` 事件，跨实例刷新） | `hooks/usePluginModels.ts:69-121` |
| 当前三引擎自定义模型实例 | `VendorSettingsPanel.tsx:126-128` |

## 4. 方案设计

### 4.1 纯函数：mergeSyncedModels

新文件 `src/features/vendors/syncModelMerge.ts`，承载可单测的核心逻辑。

```ts
export function mergeSyncedModels(
  current: CodexCustomModel[],
  fetchedIds: ReadonlySet<string>,
  selectedIds: ReadonlySet<string>,
): CodexCustomModel[] {
  // 1) 保留：不属于本次站点返回的项，或仍被勾选的项（保留原对象，含已设 label/description）
  const kept = current.filter(
    (m) => !fetchedIds.has(m.id) || selectedIds.has(m.id),
  );
  // 2) 新增：被勾选但当前不存在的项（label 默认取 id）
  const keptIds = new Set(kept.map((m) => m.id));
  const added = [...selectedIds]
    .filter((id) => !keptIds.has(id))
    .map((id) => ({ id, label: id }) satisfies CodexCustomModel);
  return [...kept, ...added];
}

export function initialSelectedIds(
  fetched: SiteModel[],
  ownedIds: ReadonlySet<string>,
): Set<string> {
  return new Set(fetched.filter((m) => ownedIds.has(m.id)).map((m) => m.id));
}
```

不变式：

- 站点未返回的现有模型一律保留（`!fetchedIds.has` 分支），永不误删。
- 命中的现有模型保留原对象，不覆盖用户自定义的 label/description。
- 取消勾选且本次返回的模型被移除。
- 结果按 id 去重（kept 已是现有去重列表，added 排除已存在）。

### 4.2 SiteModelPicker 改动

- 新增 prop `ownedModelIds: string[]`（当前引擎已维护模型的 id 列表）。
- 勾选集初始化由 `new Set()` 改为 `initialSelectedIds(models, new Set(ownedModelIds))`。
- 多选区块标题 `Codex Models` 改为中性 `Models`（文件现有为硬编码英文，保持风格，不引入 i18n）。
- 状态/回调更名以反映语义：`codexSelected → selected`、`toggleCodex → toggleModel`。
- `onConfirm` 签名第二参语义由 `codexModels` 改为 `selectedModelIds: string[]`（类型不变，仍为已勾选 id 集）。
- 可选增强：已维护模型行加一个 `已添加` 小徽标（预勾选已能表意，列为可选，不阻塞）。

槽位映射区块、`canConfirm` 三槽位门槛、自动建议逻辑均不变。

注意：`SiteModelPicker` 是共享组件，另一个调用方为 `OnboardingWizard.tsx:152`（首次引导，勾选项写入 `codex-custom-models`）。`ownedModelIds` 为可选属性，引导流程不传 → 行为不变（初始空选）；`onConfirm` 为位置参数，引导流程仍收到勾选 id 数组，语义不变。唯一共享影响是区块标题由 `Codex Models` 改为中性 `Models`（仅文案，无行为变化）。

### 4.3 VendorSettingsPanel 改动

- 渲染 `SiteModelPicker` 处传入 `ownedModelIds={claudeModels.models.map((m) => m.id)}`（Sync 仅 Claude）。
- `handleSiteModelConfirm`（`173-219`）中替换 codex 合并块（`200-209`）：

```ts
const fetchedIds = new Set(siteModels.map((m) => m.id));
const selected = new Set(selectedModelIds);
const next = mergeSyncedModels(claudeModels.models, fetchedIds, selected);
claudeModels.updateModels(next);
```

- 槽位 env 写入（`179-199`：`updateClaudeProvider` + `switchClaudeProvider` + reload）保持不变。
- 移除对 `codexModels` 的依赖（该回调不再写 codex）。

写回后 `usePluginModels` 派发 `localStorageChange`，`自定义模型 (N)` 徽标与"管理模型"弹窗自动刷新（现有机制，无需额外处理）。

## 5. 测试计划

框架 vitest + @testing-library（仿现有 `CustomModelDialog.test.tsx` / `VendorSettingsPanel.test.tsx` / `modelManagerRequest.test.ts`）。

- `syncModelMerge.test.ts`（单元）
  - 新增：勾选站点新模型 → 进入结果且 `label === id`
  - 移除：取消勾选本次返回的已有模型 → 从结果剔除
  - 保留未返回项：管理模型有、站点本次未返回 → 保留不动
  - 保留 label/description：命中的现有项对象原样保留
  - 去重：站点返回与现有重叠时不产生重复
  - 边界：空勾选（全移除本次返回项）、空站点列表、空现有列表
  - `initialSelectedIds`：仅预勾选 owned ∩ fetched
- `SiteModelPicker.test.tsx`（组件）
  - 给定 `ownedModelIds` → 对应行 checkbox 预勾选
  - toggle 勾选/取消生效
  - 确认回调返回正确的 `selectedModelIds` 集
- `VendorSettingsPanel.test.tsx`（集成，扩展）
  - 模拟 Sync 确认 → `claude-custom-models` 被 `mergeSyncedModels` 结果正确写入；不再写 `codex-custom-models`

门槛：覆盖率 ≥ 80%；执行 `npx vitest run <file>`，交付时附文件 + 命令 + 通过数。

## 6. 风险与回滚

- 行为变更：弹窗勾选目标由 `codex-custom-models` 改为 `claude-custom-models`。若历史上有用户依赖"在 Claude 页同步顺带填 Codex 模型列表"，该副作用消失——经确认属错配，按预期修正。
- 数据安全：双向 diff 严格限定在本次站点返回集，手动添加且未返回的模型不受影响，无静默删除既有数据风险。
- 回滚：纯前端改动，回退三文件 + 删新增测试即可，无 DB / 无 Rust 变更。

## 7. 不涉及

- 无数据库变更（DDL / 迁移 / 索引）。
- 无 Rust / Tauri 命令变更（复用现有 `fetch_site_models`）。
- 无跨仓库接口契约变更（不动 new-api、lawhub）。
