# file-view-rendering-runtime-stability Specification

## Purpose

Defines the file-view-rendering-runtime-stability behavior contract, covering File view surfaces MUST share a stable render profile contract.
## Requirements
### Requirement: File view surfaces MUST share a stable render profile contract

The system MUST resolve file rendering through a shared render profile contract so that the main window file view and the detached file explorer use the same capability baseline for preview, edit, structured rendering, and fallback behavior.

#### Scenario: same file kind resolves consistently across surfaces
- **WHEN** the user opens the same workspace file in the main window file view and in the detached file explorer
- **THEN** both surfaces MUST resolve the same rendering kind for that file
- **AND** both surfaces MUST use the same fallback semantics when the file is not fully supported

#### Scenario: platform-normalized file path still resolves to one render profile
- **WHEN** the same logical file reaches the file view through different platform path forms, including Windows-style separators, Windows case variants, or macOS restored absolute paths
- **THEN** the system MUST normalize those path forms before render-profile resolution
- **AND** the resulting render kind and fallback behavior MUST remain equivalent across surfaces

#### Scenario: render decisions are shared across preview and edit
- **WHEN** the user switches between preview mode and edit mode for a supported text file
- **THEN** the system MUST derive preview language, editor language, and fallback behavior from the same render profile decision
- **AND** the mode switch MUST NOT require a second independent file-type inference path

### Requirement: File rendering MUST degrade safely without blank or broken states

The system MUST provide an explicit and readable fallback when a file cannot be rendered through a richer renderer, and it MUST NOT fail into blank content, stale content, or unhandled exceptions.

#### Scenario: unsupported binary files show an explicit fallback state
- **WHEN** the user opens a binary file type that does not have a dedicated preview renderer
- **THEN** the system MUST show an explicit unsupported-format fallback state
- **AND** it MUST NOT render an empty panel or a broken partial view

#### Scenario: unknown text files fall back to readable text rendering
- **WHEN** the user opens a text file type that is not covered by language-specific rules
- **THEN** the system MUST fall back to readable plain text or code-style preview
- **AND** the fallback MUST preserve access to the file content rather than treating it as a fatal error

### Requirement: File rendering MUST remain stable during file, tab, and mode transitions

The system MUST reconcile render state transitions when the user changes files, tabs, or modes so that content, active renderer, and navigation state stay aligned with the newly selected file.

#### Scenario: switching tabs does not leak previous renderer state
- **WHEN** the user switches from one open file tab to another file tab with a different rendering kind
- **THEN** the newly active file MUST render with its own resolved renderer state
- **AND** the system MUST NOT leave stale content, stale controls, or stale language markers from the previous file visible

#### Scenario: switching preview or edit mode does not blank the panel
- **WHEN** the user toggles between preview mode and edit mode for a supported file
- **THEN** the file content area MUST remain usable through the transition
- **AND** the system MUST NOT enter a transient blank state that requires reopening the file

### Requirement: Large or high-cost file previews MUST protect runtime responsiveness

The system MUST protect runtime responsiveness when rendering large files or high-cost preview content, and it MUST support bounded degradation instead of unbounded main-thread work.

#### Scenario: first-phase degradation uses static size and line-count thresholds
- **WHEN** the system decides whether a file can stay on a richer preview path
- **THEN** it MUST use deterministic thresholds derived from file size, line count, and the existing `truncated` signal
- **AND** it MUST NOT depend on machine-local timing or device-specific render speed as the primary degradation trigger

#### Scenario: large text preview can degrade instead of blocking indefinitely
- **WHEN** the user opens a text file whose preview cost exceeds the safe rendering budget
- **THEN** the system MUST degrade to a lower-cost readable rendering strategy
- **AND** it MUST NOT block the UI indefinitely while attempting the richest preview

#### Scenario: truncated file bypasses richer preview paths
- **WHEN** the file read result already reports `truncated=true`
- **THEN** the file view MUST bypass richer Markdown, structured, and high-cost highlighted preview paths
- **AND** it MUST converge to the readable low-cost fallback defined by the render profile for that file

#### Scenario: renderer changes do not introduce high-frequency IPC churn
- **WHEN** the user scrolls, hovers, drags, or performs other high-frequency interactions inside the file view
- **THEN** the system MUST NOT introduce new per-interaction Tauri command calls as part of rendering stability handling
- **AND** render-state maintenance MUST remain local to the frontend unless a file content refresh is explicitly required

