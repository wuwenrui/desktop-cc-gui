## Context

文件树当前是 workspace 文件导航的主入口，同时已经承载部分管理动作：新建文件、新建文件夹、移动到废纸篓、复制路径、Reveal、创建副本。现有实现的问题不是缺少单个按钮，而是缺少统一 file operation model：`Duplicate` 直接调用 `copy_workspace_item`，`Copy/Paste/Rename` 没有完整 contract，多个失败路径存在 silent catch，用户无法判断文件操作是否真正完成。

该变更横跨 React UI、Tauri service wrapper、Rust command registry、workspace 文件系统 helper、i18n 与测试。因此设计必须先定义稳定边界：frontend 只维护交互状态和表达 intent；backend 负责 path validation、filesystem mutation、collision naming 和跨平台差异吸收。

关键约束：

- 文件操作目标必须限定在 workspace root 内。
- 外部文件/文件夹只能作为 source 导入，不能成为 target。
- `.git` 路径必须拒绝。
- 不能使用 shell command 作为核心文件操作实现。
- Windows/macOS/Linux 必须共享同一 contract，并在 backend 层处理平台路径差异。
- 失败必须用户可见，不能 silent fail。

## Goals / Non-Goals

**Goals:**

- 在文件树中实现一致的 `Copy`、`Paste`、`Rename`、`Duplicate` 管理语义。
- 让 `Duplicate` 成为原子快捷动作，底层复用 copy/paste engine，但不污染 internal clipboard。
- 支持 internal workspace source；external file/folder import 仅保留 unsupported command/service contract，不作为本轮 UI 能力。
- 把 path safety、collision naming、recursive copy、rename conflict handling 收敛到 Rust backend。
- 给 frontend 增加 operation pending/success/error feedback，替换 silent catch。
- 让 root row、folder row、file row、detached file explorer 使用一致 target resolution 规则。
- 明确 CI gate 和三端兼容验证路径。

**Non-Goals:**

- 不实现完整 Finder/Explorer/Nautilus 替代品。
- 不实现跨 workspace move。
- 不实现 clipboard text -> new file。
- 不做危险 overwrite。
- 不引入外部文件管理依赖。
- 不实现 OS clipboard file paste 或 file-tree external drag/drop import。

## Decisions

### Decision 1: Backend is the file operation authority

真实文件操作必须在 Rust backend 中执行。Frontend 不直接构造最终 destination path，也不根据 UI 状态自行判断 source/target 是否安全。

推荐 command contract：

```ts
type WorkspaceFileItemKind = "file" | "folder";

type WorkspaceFileOperationResult = {
  path: string;
  kind: WorkspaceFileItemKind;
};

renameWorkspaceItem(input: {
  workspaceId: string;
  path: string;
  newName: string;
}): Promise<WorkspaceFileOperationResult>;

pasteWorkspaceItem(input: {
  workspaceId: string;
  sourcePath: string;
  targetDirectory: string;
}): Promise<WorkspaceFileOperationResult>;

pasteExternalWorkspaceItems(input: {
  workspaceId: string;
  sourcePaths: string[];
  targetDirectory: string;
}): Promise<WorkspaceFileOperationResult[]>;

duplicateWorkspaceItem(input: {
  workspaceId: string;
  path: string;
}): Promise<WorkspaceFileOperationResult>;
```

Frontend UI MUST use `duplicateWorkspaceItem` for Duplicate semantics. `copyWorkspaceItem` can remain only as a backward-compatible legacy wrapper for the existing backend `copy_workspace_item` command, but new FileTreePanel code MUST NOT call it for user-facing Copy. In this design, user-facing Copy always means internal clipboard state and never means filesystem mutation.

`pasteExternalWorkspaceItems` exists only as an unsupported compatibility contract in the current code baseline. FileTreePanel MUST NOT call it and MUST NOT register a new external file-tree drop/import UI in this change.

Alternatives considered:

- 前端直接拼接 target path 后调用现有 write/copy command。拒绝：path traversal、collision naming、平台差异和错误处理会分散。
- 复用 OS shell copy/move。拒绝：CI 不稳定，平台差异不可控。

### Decision 2: Shared Rust copy engine for duplicate and internal paste

Backend 应抽出一个 shared copy engine，而不是为 duplicate/internal paste 写两套逻辑。External import 当前为 unsupported contract，不进入本轮 copy engine。

推荐内部 helper 结构：

```rust
struct WorkspaceCopySource {
    absolute_path: PathBuf,
    kind: WorkspaceFileItemKind,
    display_name: String,
}

struct WorkspaceCopyTarget {
    workspace_root: PathBuf,
    target_directory: PathBuf,
    target_relative_directory: String,
}

fn copy_workspace_item_to_directory(
    source: WorkspaceCopySource,
    target: WorkspaceCopyTarget,
    naming: CollisionNamingPolicy,
) -> Result<WorkspaceFileOperationResult, String>
```

