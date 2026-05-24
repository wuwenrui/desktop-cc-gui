## ADDED Requirements

### Requirement: File open rendering MUST use staged pipeline boundaries

Opening a file MUST be processed through explicit session, document snapshot, render model, viewport projection, and scheduled commit boundaries instead of coupling file read completion directly to full preview DOM rendering.

#### Scenario: file read completion does not require full preview mount
- **WHEN** a supported text file finishes reading
- **THEN** the system MUST be able to commit the file header, tab state, and initial viewport preview before rendering offscreen lines or blocks
- **AND** the system MUST NOT require all lines, all highlighted HTML, or all preview blocks to be computed before the first useful file view appears

#### Scenario: render model remains separate from tab session state
- **WHEN** a file is added to the open tab list
- **THEN** tab session state MUST store lightweight identity and navigation information
- **AND** high-cost content parsing, Markdown compilation, syntax highlighting, or DOM mounting MUST be scoped to the active file unless explicitly scheduled as bounded background work

#### Scenario: switching active files invalidates stale render work
- **WHEN** the user switches from file A to file B while file A has pending background render work
- **THEN** pending work for file A MUST NOT commit into file B's view
- **AND** file B MUST render from its own document snapshot and render profile

#### Scenario: document snapshot owns content-derived metadata
- **WHEN** a supported text file is loaded for preview
- **THEN** content-derived metadata such as `contentHash`, byte length, line count, snapshot version, and bounded line access MUST be owned by the document snapshot or render model boundary
- **AND** large preview surfaces MUST NOT independently repeat full-document split, byte-length encoding, or hash scans during normal render

### Requirement: Scheduled file render work MUST be versioned and cancellable

Deferred file rendering work MUST be guarded by file identity, snapshot version, and render epoch so stale background work cannot commit after tab switches, snapshot replacement, or unmount.

#### Scenario: stale deferred work is ignored
- **WHEN** visible row highlighting, Markdown progressive chunks, heavy block rendering, or clean external refresh work is scheduled for snapshot A
- **AND** the active file, snapshot version, render epoch, or component mount state changes before that work completes
- **THEN** the work MUST be cancelled or ignored before committing React state
- **AND** it MUST NOT mutate the currently visible file view

#### Scenario: external refresh uses current snapshot guard
- **WHEN** a pending clean disk refresh is applied after delay or render pressure
- **THEN** the refresh MUST verify the active file identity, dirty state, and expected snapshot version before replacing the preview snapshot
- **AND** failed guards MUST leave the current preview and dirty/conflict semantics intact

### Requirement: Code preview MUST render through a viewport-bounded projection

Code preview MUST avoid unbounded full-document DOM rendering and MUST render only the active viewport plus bounded overscan.

#### Scenario: large code file mounts bounded rows
- **WHEN** the user opens a large code file with thousands of lines in preview mode
- **THEN** the preview MUST mount only viewport-visible rows plus a bounded overscan region
- **AND** it MUST NOT mount one DOM row per source line as the default large-file strategy

#### Scenario: visible code highlighting is bounded
- **WHEN** syntax highlighting is enabled for a large code preview
- **THEN** highlighting MUST be computed for visible or scheduled rows through a bounded cache or equivalent strategy
- **AND** the renderer MUST NOT synchronously highlight every source line before first paint

#### Scenario: large code preview uses bounded line access
- **WHEN** the code preview renders a large file
- **THEN** it MUST use line count plus bounded line access for visible rows
- **AND** it MUST NOT require a full `lines` array allocation as the default large-file render path

#### Scenario: code preview interactions survive virtualization
- **WHEN** the user selects preview lines, starts an AI annotation, sees Git added/modified markers, or navigates to a line
- **THEN** the virtualized preview MUST preserve the same line numbers and interaction semantics as the non-virtualized preview
- **AND** annotation drafts MUST remain editable without being lost by row recycling

### Requirement: File tree rendering MUST use flat viewport projection for large visible trees

The file tree MUST render expanded entries through a flat visible-row projection when the visible tree is large enough to risk main-thread stalls.

