## MODIFIED Requirements

### Requirement: Git panel MUST expose explicit file inclusion controls for commit

Git 面板 MUST 为每个 changed file row 提供明确的 inclusion control。该 control 只定义“本次 commit 是否包含该文件”，MUST NOT 取代现有 `stage / unstage` 文件动作。

#### Scenario: moving file inclusion control to trailing area preserves commit scope semantics

- **WHEN** Git History/HUB worktree file row 将 inclusion control 展示在行右侧
- **THEN** 系统 MUST 继续使用同一套 commit scope selection state
- **AND** checked / unchecked / partial 状态 MUST 与移动前保持等价
- **AND** 该 visual placement change MUST NOT 新增或删除任何 stage / unstage / discard command path

#### Scenario: tree folder inclusion controls are removed in favor of file-level controls

- **WHEN** 用户切换到 Git tree view
- **THEN** root/folder rows MUST NOT expose file inclusion checkboxes
- **AND** file rows MUST expose the trailing inclusion checkbox consistently with flat view
- **AND** section-level bulk controls MAY remain available for section-wide selection

#### Scenario: compact tree labels preserve commit scope path semantics

- **WHEN** Git tree 或 Git History/HUB worktree tree 将空目录链展示为 `a.b.c`
- **THEN** commit scope calculation MUST continue to use the node `descendantPaths`
- **AND** folder/root inclusion state MUST NOT be derived from the dotted display label
- **AND** Windows 与 POSIX path input MUST continue to normalize to the same file-level inclusion behavior
