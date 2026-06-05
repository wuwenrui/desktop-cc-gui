# Proposal: Enhance File Tree Management Actions

## Why

当前文件树已经具备文件导航、新建、删除、创建副本等局部能力，但这些能力没有形成一致的 file management contract：`Duplicate` 只是一条孤立 command，`Copy/Paste/Rename` 缺失，失败路径容易被前端 silent catch 吞掉，用户无法判断操作是否成功。

Issue #644 暴露的不是单个菜单项缺失，而是文件树作为桌面客户端核心入口时，缺少专业文件管理器的最小闭环。该变更将文件树从“项目文件浏览器”升级为“受限、安全、可诊断、跨平台一致的 workspace file management surface”。

## 背景与现状

当前实现事实：

- `FileTreePanel` 已经有 `Duplicate` 菜单项，调用 `copyWorkspaceItem(workspaceId, relativePath)`。
- `src/services/tauri.ts` 已经暴露 `copyWorkspaceItem()`。
- Rust backend 已经注册 `copy_workspace_item`，并在 workspace 内创建 `name copy` / `name copy N` 形式的副本。
- 文件树已经支持 `Create File`、`Create Folder`、`Move to Trash`。
- 但 `Copy`、`Paste`、`Rename` 没有统一产品语义，也没有对应完整 backend contract。
- 多个文件操作失败路径当前存在 silent catch 风险，导致用户看到“点了没反应”。

这意味着当前问题不能用“加几个右键菜单项”解决。正确方向是抽出一套文件操作模型，使内部复制、外部导入、创建副本、重命名共享同一套 path safety、collision naming 和 error feedback 规则。

## 目标与边界

### 目标

- 文件树必须支持文件和文件夹的基础管理动作：
  - `Copy`
  - `Paste`
  - `Rename`
  - `Duplicate`
  - `Create File`
  - `Create Folder`
  - `Move to Trash`
- `Duplicate` 必须被定义为 `Copy + Paste to original parent` 的原子快捷动作。
- `Duplicate` 不得污染 internal clipboard，也不得覆盖用户当前复制状态。
- `Paste` 必须支持 internal workspace source。
- `Paste` 本轮只支持 internal workspace source；external file/folder source 仅保留 backend/service unsupported contract，不提供文件树外部导入 UI。
- 文件树 root row 必须可作为 create/paste target。
- 文件树 root row 只作为目录 target，不允许执行 `Duplicate`、`Rename`、`Move to Trash` 这类可能破坏 workspace root 的危险动作。
- 普通文件夹 row 必须可作为 create/paste target。
- 文件 row 上触发 paste 时，target directory 应解析为该文件的 parent directory。
- 所有操作必须有可见反馈：成功、失败、不可用、部分成功。
- 所有后端错误必须保留动作上下文，便于用户反馈和开发者定位。
- Windows、macOS、Linux 必须遵守同一 path normalization 和安全拒绝规则。

### 边界

- 文件操作目标范围是当前 workspace root 内部。
- 外部文件/文件夹只允许作为 source 导入，不允许作为 target。
- 后端是 path validation 和 filesystem mutation 的权威边界。
- 前端只表达用户 intent、维护 UI 状态和展示反馈，不在前端拼接危险目标路径。
- UI 可以在平台能力不足时降级，但不能静默失败。

## 非目标

- 不实现完整 Finder / Explorer / Nautilus 替代品。
- 不实现双栏文件管理器。
- 不实现批量重命名规则编辑器。
- 不实现跨 workspace 移动语义。
- 不实现自动把 clipboard text 粘贴成文件。
- 不实现危险覆盖确认流程；本变更默认采用 collision-safe rename，不覆盖已有文件。
- 不允许复制、粘贴、重命名、写入 `.git` 内部路径。
- 不引入 shell command 作为核心文件操作路径。
- 不在本轮实现文件树 external drag/drop 或 OS clipboard file paste；该能力必须另立变更并先证明不会破坏 composer 外部文件拖拽。

## 用户故事

### Story 1: 创建副本

用户在文件树中右键 `src/index.ts`，点击 `Duplicate`。

期望：