该 helper 负责：

- source exists check。
- source kind inference。
- target directory exists + is_dir check。
- descendant self-copy rejection。
- collision-safe destination name。
- file copy 或 recursive directory copy。
- 返回新 relative path。

Alternatives considered:

- 继续让 `copy_workspace_item_inner` 自己处理 duplicate，后续 paste 再写一套。拒绝：suffix、错误、递归复制规则会漂移。
- 使用第三方 recursive copy crate。暂不采用：标准库足够，且依赖收益不明显。

### Decision 3: Duplicate is an atomic action, not a frontend Copy then Paste macro

`Duplicate(path)` 的产品语义等价于：

```text
Paste(sourcePath = path, targetDirectory = parent(path))
```

但实现上不能让 frontend 先写 internal clipboard 再 paste。

原因：

- 用户可能已经 copy 了另一个 item；Duplicate 不应覆盖该状态。
- Duplicate 应该是一个 filesystem transaction intent，而不是 UI 状态副作用组合。
- Backend 可以直接计算 parent directory，更少边界输入。

Implementation shape:

- Frontend `Duplicate` calls backend duplicate command directly。
- Backend duplicate command internally calls shared copy engine with source parent as target。
- Result path 返回给 UI，用于 refresh 后 selection。

### Decision 4: Internal clipboard is UI state only

文件树 `Copy` 是 UI-level internal clipboard，不触发 filesystem mutation，不写 OS clipboard。

State shape:

```ts
type FileTreeClipboardItem = {
  workspaceId: string;
  path: string;
  kind: "file" | "folder";
  name: string;
};
```

Rules:

- Copy item 后菜单中的 Paste 可用。
- Paste 失败不清空 clipboard。
- Workspace 切换时，如果 clipboard workspaceId 不匹配，Paste 禁用或提示不支持跨 workspace paste。
- Detached explorer 首版可以使用 window-local clipboard；跨窗口共享作为后续增强。

Alternatives considered:

- 写入 OS clipboard。拒绝作为首版默认：平台差异大，且会污染用户剪贴板。
- 全局 app store 共享 internal clipboard。可后续考虑；首版 window-local 更简单。

### Decision 5: Rename accepts basename only

Rename command 不接受完整 target path，只接受 `newName`。

Backend 根据 source parent + newName 计算 target path。

Validation:

- trim 后不能为空。
- 不允许 `/`、`\`。
- 不允许 `.`、`..`。
- 不允许生成 `.git` 或 `.git` descendant。
- target exists 时拒绝，不自动 suffix。
- source canonical path 必须在 workspace root 内。
- target parent canonical path 必须在 workspace root 内。

Rationale:

- Rename 是修改 basename，不是 move。
- 避免前端传入危险 nested path。
- 冲突时拒绝比自动 suffix 更符合 rename 用户预期。

### Decision 6: Target resolution is deterministic and frontend-visible

Frontend 需要统一把 context menu target 转换为 paste/create target directory，但最终安全验证仍由 backend 负责。

Rules:

```text
root row            -> ""
folder row          -> folder path
file row            -> parent folder path
empty tree surface  -> ""
selected folder     -> selected folder path
selected file       -> selected file parent
```

This logic should live in a small pure helper near `FileTreePanel`, not be duplicated across root actions and row context menus.

Suggested helper:

```ts
function resolveFileTreeTargetDirectory(input: {
  path: string | null;
  kind: "file" | "folder" | "root" | null;
}): string
```

### Decision 6.1: Root row is a safe target, not a mutable item

The workspace root row is a directory target for create and paste actions, but it is not a normal mutable item.

Allowed root actions:

- New File.
- New Folder.
- Paste.
- Copy Path.
- Reveal.

Forbidden root actions:

- Duplicate.
- Rename.
- Move to Trash.

Rationale:

- Duplicating or trashing the workspace root is dangerous and not part of the file tree management MVP.
- Rename root belongs to workspace management, not file item management.
- Existing root context-menu behavior must be narrowed to safe directory target actions when management actions are added.

### Decision 7: Operation feedback becomes explicit state

Frontend should replace silent catch blocks with operation state.

Suggested state:

```ts
type FileTreeOperationNotice = {
  id: string;
  tone: "success" | "error" | "info";
  message: string;
};

