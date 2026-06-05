## 1. Settings Model And UI

- [x] 1.1 Add `sessionAttributionMode` to app settings types, defaults, validation, and persistence.
- [x] 1.2 Default missing or invalid `sessionAttributionMode` to `related` without changing existing user behavior.
- [x] 1.3 Add a `设置 > 会话管理` radio group with `相关会话模式` and `当前工作区模式`.
- [x] 1.4 Add localized copy explaining the recovery-vs-isolation trade-off.

## 2. Frontend Mode Propagation

- [x] 2.1 Pass the effective attribution mode into workspace session catalog / thread hydration service calls for all engines.
- [x] 2.2 Ensure sidebar, Workspace Home, and Session Management read the same effective mode.
- [x] 2.3 Ensure Session Radar and `prewarmSessionRadarForWorkspace` use the same mode when hydrating workspace thread lists.
- [x] 2.4 Keep `related` as the default branch for existing callers that have not yet passed a mode.

## 3. Backend Projection And Engine History

- [x] 3.1 Add a backend enum for workspace session attribution mode with `related` and `workspace-only`.
- [x] 3.2 Extend session catalog / all engine listing query structs and Tauri command bindings to accept the mode.
- [x] 3.3 Preserve current scan dirs, cwd/git-root attribution, related worktree behavior, and tests under `related` for every engine.
- [x] 3.4 Add an independent `workspace-only` strategy / code path that does not call the existing `related` scanner/listing pipeline as its implementation.
- [x] 3.5 Implement `workspace-only` Claude candidate selection that scans exact + child-prefix Claude project dirs for the current workspace, without scanning global unrelated Claude project dirs for membership.
- [x] 3.6 Allow `workspace-only` to include session evidence equal to the selected workspace or inside its child paths.
- [x] 3.7 Prevent sibling, shared worktree family, and git-root-only related inference from widening `workspace-only` membership for all engines.
- [x] 3.8 Exclude or diagnose known-workspace conflicts where Claude project dir owner and transcript `cwd` owner disagree under `workspace-only`.
- [x] 3.9 Ensure Codex, Gemini, OpenCode, and future engine adapters cannot bypass shared mode-aware projection.
- [x] 3.10 Keep source completeness and diagnostics mode-aware.

## 4. Source Fact Cache

- [x] 4.1 Review Claude source fact cache namespace and cache payloads for mode-sensitive completeness evidence.
- [x] 4.2 Ensure cached transcript metadata can accelerate projection without caching final membership truth.
- [x] 4.3 Prevent related-mode cache status from proving workspace-only authoritative empty, and vice versa.

## 5. Tests And Validation

- [x] 5.1 Add Rust tests for default `related` compatibility across all participating engines.
- [x] 5.2 Add Rust tests excluding unrelated Claude project dir sessions under `workspace-only`.
- [x] 5.3 Add Rust tests preserving child cwd sessions and child-prefix Claude project dirs under `workspace-only`.
- [x] 5.4 Add frontend settings tests for radio rendering, persistence, and default fallback.
- [x] 5.5 Add Rust tests for project-dir-owner versus transcript-cwd conflict exclusion under `workspace-only`.
- [x] 5.6 Add backend tests proving `workspace-only` does not invoke or mutate the existing `related` path.
- [x] 5.7 Add backend tests proving Codex, Gemini, and OpenCode cannot bypass `workspace-only` membership.
- [x] 5.8 Add frontend hydration / Session Radar tests proving mode propagation, global Radar display compatibility, and no prewarm bypass.
- [x] 5.9 Run `openspec validate add-session-attribution-mode-setting --strict --no-interactive`.
- [x] 5.10 Run focused frontend and backend tests for touched files.