#### Scenario: external file monitoring does not disturb stable preview by default
- **WHEN** a file preview is open in default reading mode
- **AND** external monitoring detects a clean-buffer disk update
- **THEN** the file view MUST NOT automatically rebuild high-cost preview DOM
- **AND** it MUST preserve the current preview snapshot until the user requests refresh or live preview explicitly advances it

### Requirement: Main File Preview MUST Remain A Stable Reading Snapshot By Default

The main window file preview MUST NOT start external file-content polling solely because a workspace file is open. Background content refresh for the main file view MUST require an explicit user-visible mode that enables live external-change awareness.

#### Scenario: main markdown preview does not poll by default

- **WHEN** a user opens a Markdown file in the main window file module
- **AND** live edit preview is disabled
- **THEN** the main file preview MUST NOT enable external-change monitoring for that opened file
- **AND** the preview MUST remain a stable reading snapshot until the user performs an explicit refresh, save, file switch, or opt-in action

#### Scenario: explicit live preview can enable monitoring

- **WHEN** a user opens a file in the main window file module
- **AND** live edit preview is enabled
- **THEN** the main file view MAY enable external-change monitoring for the active file
- **AND** any resulting content refresh MUST continue to use the existing dirty-buffer conflict protection

### Requirement: Markdown Preview Interactive Blocks MUST Preserve User View Selection

Markdown preview interactive blocks MUST preserve user-selected view state across parent re-renders, Markdown AST subtree rebuilds, and same-document preview remounts. A Mermaid block that the user switched to rendered view MUST NOT silently revert to source view unless the user changes files, changes the block identity, or explicitly selects source.

#### Scenario: mermaid rendered view survives same-document remount

- **WHEN** a user opens a Markdown document in the main file module
- **AND** the user switches a Mermaid block from source view to rendered view
- **AND** the same Markdown document preview subtree is remounted or rebuilt
- **THEN** the Mermaid block MUST restore rendered view for the same document and block identity
- **AND** it MUST NOT return to source view solely because the preview surface re-rendered

### Requirement: Main File Preview MUST Separate External Change Awareness From Forced Refresh

The main window file preview and editor MUST detect external changes for the active file without forcing a reading snapshot refresh or editor content replacement unless the user explicitly requests refresh, resolves a conflict, or an explicit live preview mode is active.

#### Scenario: clean stable preview reports external change without replacing content

- **WHEN** a user has a workspace file open in the main window file view
- **AND** the file buffer is clean
- **AND** live edit preview is disabled
- **AND** the same file changes on disk
- **THEN** the file view MUST expose an external-change notice for that file
- **AND** it MUST NOT replace the current `content` or Markdown preview snapshot automatically

#### Scenario: user refresh applies pending external content

- **WHEN** the main file view has a pending clean external-change notice
- **AND** the user chooses to refresh from disk
- **THEN** the file view MUST apply the pending disk content to the file state
- **AND** the reading preview MAY rebuild from that explicit refresh

#### Scenario: dirty buffer keeps conflict protection

- **WHEN** a user has unsaved local edits in the open file
- **AND** the same file changes on disk
- **THEN** the file view MUST keep the local dirty buffer intact
- **AND** it MUST expose the existing conflict handling path instead of applying disk content automatically

#### Scenario: self-save watcher feedback does not force editor reload

- **WHEN** the app saves the active editor buffer to disk
- **AND** the file watcher reports the same saved snapshot
- **THEN** the file view MUST suppress redundant full-content reload or high-cost reparse
- **AND** the editor MUST keep the saved buffer visible without treating that event as an external conflict

### Requirement: Main File Preview MUST Avoid Refresh-Induced IPC Churn

The main window file preview MUST keep external-change awareness bounded to the active file and MUST NOT introduce new IPC calls from high-frequency render interactions.

#### Scenario: preview interactions do not poll per interaction

- **WHEN** the user scrolls, hovers, selects text, or interacts with Markdown preview controls
- **THEN** the file view MUST NOT issue additional file-content IPC reads for each interaction
- **AND** external-change detection MUST remain governed by the configured monitoring interval or watcher events

#### Scenario: editor startup does not duplicate full file reads for awareness