- 原父目录中出现 `index copy.ts`。
- 如果 `index copy.ts` 已存在，则出现 `index copy 1.ts`。
- 文件树刷新。
- 新副本尽量被选中或定位。
- 如果复制失败，显示明确错误，例如 `Failed to duplicate src/index.ts: ...`。

### Story 2: 内部复制粘贴文件

用户在文件树中右键 `src/index.ts`，点击 `Copy`，再右键 `docs/`，点击 `Paste`。

期望：

- `docs/index.ts` 被创建。
- 如果目标已有同名文件，则创建 `docs/index copy.ts` 或 `docs/index copy N.ts`。
- internal clipboard 状态保持可解释，UI 能提示当前可粘贴项。
- 操作失败时不清空 clipboard，允许用户换目标重试。

### Story 3: 内部复制粘贴文件夹

用户复制 `src/components/`，粘贴到 `examples/`。

期望：

- `examples/components/` 被递归复制。
- 目录内文件结构保持一致。
- 如果目标存在同名目录，则使用 collision suffix。
- 如果用户尝试把 `src/` 粘贴到 `src/components/` 之类 descendant 目标，后端拒绝。

### Story 4: 重命名文件或文件夹

用户右键 `README.md`，点击 `Rename`，输入 `README.zh-CN.md`。

期望：

- 文件被重命名。
- 文件树刷新。
- 新路径被选中或定位。
- 输入为空、包含路径分隔符、尝试逃逸 workspace、命中 `.git` 时必须拒绝。
- 目标名称冲突时必须拒绝并展示错误；Rename 不使用自动 suffix，避免用户误解为 move/copy。

### Story 5: 外部文件导入延期

用户从 Finder / Explorer / Linux file manager 复制或拖拽一个文件到文件树中的 `assets/`。当前代码基准下，该能力不作为本变更交付能力；只保留 `paste_external_workspace_items` 的 unsupported contract，避免文件树拖拽链路拦截 composer 的正常外部文件拖拽。

期望：

- 文件树不注册新的 external drop handler。
- 当前 UI 不展示外部导入入口，不引导用户把外部文件拖到文件树。
- 如果未来重新实现 external import，必须另立 OpenSpec 变更并验证 Windows/macOS/Linux 与 composer drop 兼容性。
- 保留的 backend/service contract 当前返回明确 unsupported error，不影响 internal Copy/Paste/Rename/Duplicate。

### Story 6: 独立文件窗口

用户打开 detached file explorer，在其中执行 copy/paste/rename/duplicate。

期望：

- 在 workspace context 可用时，行为与主窗口文件树一致。
- 如果跨窗口 clipboard state 暂不共享，UI 必须明确表达当前窗口内可粘贴状态。
- 平台 clipboard/import 不可用时显示 fallback，不静默失败。

## What Changes

### Product behavior

- 文件树右键菜单新增或规范化以下 actions：
  - `Copy`
  - `Paste`
  - `Rename`
  - `Duplicate`
  - `Copy Path`
  - `Reveal in Finder/Explorer/File Manager`
  - `New File`
  - `New Folder`
  - `Move to Trash`
- root row context menu 支持 create/paste target，并可保留 Copy Path / Reveal；root row 不支持 Duplicate / Rename / Move to Trash。
- 文件夹 row context menu 支持 create/paste target。
- 文件 row context menu 支持 rename/duplicate/copy，并将 paste target 解析到 parent directory。
- `Duplicate` 作为单步动作存在，但内部复用 paste/copy engine。
- operation feedback 在文件树内展示，至少包括 success/error/pending 三种状态。

### Frontend behavior

- 新增 internal file operation clipboard state：
  - copied source workspace id
  - copied source relative path
  - copied source kind: file/folder
  - copied display name
- 新增 rename prompt state：
  - source path
  - source kind
  - current basename
  - draft name
  - submitting/error state
- 新增 operation notice/error state，替代 silent catch。
- 所有 service call 失败必须 normalize 成用户可读 message。
- 所有用户可见文案必须走 i18n。
- 文件操作完成后调用 refresh，并尽量恢复 selection。

### Backend behavior

- 新增或扩展 workspace file operation commands：
  - `paste_workspace_item` 或等价 `paste_workspace_items`
  - `rename_workspace_item`
  - 新增或暴露 `duplicate_workspace_item` 语义；`copy_workspace_item` 仅作为 legacy duplicate command 兼容层，不代表 UI 的 internal Copy
