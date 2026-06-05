## 1. Backend File Operation Foundation

- [x] 1.1 [P0][depends:none][I: existing `workspaces/files.rs` path helpers][O: shared source/target validation helpers for item path, root-capable target directory, basename, and `.git` rejection][V: Rust tests reject empty item path, root item path, `../outside`, `.git/config`, absolute/prefix paths] Add reusable workspace file operation validators.
- [x] 1.2 [P0][depends:1.1][I: existing `copy_workspace_item_inner` suffix behavior][O: shared collision-safe destination helper preserving file extensions and folder names][V: Rust tests cover `index.ts -> index copy.ts`, `index copy 1.ts`, folder `components copy`, and suffix exhaustion] Extract deterministic collision naming.
- [x] 1.3 [P0][depends:1.1][I: canonical source/target paths][O: self/descendant directory copy rejection helper][V: Rust tests reject copying `src` into `src` and `src/components`] Add directory self-copy and descendant-copy guard.
- [x] 1.4 [P0][depends:1.1,1.2,1.3][I: file/folder source + target directory][O: shared copy engine returning created workspace-relative path and item kind][V: Rust tests copy file, copy folder recursively, copy empty folder, and fail with path context on missing source] Implement shared backend copy engine.
- [x] 1.5 [P0][depends:1.4][I: existing `copy_workspace_item_inner` duplicate behavior][O: duplicate helper that calls shared copy engine with source parent target][V: Rust tests duplicate file/folder and preserve existing suffix behavior] Rework duplicate implementation onto shared copy engine without changing user-visible duplicate behavior.

## 2. Backend Commands And Core Wrappers

- [x] 2.1 [P0][depends:1.*][I: shared copy engine][O: `paste_workspace_item` core/helper command for same-workspace internal paste][V: Rust tests paste file/folder to root and nested folder] Add internal paste backend operation.
- [x] 2.2 [P0][depends:1.1][I: basename validator][O: `rename_workspace_item` helper/core command returning new relative path and kind][V: Rust tests rename file, rename folder, reject conflict, reject path-like basename] Add rename backend operation.
- [x] 2.3 [P0][depends:1.4][I: external source model + workspace target directory][O: external source command/service contract returns explicit unsupported error][V: code review confirms `paste_external_workspace_items_inner` returns unsupported and does not affect internal paste] Add external source import contract without first-slice import success.
- [x] 2.4 [P0][depends:2.1,2.2,2.3][I: new backend helpers][O: Tauri commands registered in `workspaces/commands.rs` and `command_registry.rs`][V: command compile plus service mapping tests later] Register new workspace file operation commands.
- [x] 2.5 [P1][depends:2.4][I: remote mode branch][O: explicit remote forwarding or unsupported errors for paste/rename/external import contract][V: tests or code review confirm remote mode does not silently fail] Define remote mode behavior for new commands.

## 3. Frontend Service Boundary

- [x] 3.1 [P0][depends:2.4][I: command names and DTOs][O: TypeScript types for file operation item kind/result/input payloads in `src/services/tauri.ts`][V: `npm run typecheck`] Add service DTOs.
- [x] 3.2 [P0][depends:3.1][I: backend command contract][O: service wrappers for `duplicateWorkspaceItem`, paste internal, rename, and external unsupported contract][V: `src/services/tauri.test.ts` payload mapping tests] Add Tauri service wrappers.
- [x] 3.3 [P0][depends:3.2][I: existing `copyWorkspaceItem` wrapper][O: `duplicateWorkspaceItem` as the FileTreePanel-facing API and `copyWorkspaceItem` retained only as legacy duplicate compatibility][V: tests prove FileTreePanel duplicate uses `duplicateWorkspaceItem` and user-facing Copy does not call `copyWorkspaceItem`] Remove copy/duplicate naming ambiguity.

## 4. FileTreePanel Operation State And Helpers

- [x] 4.1 [P0][depends:3.2][I: FileTreePanel selected node state][O: `FileTreeClipboardItem` internal state scoped to current file tree instance][V: component test copy file/folder stores clipboard and does not invoke backend] Add internal clipboard state.
- [x] 4.2 [P0][depends:4.1][I: root/folder/file selected node inputs][O: pure target-directory resolver for root, folder, file-parent, and empty surface][V: unit/component tests cover target resolution cases] Add deterministic target directory helper.
- [x] 4.3 [P0][depends:4.1][I: operation actions][O: pending/success/error operation notice state replacing silent catch paths][V: component tests show error notice on rejected create/trash/duplicate/paste/rename] Add visible operation feedback state.
- [x] 4.4 [P0][depends:4.3][I: current new file/new folder/trash/duplicate handlers][O: handlers that normalize errors and surface operation notices][V: existing FileTreePanel tests updated to assert no regression] Replace silent catch in existing file operations.
- [x] 4.5 [P1][depends:4.2,4.3][I: operation result path][O: best-effort selection or reveal of created/renamed path after refresh][V: component test or manual note verifies returned path is used] Add result-path selection restoration hook.

## 5. FileTreePanel Copy Paste Rename Duplicate UI