- **WHEN** a user opens a workspace file in the editor
- **AND** external-change awareness is enabled
- **THEN** the file view MUST use the initial file load as the current content snapshot
- **AND** event-mode external monitoring MUST NOT immediately issue a second full-content read without an external change event

#### Scenario: native metadata fallback does not become JS full-content polling

- **WHEN** native file watching is unavailable or disabled
- **AND** the backend monitor falls back to metadata polling
- **THEN** the frontend MUST continue to consume backend change events
- **AND** it MUST NOT switch to repeated JS-side full-content polling unless backend monitor configuration fails completely

### Requirement: File view side channels MUST remain bounded during interaction

External change awareness, git markers, annotations, preview refresh, and code intelligence MUST remain side channels that cannot block editor typing, line switching, or first useful viewport rendering.

#### Scenario: git marker delay does not block editor mount

- **WHEN** a user opens a modified workspace file
- **AND** git marker loading is slow or fails
- **THEN** the editor MUST still mount with file content when the document snapshot is ready
- **AND** markers MAY appear later or degrade to empty markers
- **AND** marker results MUST verify current file identity and render epoch before committing

#### Scenario: code intelligence does not run for every cursor move

- **WHEN** the user moves the cursor repeatedly inside an editor
- **THEN** code intelligence requests MUST be explicit, debounced, or otherwise bounded
- **AND** cursor movement MUST NOT issue one backend command per movement by default

#### Scenario: stable preview does not refresh on every editor draft change

- **WHEN** the user edits a file in editor mode
- **AND** live preview mode is not active
- **THEN** Markdown or structured preview snapshots MUST NOT rebuild on every editor draft change
- **AND** preview MAY refresh on explicit preview switch, save, external refresh, or bounded idle publication

### Requirement: Runtime stability evidence MUST classify file interaction lag

File view performance evidence MUST classify whether observed lag is caused by IO, editor render, tab remount, preview work, side-channel work, or concurrent realtime pressure when enough signals are available.

#### Scenario: evidence classifies unsupported measurements

- **WHEN** runtime tooling cannot measure a file interaction dimension directly
- **THEN** the report MUST classify that dimension as `proxy`, `manual-only`, or `unsupported`
- **AND** it MUST NOT claim release-grade measured improvement for that dimension

### Requirement: Markdown Scroll Interaction MUST Remain Responsive Under Preview Pressure

Long Markdown file preview scrolling MUST remain bounded in frontend work, and preview-side rendering work MUST NOT block unrelated file view controls, tab switching, or editor state.

#### Scenario: scroll does not trigger markdown compile
- **WHEN** the user scrolls up and down inside a rendered Markdown preview
- **THEN** the system MUST NOT run Markdown parse, sanitize, outline extraction, or file-content IPC reads solely because of scroll position changes
- **AND** scroll-related work MUST remain local to already-rendered DOM, reveal scheduling, or viewport bookkeeping.

#### Scenario: reveal work is scheduled without starving controls
- **WHEN** progressive or bounded preview reveal work is pending
- **THEN** file view controls such as edit/preview toggle, tab close, and annotation draft input MUST remain interactive
- **AND** pending reveal work MUST be cancellable or ignored when the file identity changes.

#### Scenario: concurrent runtime pressure slows markdown reveal cadence
- **WHEN** foreground engine processing, split chat, or another configured render-pressure signal is active
- **THEN** Markdown preview MAY slow progressive reveal cadence
- **AND** it MUST NOT switch to unbounded full-document rich rendering during that pressure window.

### Requirement: Markdown Performance Evidence MUST Distinguish Body Work From Overlay Work

File view performance evidence MUST classify Markdown lag sources separately for body compile/render, annotation overlay updates, outline navigation, heavy block hydration, image load, and external file IO.

#### Scenario: evidence classifies annotation overlay cost
- **WHEN** annotation draft or marker updates are observed during Markdown preview
- **THEN** diagnostics MUST classify whether the update affected only annotation overlay or also forced body render work
- **AND** it MUST NOT report the update as body-render-only without evidence.

#### Scenario: evidence classifies fast fallback reason
- **WHEN** Markdown preview falls back from fast to rich rendering
- **THEN** diagnostics MUST expose a bounded fallback reason such as compile failure, sanitizer failure, local image island unsupported, Mermaid island unsupported, or annotation placement unsupported
- **AND** it MUST NOT include raw Markdown or annotation body content.