type FileTreeOperationStatus = {
  pending: null | "copy" | "paste" | "duplicate" | "rename" | "trash" | "create-file" | "create-folder";
  notice: FileTreeOperationNotice | null;
};
```

Rules:

- Pending action disables only conflicting controls, not the whole file tree.
- Error notice remains visible until next action or dismissal.
- Success notice can auto-clear.
- Error messages must include action context and backend reason.
- User-visible strings must use i18n.

Alternatives considered:

- Toast-only global notice。可用但不够贴近 file tree context。
- Console-only logging。拒绝：用户仍然感知为无响应。

### Decision 8: External source support is deferred behind an unsupported contract

External source support is not a delivered file-tree capability in this slice. The current code baseline keeps a backend/service command shape that returns an explicit unsupported error, while FileTreePanel does not expose an external import entrypoint.

Conceptual source union:

```ts
type FilePasteSource =
  | { kind: "workspace"; sourcePath: string }
  | { kind: "external"; absolutePaths: string[] };
```

Current calibrated status:

1. Delivered: internal workspace paste.
2. Present but unavailable: external command/service contract returning unsupported.
3. Not delivered: file-tree external drag/drop import.
4. Not delivered: OS clipboard file paste.

Rationale:

- A previous file-tree external drag bridge regressed normal composer external file drops.
- Current code must preserve composer drop behavior and internal file-tree row drag behavior.
- Future external import requires a separate compatibility design and platform matrix before implementation.

### Decision 9: Path normalization remains `/` at IPC boundary

Frontend and backend contract uses workspace relative path with `/` separators.

Backend handling:

- Accept existing Windows-style `\` input by normalizing to `/` only at boundary.
- Reject absolute path, root, prefix, parent traversal, current dir component.
- Convert normalized relative path to `PathBuf` segment-by-segment.
- Canonicalize root and candidate before mutation.
- Check `.git` after normalization.

This preserves cross-platform consistency and matches existing workspace file reading patterns.

### Decision 10: Remote mode behavior must be explicit

Existing commands have mixed remote mode support. New file operation commands must not silently fail in remote mode.

Options:

- Support remote backend by forwarding commands if daemon can implement equivalent file operations.
- Return explicit unsupported error: `workspace file paste is not supported in remote mode yet`.

For first implementation, explicit unsupported is acceptable only if UI surfaces the error. If remote daemon already supports file IO enough to implement safely, forward parity should be preferred.

## Proposed Architecture

```text
FileTreePanel
  -> file operation UI state
  -> pure target-directory helpers
  -> src/services/tauri.ts wrappers
  -> Tauri commands
  -> shared workspaces_core wrappers
  -> workspaces/files.rs operation helpers
  -> std::fs / blocking recursive copy
  -> WorkspaceFileOperationResult
  -> refresh + selection restoration + notice
```

## Backend Helper Design

### Path validators

Reuse existing `normalize_workspace_relative_path` where possible, but add specific helpers:

```rust
fn normalize_workspace_relative_file_or_folder_path(path: &str) -> Result<String, String>;
fn normalize_workspace_relative_directory_target(path: &str) -> Result<String, String>;
fn validate_workspace_item_basename(name: &str) -> Result<String, String>;
fn reject_git_path(normalized: &str) -> Result<(), String>;
```

Root target directory should allow `""`; item source path should not.

### Collision helper

```rust
fn resolve_collision_safe_destination(
    target_dir: &Path,
    source_name: &str,
    kind: WorkspaceFileItemKind,
) -> Result<PathBuf, String>
```

The helper must preserve file extension for file sources and use deterministic suffixes.

### Recursive copy helper

Existing `copy_dir_recursive` can be reused but should gain protections:

- reject destination inside source descendant.
- propagate source/destination path context in error messages.
- skip no files silently only when source dir is empty.
- avoid following symlink escape if canonical source/target escapes workspace, depending on final symlink policy.

### Rename helper

```rust
fn rename_workspace_item_inner(
    root: &PathBuf,
    relative_path: &str,
    new_name: &str,
) -> Result<WorkspaceFileOperationResult, String>
```

Use `std::fs::rename` after all validation. Do not overwrite existing target.

## Frontend UI Design

### Context menu composition

Menu items should be grouped conceptually:

```text
Create
  New File
  New Folder
Manage
  Copy
  Paste
  Duplicate
  Rename
Open/Reference
  Copy Path
  Reveal
  Insert LSP Diagnostics
Danger
  Move to Trash