#### Scenario: expanded large directory mounts bounded tree rows
- **WHEN** a workspace directory expands to a large visible tree
- **THEN** the file tree MUST render visible rows through a viewport-bounded list
- **AND** it MUST NOT recursively mount the full expanded tree as DOM when virtualization is active

#### Scenario: tree virtualization preserves existing input semantics
- **WHEN** the user clicks, double-clicks, opens context menu, drags, uses macOS `Meta` multi-select, uses Windows `Ctrl` multi-select, or uses Shift range selection
- **THEN** the file tree MUST preserve the existing selection, open, drag, and context menu semantics
- **AND** virtualization MUST remain an implementation detail

#### Scenario: virtualized tree preserves layout focus semantics
- **WHEN** rows are recycled by file tree virtualization
- **THEN** root actions, context menu anchoring, active selection/focus, and scroll position MUST remain stable
- **AND** row measurement updates MUST NOT create visible scroll jumps during normal tree interaction

### Requirement: File rendering MUST coordinate with active engine render pressure

File rendering MUST treat active engine processing in editor split as foreground render pressure and defer non-urgent file preview work.

#### Scenario: engine streaming keeps file preview in passive mode
- **WHEN** an engine conversation is actively streaming or thinking
- **AND** the editor split keeps chat and file preview visible at the same time
- **THEN** file preview MUST keep already visible content stable
- **AND** non-urgent work such as offscreen highlighting, Markdown progressive chunks, heavy block rendering, and clean external refresh application MUST be deferred or rate-limited

#### Scenario: first visible file content remains urgent
- **WHEN** the user explicitly opens or activates a file during engine processing
- **THEN** the system MUST still render the first useful viewport for that active file
- **AND** only non-visible or non-urgent work MAY be deferred

#### Scenario: file scheduler does not mutate conversation semantics
- **WHEN** file rendering consumes render-pressure information from layout or app state
- **THEN** it MUST NOT change conversation reducer state, realtime event ordering, or message identity
- **AND** the coordination MUST remain a file-rendering scheduling concern

#### Scenario: render pressure is passed through a narrow layout-derived signal
- **WHEN** file rendering needs to know that active engine processing and editor split chat are visible
- **THEN** the pressure state MUST be derived near layout composition and passed to file surfaces as a narrow signal
- **AND** file components MUST NOT import conversation reducers, realtime internals, or message timeline implementation details

### Requirement: Editor line-range tracking MUST not block cursor interaction

Editor cursor and selection changes MUST keep the file editor responsive and MUST NOT synchronously force cross-surface recomputation for every line click.

#### Scenario: editor line affordance updates locally first
- **WHEN** the user clicks or selects a different line in editor mode
- **THEN** the file panel MAY update its local line label and annotation affordance immediately
- **AND** that local update MUST NOT require app-shell or Composer active-file reference state to round-trip first

#### Scenario: composer file reference publication is delayed and coalesced
- **WHEN** editor line range changes repeatedly through clicks, cursor movement, or drag selection
- **THEN** the global active-file line reference consumed by Composer/context ledger MUST be published through a delayed, coalesced, or low-priority path
- **AND** intermediate line ranges MAY be dropped as long as the latest range is available before send/context injection

#### Scenario: delayed editor range publication cannot target stale files
- **WHEN** the active file, view surface, or component mount state changes while a line-range publication is pending
- **THEN** the pending publication MUST be cancelled or ignored
- **AND** it MUST NOT publish a stale line range for a previously active file

### Requirement: Editor annotation controls MUST remain footer-scoped and range-safe

Editor-mode AI annotation controls MUST stay attached to the current file footer context, and CodeMirror annotation widgets MUST be inserted in a deterministic range order.

#### Scenario: edit-mode annotation action is not rendered as a top editor toolbar
- **WHEN** the user selects or clicks a line in editor mode
- **THEN** the file body MUST NOT render a sticky top annotation toolbar above CodeMirror
- **AND** the visible `标注给 AI` action SHOULD live in the bottom current-file footer alongside the file name and local line label

#### Scenario: footer does not expose redundant path state toggle
- **WHEN** the current-file footer is visible
- **THEN** it MUST NOT render a `路径已关联 / 路径已关闭` toggle button inside FileViewPanel
- **AND** removing that footer toggle MUST NOT remove Composer's underlying active-file reference inclusion contract

