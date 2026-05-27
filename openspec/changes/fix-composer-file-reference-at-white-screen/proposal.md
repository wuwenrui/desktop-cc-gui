## Why

Issue `desktop-cc-gui#618` reports that on macOS, typing `@` in the composer and referencing a file can make the app surface turn blank. Follow-up feedback on the same issue says typing `/` can also blank the app, which means the shared composer completion surface must degrade locally across trigger types instead of trusting runtime payloads.

## 目标与边界

- 目标：`ChatInputBox` 的 `@` file reference completion MUST remain recoverable when provider data, lazy workspace children, or rich-tag rendering contains unexpected values.
- 目标：`ChatInputBox` 的 `/` slash command completion MUST remain recoverable when custom command props or SDK/bridge payloads contain unexpected values.
- 目标：completion provider MUST normalize and deduplicate file/directory items before rendering the dropdown.
- 目标：shared completion dropdown mapping MUST skip malformed individual items without dropping the whole completion session.
- 目标：file tag rendering failures MUST be logged and isolated to composer state, without tearing down the app shell.
- 边界：只处理 composer completion provider/dropdown/rendering 的稳定性，不重做 workspace scan、file open、message send、slash command execution 或 context ledger semantics。

## What Changes

- Harden composer file-reference completion inputs by filtering invalid paths, trimming blank entries, and deduplicating stable completion item keys.
- Harden lazy workspace directory-child mapping so malformed Tauri payloads do not crash dropdown rendering.
- Harden slash command completion inputs by filtering malformed project custom commands and SDK/bridge slash command payload entries.
- Harden shared completion dropdown mapping so one malformed item does not tear down the whole dropdown session.
- Add local guardrails around file-tag DOM rendering so an inline reference render failure does not propagate as a white-screen failure.
- Add focused regression tests covering invalid/duplicate completion source entries, recoverable `@` file reference behavior, and malformed `/` slash command payloads.

## 非目标

- 不改变 `@path` token format 或 existing file-reference extraction behavior.
- 不改变 `/command` insertion format 或 slash command execution behavior.
- 不改变 backend workspace directory listing contract beyond frontend defensive consumption.
- 不引入新的 completion UI framework 或第三方依赖。
- 不修复与本问题无关的 active file reference、drag-drop reference 或 context attribution 行为。

## 技术方案对比

| 方案 | 做法 | 优点 | 缺点 | 结论 |
| --- | --- | --- | --- | --- |
| A | 只在 `ErrorBoundary` 捕获白屏 | 改动小 | 用户仍会丢失 composer interaction；根因仍可重复触发 | 不采用 |
| B | 在 completion provider 与 tag renderer 边界做 defensive normalization / isolation | 局部修复，高频路径可恢复，契约清晰 | 需要补 focused tests | 采用 |
| C | 重写 `ChatInputBox` 为 textarea 或全新 mention engine | 可彻底规避 contenteditable 风险 | 过度设计，回归面大，不符合当前 issue 范围 | 不采用 |

## Capabilities

### New Capabilities

- `composer-file-reference-completion-stability`: Defines recoverability and data-normalization requirements for composer `@` file-reference completion, `/` slash command completion, and shared completion dropdown rendering.

### Modified Capabilities

- None.

## Impact

- Frontend composer code:
  - `src/features/composer/components/ChatInputBox/ChatInputBoxAdapter.tsx`
  - `src/features/composer/components/ChatInputBox/hooks/useFileTags.ts`
  - `src/features/composer/components/ChatInputBox/hooks/useCompletionDropdown.ts`
  - `src/features/composer/components/ChatInputBox/providers/slashCommandProvider.ts`
  - related focused tests under `src/features/composer/components/ChatInputBox/`
- No backend API, storage schema, or dependency changes.

## 验收标准

- Given malformed, blank, or duplicate file/directory paths are supplied to composer file completion, when the user types `@`, then dropdown item generation MUST not throw and MUST show only valid unique entries.
- Given lazy workspace children return unexpected entries, when file completion searches a nested directory, then invalid children MUST be skipped without crashing the app.
- Given project custom commands or SDK slash commands contain malformed entries, when the user types `/`, then invalid entries MUST be skipped without crashing the app on macOS, Windows, or Linux.
- Given a completion item mapper fails for one item, when a dropdown search resolves, then valid items MUST remain selectable and aligned with their raw payloads.
- Given file tag rendering encounters a DOM/runtime exception, when the user continues typing, then the exception MUST be logged and composer/app shell MUST remain interactive.
- Focused Vitest coverage MUST pass for the touched composer file-reference path.

## Implementation Closure

- Implemented frontend normalization and deduplication in `ChatInputBoxAdapter`.
- Implemented slash command payload normalization in `ChatInputBoxAdapter` and `slashCommandProvider`.
- Implemented shared completion dropdown item-mapping isolation in `useCompletionDropdown`.
- Implemented local render-failure isolation in `useFileTags`.
- Validation passed:
  - `npx vitest run src/features/composer/components/ChatInputBox/hooks/useTriggerDetection.test.tsx src/features/composer/components/ChatInputBox/hooks/useFileTags.test.tsx src/features/composer/components/ChatInputBox/ChatInputBoxAdapter.test.tsx`
  - `npx vitest run src/features/composer/components/ChatInputBox/hooks/useCompletionDropdown.test.tsx src/features/composer/components/ChatInputBox/providers/slashCommandProvider.test.ts src/features/composer/components/ChatInputBox/ChatInputBoxAdapter.test.tsx`
  - `npm run typecheck`
  - `openspec validate fix-composer-file-reference-at-white-screen --strict --no-interactive`