- 抽出 shared copy engine：
  - validate source
  - validate target directory
  - resolve destination name
  - reject unsafe path
  - copy file or directory
  - return created relative path
- 抽出 shared basename/collision helper。
- 目录复制必须走 bounded blocking IO path，避免 async runtime 被大目录阻塞。
- command boundary 返回 `Result<T, String>`，message 包含动作和对象上下文。

### External source behavior

- 当前实现支持 `workspace` internal source。
- `external` absolute source paths 只保留 command/service unsupported contract，不作为文件树 UI 能力。
- 本变更不得新增文件树 external drag/drop handler，也不得拦截 composer 外部文件拖拽。
- OS clipboard file paste 和 file-tree external import 均延期到后续独立变更。

## 技术方案选项与取舍

| 选项 | 做法 | 优点 | 缺点 | 结论 |
|---|---|---|---|---|
| A. 只补前端菜单，复用现有 `copy_workspace_item` | 前端增加 `Copy/Paste/Rename` UI，部分操作拼接路径 | 改动小，短期快 | 安全边界模糊；无法支持外部导入；路径冲突、跨平台、错误处理会发散 | 不采用 |
| B. 后端新增统一 file operation contract | 前端表达 intent，Rust 后端统一 validate/copy/paste/rename | 安全、可测试、跨平台一致、适合 CI 固化 | 初始改动较多 | 采用 |
| C. 调用系统文件管理器或 shell 命令 | 用 Finder/Explorer/Linux shell 完成复制粘贴 | 行为接近 OS | CI 不稳定；平台差异大；权限、编码、路径逃逸难控 | 不采用 |
| D. 引入第三方文件管理库 | 用外部 crate/library 管理复制/rename | 可能减少代码 | 增加依赖和行为黑盒；当前需求标准库足够 | 暂不采用 |

最终采用 B。

原因：文件操作是 workspace 边界内的高风险 IO，必须由 backend 统一校验。前端模拟文件管理会在路径安全、平台差异、错误反馈和 future external source 上产生系统性漂移。

## 关键语义定义

### Copy

`Copy` 只更新 internal clipboard，不立即创建文件。

- 不改变 filesystem。
- 不清空用户 OS clipboard。
- 不影响 `Duplicate`。
- source 必须记录 workspace id、relative path、kind、display name。

### Paste

`Paste` 把 source materialize 到 target directory。

- target 可以是 workspace root。
- target 可以是 folder row。
- target 可以由 file row 解析为 parent directory。
- internal source 必须来自同一 workspace，跨 workspace 后续单独设计。
- external source 必须是 absolute source，target 仍必须在 workspace 内；首版可只暴露 contract 和 fallback，不强制 OS clipboard file paste 成功。

### Duplicate

`Duplicate(path)` 是原子动作：

```text
Duplicate(path) = Paste(sourcePath = path, targetDirectory = parent(path))
```

约束：

- 不读取或修改 internal clipboard。
- 不依赖用户先执行 Copy。
- 不覆盖已有文件。
- 返回新路径。

### Rename

`Rename(path, newName)` 只接受 basename，不接受完整 relative path。

约束：