```

Actual `RendererContextMenuItem` may remain flat if the component does not support separators yet, but item order should follow this model.

### Rename prompt

Reuse current new file/new folder prompt style initially, or extract a small local prompt helper only if duplication becomes excessive.

Rename prompt requires:

- title with current item name.
- input prefilled with basename.
- Enter confirm.
- Escape/click backdrop cancel.
- disabled submit while pending.
- inline error notice if backend rejects.

### Selection restoration

After operation success:

- Call `onRefreshFiles?.()`.
- Store `pendingRevealPath` or update `selectedNodePath` to returned path where immediately possible.
- If refresh is async and tree data arrives later, selection restoration should be best-effort.

This should not block first implementation; returning path is required so later selection restoration is possible.

## Testing Strategy

### Frontend tests

Focused tests in `FileTreePanel.run.test.tsx`:

- `Copy` stores clipboard and enables `Paste`.
- `Paste` on folder calls service with folder target.
- `Paste` on file calls service with parent target.
- `Paste` on root calls service with root target.
- `Duplicate` calls duplicate/copy command and does not alter clipboard.
- `Rename` sends basename only.
- rename invalid empty name does not call backend.
- backend rejection shows error notice.
- create/trash duplicate existing failures no longer silent fail.

Detached tests:

- Detached file explorer keeps management actions when workspace context exists.
- Paste without valid internal clipboard context is unavailable and does not dispatch backend mutation.

### Service tests

`src/services/tauri.test.ts` should cover new wrappers:

- command names.
- camelCase payload keys expected by Tauri invoke.
- returned path/kind mapping if mapping exists.
- rejection propagation.

### Rust tests

Focused tests in `workspaces/files.rs` or a dedicated module:

- duplicate file with extension.
- duplicate file without extension.
- duplicate directory recursively.
- paste file to root.
- paste file to nested folder.
- paste directory to folder.
- collision suffix increments.
- rename file.
- rename directory.
- rename conflict rejects.
- invalid basename rejects.
- `.git` rejects.
- traversal rejects.
- Windows-style separators normalize.
- source copied into descendant rejects.
- external import command returns explicit unsupported error and is not wired from FileTreePanel.

## Risks / Trade-offs

- [Risk] Recursive directory copy can be slow for large directories. → Mitigation: run in blocking IO path, show pending state, avoid locking UI state globally.
- [Risk] External file drag/drop differs across app panes and can intercept chat-composer drops. → Mitigation: remove file-tree external import from this slice; preserve normal composer external drop behavior and revisit file-tree import only behind a separate compatibility design.
- [Risk] Symlinks can escape workspace. → Mitigation: canonicalize source and target; reject operations where canonical path escapes workspace root.
- [Risk] Rename semantics conflict with collision suffix behavior. → Mitigation: duplicate/paste use suffix; rename rejects conflict for clarity.
- [Risk] Existing `copy_workspace_item` name is semantically misleading. → Mitigation: either add `duplicate_workspace_item` wrapper or document `copy_workspace_item` as backward-compatible duplicate command.
- [Risk] FileTreePanel grows larger. → Mitigation: extract pure helpers and, if needed, a feature-local hook such as `useFileTreeOperations` after behavior stabilizes.
- [Risk] Remote mode parity lags local mode. → Mitigation: return explicit unsupported errors and surface them in UI; add remote parity later if daemon implementation is available.

## Migration Plan

1. Add backend DTOs and shared file operation helpers without changing UI.
2. Add or alias Tauri commands for duplicate, paste, and rename.
3. Add service wrappers and mapping tests.
4. Update FileTreePanel menu and operation state.
5. Replace silent catch paths with visible operation notices.
6. Add focused frontend and Rust tests.
7. Keep external source import out of this slice after compatibility rollback.
8. Run OpenSpec validation and focused CI gates.

Rollback strategy:

- Keep existing `copy_workspace_item` behavior intact until new commands are proven.
- UI changes can be reverted independently because backend commands are additive.
- External file-tree import has been removed from this slice; a future implementation must not reuse the removed drag bridge without proving composer external drop compatibility.

## Resolved Platform Decisions

- First implementation exposes internal Copy/Paste/Rename/Duplicate only; external file-tree import is deferred because the attempted drag bridge regressed normal composer external file drops.
- OS clipboard file paste remains out of scope because Tauri WebView/browser clipboard APIs do not reliably expose file paths on Windows/macOS/Linux.
- Internal clipboard is scoped per FileTreePanel instance; cross-window shared clipboard can be added as a later enhancement.
- `copy_workspace_item` remains a backward-compatible duplicate command; FileTreePanel uses `duplicate_workspace_item`.
- Internal paste/duplicate/rename remain atomic single-item operations.

## Archive delta semantics note

- `workspace-filetree-root-node` is an additive modified-capability delta: it adds safe root create/paste behavior and explicitly blocks dangerous root duplicate/rename/trash actions without replacing the existing root node capability.
- `detached-file-explorer` is an additive modified-capability delta: it preserves management-action parity where workspace context exists and adds fallback states for missing clipboard or unsupported platform import sources without replacing existing detached explorer behavior.