- [x] 5.1 [P0][depends:4.*][I: context menu builder][O: Copy action for file/folder rows and root-safe disabled behavior where applicable][V: component tests invoke Copy and observe clipboard notice/state] Add Copy menu action.
- [x] 5.2 [P0][depends:5.1,3.2][I: clipboard item + target resolver][O: Paste action on root, folder, and file-parent targets][V: component tests assert service payload target `""`, folder path, and file parent path] Add internal Paste menu action.
- [x] 5.3 [P0][depends:3.2,4.3][I: existing duplicate menu action][O: Duplicate action using duplicate-compatible service and visible feedback][V: component test proves duplicate does not mutate clipboard and refreshes on success] Normalize Duplicate behavior.
- [x] 5.4 [P0][depends:3.2,4.3][I: selected item basename][O: Rename prompt with prefilled basename, Enter confirm, Escape/backdrop cancel, pending/error state][V: component tests cover valid rename, empty value no-op/reject, target-exists conflict error notice, backend rejection notice] Add Rename UI.
- [x] 5.5 [P1][depends:5.1-5.4][I: context menu item ordering and i18n labels][O: grouped/ordered management menu labels for zh/en][V: focused render assertions or snapshot] Polish file tree context menu ordering and labels.

## 6. Root Node And Detached Explorer Parity

- [x] 6.1 [P0][depends:5.2][I: workspace root row context menu][O: root Paste target support using `targetDirectory: ""` and no root Duplicate/Rename/Move to Trash actions][V: component tests paste on root invokes backend with root target and dangerous root actions are absent] Make root node a safe paste/create target.
- [x] 6.2 [P0][depends:4.3][I: root create/paste action results][O: root actions using shared operation feedback and refresh behavior][V: component tests cover root action failure visibility] Route root actions through shared feedback.
- [x] 6.3 [P1][depends:5.*][I: detached FileTreePanel usage][O: detached explorer exposes same supported file management actions when workspace context exists][V: `FileTreePanel.detached.test.tsx` covers action availability] Preserve detached explorer action parity.
- [x] 6.4 [P1][depends:6.3][I: missing workspace context or unavailable internal clipboard source][O: disabled/unavailable detached paste messaging][V: detached tests cover no backend request without source context] Add detached fallback states.

## 7. External Source Import Slice

- [x] 7.1 [P1][depends:2.3,3.2][I: external absolute source paths][O: external import excluded from this slice after compatibility regression][V: review confirms no external import service/backend/i18n diff is included] De-scope optional external import service path.
- [x] 7.2 [P1][depends:7.1,4.2][I: drag/drop file/folder payloads where available][O: no file-tree external drop handler in this slice][V: review confirms file-tree drag bridge remains baseline and composer external drop is not intercepted by new code] Remove drag/drop external import MVP from this change.
- [x] 7.3 [P2][depends:7.1][I: OS clipboard file path feasibility per platform][O: clipboard file paste stays out of scope][V: platform note documents Windows/macOS/Linux path exposure instability] Record OS clipboard file paste as deferred.
- [x] 7.4 [P1][depends:7.2][I: external import per-item results][O: no external import result UI in this slice][V: no external import i18n or summary logic is included] Remove external import feedback summary from this change.

## 8. i18n And Accessibility

- [x] 8.1 [P0][depends:5.*][I: new visible labels][O: zh/en i18n keys for Copy, Paste, Rename, operation success/error, unavailable paste/import fallback][V: typecheck/render tests no raw keys missing] Add localized copy.
- [x] 8.2 [P0][depends:5.4][I: rename prompt UI][O: accessible dialog labels, input label/placeholder, confirm/cancel button names][V: component tests query by role/name] Add rename prompt accessibility.
- [x] 8.3 [P1][depends:4.3][I: operation notice UI][O: accessible status/alert semantics for success/error notices][V: component tests query status/alert text] Add accessible operation notices.

## 9. Verification And CI Gates

- [x] 9.1 [P0][depends:1-8][I: OpenSpec artifacts][O: strict change validation pass][V: `openspec validate enhance-file-tree-management-actions --strict --no-interactive`] Validate this change.
- [x] 9.2 [P0][depends:1-8][I: full OpenSpec workspace][O: strict workspace validation pass][V: `openspec validate --all --strict --no-interactive`] Validate all OpenSpec artifacts.
- [x] 9.3 [P0][depends:3-8][I: TypeScript changes][O: type safety pass][V: `npm run typecheck`] Run frontend typecheck.
- [x] 9.4 [P0][depends:4-8][I: FileTreePanel/service tests][O: focused Vitest pass][V: focused tests for `FileTreePanel.run.test.tsx`, `FileTreePanel.detached.test.tsx`, and `src/services/tauri.test.ts`] Run focused frontend tests.
- [x] 9.5 [P0][depends:1-2][I: Rust file operation helpers and commands][O: focused Rust test pass][V: focused `cargo test --manifest-path src-tauri/Cargo.toml` command covering workspace file operations] Run Rust file operation tests.
- [x] 9.6 [P1][depends:2.4,3.2][I: Tauri command contract changes][O: runtime contract validation or documented not-applicable note][V: `npm run check:runtime-contracts`] Run runtime contract gate if command registry tooling applies.
- [x] 9.7 [P1][depends:5-8][I: FileTreePanel size/style impact][O: large-file guard pass or documented not-applicable note][V: `npm run check:large-files`] Run large-file guard if FileTreePanel/CSS grows materially.
- [x] 9.8 [P1][depends:1-8][I: platform compatibility matrix][O: recorded Windows/macOS/Linux compatibility evidence][V: notes cover Windows separator/prefix handling for internal paths and external import deferral due platform drag/drop instability] Record platform compatibility evidence.
- [x] 9.9 [P1][depends:9.1][I: modified-capability delta specs][O: archive note confirming `workspace-filetree-root-node` and `detached-file-explorer` add requirements without replacing existing requirement blocks][V: OpenSpec review note or archive checklist entry] Record modified capability delta semantics.