- `newName` 不能为空。
- `newName` 不得包含 `/` 或 `\`。
- `newName` 不得是 `.` 或 `..`。
- `newName` 不得导致 `.git` 访问。
- 目标存在时不得静默覆盖。
- 返回新 relative path。

## Path Safety Contract

- 所有 frontend -> backend path 均为 workspace relative path，使用 `/` 作为 contract separator。
- backend 必须 trim、normalize、拒绝 root/prefix/parent traversal/current dir component。
- backend 必须 canonicalize workspace root 和 candidate path，并验证 candidate starts with canonical root。
- `.git` 本身和任何 `.git` descendant 必须拒绝。
- Windows drive prefix、UNC/prefix path 不得作为 workspace relative path 进入操作。
- symlink 行为必须安全：如果 canonicalized target 逃逸 workspace root，拒绝。
- 目标目录必须存在且是 directory。
- source 必须存在且 kind 与预期一致。

## Collision Naming Contract

默认不覆盖已有文件或目录。

建议 deterministic suffix：

```text
file.txt       -> file copy.txt
file copy.txt  -> file copy 1.txt
folder         -> folder copy
folder copy    -> folder copy 1
```

约束：

- 文件 extension 必须保留。
- 无 extension 文件按 basename 处理。
- folder 不使用 extension 语义。
- suffix counter 必须有上限，超过时返回可读错误。
- 同一 helper 必须被 duplicate 和 paste internal 复用；paste external 当前为 unsupported contract，不进入 copy engine。

## Cross-platform Compatibility

### Windows

- Contract path separator 统一为 `/`，backend 接受并归一化 `\` 输入。
- 拒绝 drive prefix，例如 `C:\`、`D:/` 这类作为 relative path 的输入。
- 拒绝 UNC/prefix path 作为 workspace relative path。
- 文件操作必须用 Rust `PathBuf` 和 `std::fs` / async blocking wrapper，不调用 `cmd`、PowerShell 或 Explorer。
- rename/copy 错误必须保留 Windows IO error context。
- case-insensitive filesystem 冲突行为必须按实际 target exists 检查处理。

### macOS

- 必须支持 Unicode 文件名。
- 不依赖 Finder-only API 作为核心 copy/rename path。
- 外部 Finder clipboard file source 不在本轮实现；不得用文件树 drag/drop fallback 影响 composer 外部拖拽。
- 不假设大小写敏感；collision 判断以 filesystem exists 为准。
- Reveal action 可以继续使用已有 opener capability，但文件 mutation 不依赖 Finder。

### Linux

- 不依赖单一 desktop environment clipboard protocol。
- Clipboard file paste 不在本轮实现；文件树不提供 external drag/drop fallback。
- 文件 mutation 不依赖 `cp`、`mv`、`xdg-*` shell command。
- symlink、permission denied、read-only filesystem 等错误必须返回明确 message。

### Shared behavior

- 三端都必须拒绝 `.git`。
- 三端都必须拒绝 path traversal。
- 三端都必须 reject directory pasted into itself or descendant。
- 三端都必须使用相同 collision suffix contract。
- 三端 external import partial failure UI 不在本轮实现；internal file operations 必须报告失败。

## CI / Validation Gate

### OpenSpec gate

- `openspec validate enhance-file-tree-management-actions --strict --no-interactive`
- `openspec validate --all --strict --no-interactive`

### Frontend gate

- `npm run typecheck`
- Focused Vitest for `FileTreePanel`:
  - copy stores internal clipboard state
  - paste invokes backend with expected target directory
  - paste into file row resolves parent directory
  - duplicate does not mutate internal clipboard
  - rename prompt validates empty/invalid names
  - failed operation shows error notice
  - successful operation refreshes file tree
- Service mapping tests for new command wrappers:
  - payload shape
  - returned created/renamed path
  - error propagation

### Backend gate

- Focused Rust tests for file helpers:
  - duplicate file
  - duplicate directory
  - paste file to another directory
  - paste directory to another directory
  - collision suffix generation
  - rename file
  - rename directory
  - reject empty path
  - reject `../outside`
  - reject `.git/config`
  - reject absolute/prefix path
  - reject directory copy into descendant
  - preserve relative path normalization with Windows-style separators
- `cargo test --manifest-path src-tauri/Cargo.toml` or a documented focused command covering touched modules.

### Runtime contract gate

- If adding Tauri commands:
  - update `src-tauri/src/command_registry.rs`
  - update `src/services/tauri.ts`
  - add service mapping test
  - run `npm run check:runtime-contracts` if command registry/capability contract is checked by repo tooling

### Large file / style gate

- If modifying large CSS or splitting `FileTreePanel`:
  - `npm run check:large-files`
- If only proposal/spec docs are touched, runtime gates may be skipped with explicit note.

### Platform evidence to record

Implementation verification notes must explicitly state coverage for:

- Windows separator/prefix rejection.
- macOS Unicode filename path.
- Linux external clipboard/file-tree import deferred note.

## Capabilities

### New Capabilities

- `workspace-filetree-management-actions`: Defines workspace file tree management actions for files and folders, including copy, paste, rename, duplicate, create, trash, error feedback, path safety, collision naming, explicit external-import deferral, and cross-platform compatibility.

### Modified Capabilities

- `workspace-filetree-root-node`: Root row becomes a valid management target for paste/create operations and must follow the same selection and context-menu semantics as folder targets.
- `detached-file-explorer`: Detached file explorer must preserve file management actions where the workspace context is available, and must avoid silent failure when clipboard context is unavailable.

## Impact

### Frontend files

- `src/features/files/components/FileTreePanel.tsx`
- `src/features/files/components/FileTreeRootActions.tsx`
- `src/features/files/components/FileTreePanel.run.test.tsx`
- `src/features/files/components/FileTreePanel.detached.test.tsx`
- `src/services/tauri.ts`
- `src/services/tauri.test.ts`
- `src/i18n/locales/zh.part2.ts`
- `src/i18n/locales/en.part2.ts`

### Backend files

- `src-tauri/src/workspaces/files.rs`
- `src-tauri/src/workspaces/commands.rs`
- `src-tauri/src/shared/workspaces_core.rs`
- `src-tauri/src/command_registry.rs`

### OpenSpec files

- `openspec/changes/enhance-file-tree-management-actions/proposal.md`
- `openspec/changes/enhance-file-tree-management-actions/design.md`
- `openspec/changes/enhance-file-tree-management-actions/tasks.md`
- `openspec/changes/enhance-file-tree-management-actions/specs/workspace-filetree-management-actions/spec.md`
- `openspec/changes/enhance-file-tree-management-actions/specs/workspace-filetree-root-node/spec.md`
- `openspec/changes/enhance-file-tree-management-actions/specs/detached-file-explorer/spec.md`

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Large directory copy blocks runtime | UI stalls or backend task starvation | Run recursive copy in blocking IO path; return pending state in UI |
| File-tree external drag/drop intercepts composer drop | Existing external file-to-chat flow regresses | Remove external file-tree import from this slice; future work needs separate compatibility design |
| Symlink escapes workspace | Security issue | Canonicalize source/target and reject escape |
| Rename overwrites existing path | Data loss | Reject conflicts or use explicit collision-safe copy only; never silent overwrite |
| Duplicate and Paste drift | Different suffix/error behavior | Share backend copy engine and collision helper |
| Detached explorer loses workspace context | Inconsistent behavior | Gate actions on workspace context and show unavailable state when missing |
| Silent failure persists | User cannot diagnose | Replace catch blocks with operation notice/error state |

## Rollout Plan

1. Land OpenSpec artifacts: proposal, design, specs, tasks.
2. Implement backend shared file operation helpers and focused Rust tests.
3. Add service wrappers and service mapping tests.
4. Add FileTreePanel state/actions and UI tests.
5. Keep external source import as unsupported contract only; do not add file-tree external drop UI.
6. Record external file-tree import as a follow-up change that must prove composer drop compatibility.
7. Run focused validation and record platform compatibility evidence.

## Acceptance Criteria

- 用户可以在文件树中复制一个文件，并粘贴到另一个文件夹或 workspace root。
- 用户可以在文件树中复制一个文件夹，并粘贴到另一个文件夹或 workspace root。
- 用户可以对文件或文件夹执行 `Duplicate`，副本出现在原父目录，且不会覆盖已有项。
- `Duplicate` 不会改变当前 internal clipboard。
- 用户可以重命名文件或文件夹。
- 非法重命名输入会被拒绝并展示错误。
- `.git`、path traversal、absolute/prefix path、descendant self-copy 都会被后端拒绝。
- 所有新增文件操作失败时，用户能看到可读错误，不再 silent fail。
- 文件操作成功后文件树刷新，并尽量选中新路径。
- external file/folder source 当前为 unsupported contract，文件树不提供外部导入入口，不影响 composer 外部文件拖拽。
- Windows/macOS/Linux 的 path normalization、安全拒绝和 collision naming 行为一致。
- OpenSpec strict validation 通过。
- Frontend focused tests、service mapping tests、Rust focused tests 覆盖新增 contract。

## Resolved Calibration Notes

- OS clipboard file paste 和 file-tree external drag/drop import 本轮均不实现。
- Internal clipboard 当前限定在 FileTreePanel 实例内，跨窗口共享后续单独设计。
- Rename 目标冲突当前直接拒绝，不自动 suffix。
- 批量 external paste / partial success UI 本轮不实现。