#### Scenario: footer controls avoid nested button borders
- **WHEN** the current-file footer displays file name, line label, annotation action, icon actions, or open-app controls
- **THEN** those inner controls SHOULD avoid nested per-button border chrome
- **AND** the footer MUST remain usable with existing hover/focus affordances

#### Scenario: edit annotation widgets are added in CodeMirror range order
- **WHEN** existing edit-mode annotation markers and a new annotation draft target different source lines
- **THEN** the editor MUST add marker and draft widgets to CodeMirror sorted by target line and widget side
- **AND** a draft targeting a line before a later marker MUST NOT trigger a `Ranges must be added sorted` runtime error

#### Scenario: same-line marker remains before draft widget
- **WHEN** an existing edit-mode annotation marker and the active draft target the same line
- **THEN** the marker widget MUST be ordered before the draft widget for that line
- **AND** this ordering MUST be covered by focused regression tests

### Requirement: External file sync MUST advance previews through stable snapshot rules

External file monitoring MUST not directly force high-cost preview rebuilds when the current user context is under render pressure or in default stable reading mode.

#### Scenario: clean external update remains pending during render pressure
- **WHEN** external monitoring detects a clean disk update for the active file
- **AND** the file preview is in default stable preview mode under render pressure
- **THEN** the system MUST retain the current preview snapshot
- **AND** it MUST expose a pending refresh or changed-file affordance instead of immediately rebuilding high-cost preview DOM

#### Scenario: live preview can advance with guards
- **WHEN** live edit preview is explicitly enabled
- **AND** the disk snapshot differs from the visible preview snapshot
- **THEN** the system MAY advance the preview snapshot
- **AND** it MUST use debounce, content hash equality, or equivalent guards to avoid redundant rebuilds

#### Scenario: dirty buffer conflict behavior remains unchanged
- **WHEN** the user has unsaved edits
- **AND** an external disk update is detected for the same file
- **THEN** the system MUST preserve the existing conflict behavior
- **AND** it MUST NOT silently overwrite the dirty buffer for performance reasons

### Requirement: Secondary file preview surfaces MUST respect bounded rendering

Secondary file preview surfaces MUST not bypass the staged file rendering pipeline by performing unbounded full-document preview work.

#### Scenario: hover preview does not reintroduce full code rendering
- **WHEN** a file hover popover previews text or code content
- **THEN** it MUST reuse bounded snapshot line access/highlight cache or cap itself to a deterministic low-cost line budget
- **AND** it MUST NOT synchronously split, highlight, and mount all lines for large files

#### Scenario: structured preview degrades before full parse on large input
- **WHEN** a structured shell/dockerfile preview exceeds the deterministic preview budget
- **THEN** it MUST degrade to bounded code/text preview or another low-cost readable fallback
- **AND** it MUST NOT parse and highlight the full file during the file-open hot path

### Requirement: File rendering evidence MUST cover high-cost open scenarios

The change MUST provide evidence for the high-cost scenarios that motivated the refactor, or explicitly classify unavailable evidence.

#### Scenario: evidence includes code markdown tree and streaming pressure
- **WHEN** the change is prepared for closeout
- **THEN** validation evidence MUST cover large code preview, large Markdown preview, large expanded file tree, external sync during preview, and editor split with active engine streaming
- **AND** each scenario MUST be classified as measured, proxy, unsupported, or manual-only according to available tooling

#### Scenario: generic long-list evidence is only proxy evidence
- **WHEN** runtime evidence uses existing long-list browser scroll results
- **THEN** that evidence MAY support virtualization confidence only as proxy evidence
- **AND** the closeout MUST still include file-open-specific evidence or explicitly classify each missing file-open scenario

#### Scenario: platform evidence remains explicit
- **WHEN** Windows or macOS runtime evidence is unavailable
- **THEN** the closeout MUST state the missing platform, residual risk, and intended follow-up
- **AND** it MUST NOT infer Windows pass from macOS evidence or macOS pass from Windows evidence
