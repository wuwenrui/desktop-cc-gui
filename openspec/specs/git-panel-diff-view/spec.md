# git-panel-diff-view Specification

## Purpose

Defines the git-panel-diff-view behavior contract, covering Dual List View Modes.
## Requirements
### Requirement: Dual List View Modes

The Git panel SHALL support two file-list view modes: `flat` and `tree`.

#### Scenario: Default mode remains flat

- **WHEN** user opens Git panel for a workspace without saved preference
- **THEN** panel SHALL render file list in flat mode

#### Scenario: User switches to tree mode

- **WHEN** user clicks the view switch control to `tree`
- **THEN** panel SHALL render changed files grouped by directory hierarchy

#### Scenario: Mode preference persistence

- **WHEN** user selects a view mode and reopens the workspace
- **THEN** the selected mode SHALL be restored

---

### Requirement: Tree Hierarchy Interaction

Tree mode SHALL support folder expand/collapse, file selection, and section-scoped commit inclusion toggles.

#### Scenario: Expand folder

- **WHEN** user expands a folder node
- **THEN** its child folders/files SHALL be visible

#### Scenario: Collapse folder

- **WHEN** user collapses a folder node
- **THEN** its descendants SHALL be hidden

#### Scenario: File metadata visibility

- **WHEN** tree mode renders file nodes
- **THEN** each node SHALL show file status and additions/deletions summary

---

#### Scenario: Folder checkbox reflects descendant commit inclusion state

- **WHEN** tree mode renders a folder inside one section
- **THEN** its checkbox SHALL reflect descendant file inclusion as `none`, `partial`, or `all`
- **AND** toggling that checkbox SHALL apply only to descendant files inside the same section

### Requirement: Single File Diff Focus in Tree Mode

Selecting a file in tree mode SHALL focus diff viewer on that file.

#### Scenario: Select file in tree

- **WHEN** user clicks a file node in tree mode
- **THEN** diff viewer SHALL show that file as focused diff content

#### Scenario: Clear focus

- **WHEN** user triggers “back to all” or clears selection
- **THEN** diff viewer SHALL return to non-focused aggregate state

---

### Requirement: File-Header Controls in Tree Focus Mode

In tree single-file focus mode, diff controls SHALL be attached to the current file header.

#### Scenario: Diff layout switch on file header

- **WHEN** user toggles split/unified controls in file header
- **THEN** current file diff SHALL switch between split and unified layout

#### Scenario: Diff content mode switch on file header

- **WHEN** user toggles `全文查看/区域查看` in file header
- **THEN** content mode SHALL apply to current focused file only

#### Scenario: No duplicated top toolbar

- **WHEN** file-header controls are available
- **THEN** top-level duplicated diff toolbar SHALL NOT be rendered

---

### Requirement: Full View Uses Full-Context Diff

`全文查看` SHALL render full-context diff (including unchanged lines), not only patch-near context.

#### Scenario: Full view data source

- **WHEN** user switches current file to `全文查看`
- **THEN** frontend SHALL request full-context diff for that file
- **AND** full view SHALL include unchanged lines in diff rendering

#### Scenario: Full view status feedback

- **WHEN** full-context diff request resolves
- **THEN** UI SHALL expose request state via button label/status (`FULL/EMPTY/ERR/...`)

---

### Requirement: Floating Change Anchors in Full View

Tree full-view mode SHALL provide floating anchor navigation between change groups.

#### Scenario: Anchor visibility

- **WHEN** current file is in tree mode and `全文查看`
- **THEN** floating anchor control SHALL be visible near diff viewport bottom-right

#### Scenario: Anchor grouping rule

- **WHEN** computing anchors for a file
- **THEN** contiguous changed lines SHALL be grouped as one anchor
- **AND** only line-number jumps create a new anchor

#### Scenario: Anchor navigation

- **WHEN** user clicks prev/next anchor button
- **THEN** viewport SHALL scroll to corresponding change anchor
- **AND** anchor counter SHALL update as `current/total`

---

### Requirement: Backward Compatibility for Git Actions

Existing Git actions and commit inclusion controls SHALL remain available in both view modes without breaking current diff workflows.

#### Scenario: Flat mode regression gate

- **WHEN** changes for tree keyboard/a11y/shortcut behavior are merged
- **THEN** automated regression checks SHALL cover flat mode Stage/Unstage/Revert and commit basics

#### Scenario: Tree interaction test coverage

- **WHEN** feature is implemented
- **THEN** automated tests SHALL cover tree build logic and focus-switch behavior

#### Scenario: Stage/Unstage/Revert in tree mode

- **WHEN** user performs stage/unstage/revert from tree mode
- **THEN** operation behavior SHALL match flat mode semantics

#### Scenario: Commit inclusion controls remain available in both modes

- **WHEN** user switches between `flat` and `tree`
- **THEN** both modes SHALL expose explicit controls to include or exclude files from the next commit

#### Scenario: View switch preserves section-scoped inclusion truth

- **WHEN** user stages / unstages files or changes commit inclusion in one mode and then switches view mode
- **THEN** the other mode SHALL reflect the same section-scoped inclusion state
- **AND** staged / unstaged file counts SHALL remain consistent after the switch

### Requirement: Tree Hierarchy Interaction Accessibility

Tree mode SHALL expose baseline accessibility semantics for assistive technology.

#### Scenario: Tree semantics for folders

- **WHEN** tree renders folder nodes
- **THEN** folder controls SHALL expose `aria-expanded`

#### Scenario: List semantics for actionable nodes

- **WHEN** tree renders selectable nodes
- **THEN** nodes SHALL expose descriptive labels and selected state metadata

---

### Requirement: Git Diff Panel MUST Expose Stable File Preview Affordances

The Git diff panel MUST expose explicit file-scoped preview affordances, and live workspace file review flows opened from those affordances MUST be able to escalate into editable review without breaking existing Git actions or selection semantics.

#### Scenario: file preview action is explicit from changed file rows

- **WHEN** a changed file row is visible in the Git diff panel
- **THEN** the row SHALL expose an explicit preview/open action
- **AND** the action SHALL be distinguishable from include/exclude, stage, unstage, discard, and selection controls

#### Scenario: commit scope outline stays visible in dense panels

- **WHEN** the user is selecting files for commit scope in a dense or high-contrast layout
- **THEN** selected commit-scope controls SHALL have a visible outline or equivalent state boundary
- **AND** the state SHALL remain distinguishable from hover-only styling

#### Scenario: file-scoped review entry can open editable review for live workspace diff

- **WHEN** the user opens a file-scoped live workspace diff review entry from the Git panel
- **THEN** the system MUST allow that review flow to enter editable review mode for the same file
- **AND** saving from that review flow MUST refresh the Git panel's live diff state

### Requirement: Remote Backend Git Diff Panel Reads

The Git Diff panel SHALL execute read-only repository discovery and diff/status reads against the active backend location. In remote daemon mode, desktop Git commands for status, root scanning, diffs, file full diff, and remote URL lookup MUST delegate to daemon RPC instead of reading local desktop workspace state or filesystem paths.

#### Scenario: Remote workspace root scan uses daemon repository state

- **WHEN** the app is in remote daemon mode and the user scans Git roots from the Git Diff panel
- **THEN** the desktop command MUST call daemon RPC `list_git_roots` with the requested `workspaceId` and `depth`
- **AND** the returned repository candidates MUST come from daemon-side workspace paths

#### Scenario: Remote diff panel reads use daemon repository state

- **WHEN** the app is in remote daemon mode and the Git Diff panel refreshes status, changed file diffs, full file diff, or remote URL
- **THEN** the corresponding desktop command MUST call daemon RPC for that Git method
- **AND** it MUST NOT resolve Git repositories from local desktop filesystem state

#### Scenario: Local diff panel behavior remains unchanged

- **WHEN** the app is in local backend mode and the Git Diff panel refreshes Git state
- **THEN** existing local Tauri Git command behavior, return shape, and error semantics MUST be preserved

#### Scenario: Remote scan error settles loading state

- **WHEN** daemon-side Git root scanning returns an error such as `workspace not found`
- **THEN** the Git Diff panel MUST surface the error through the existing scan error state
- **AND** the loading state MUST settle

### Requirement: Git Diff Panel SHALL Use Canonical Change Projection

The Git Diff panel SHALL derive visible changed-file rows from a canonical projection that reconciles status entries and diff entries before rendering file lists or diff viewer inputs.

#### Scenario: Status entries remain authoritative
- **WHEN** a path exists in staged or unstaged status entries and matching diff evidence is available
- **THEN** the Git Diff panel MUST preserve the status-derived path, status, section, additions, deletions, and existing action semantics
- **AND** diff evidence MUST only enrich preview content or media metadata

#### Scenario: Diff-only added file remains visible
- **WHEN** diff evidence contains a file that is not present in the status-derived file list
- **AND** the diff evidence indicates a new file through optional status, `new file mode`, or `--- /dev/null`
- **THEN** the Git Diff panel MUST render that path as an added file instead of silently dropping it

#### Scenario: Diff-only deleted file remains visible
- **WHEN** diff evidence contains a file that is not present in the status-derived file list
- **AND** the diff evidence indicates deletion through optional status, `deleted file mode`, or `+++ /dev/null`
- **THEN** the Git Diff panel MUST render that path as a deleted file instead of silently dropping it

#### Scenario: Diff-only fallback entry is preview-only
- **WHEN** canonical projection creates a visible row from diff evidence without matching staged or unstaged status evidence
- **THEN** that row MUST allow non-mutating preview and focus behavior
- **AND** it MUST NOT expose stage, unstage, discard, or commit inclusion mutation controls until section state is confirmed by status evidence

#### Scenario: Staged and unstaged same-path state is preserved
- **WHEN** the same path has both staged and unstaged status entries
- **THEN** canonical projection MUST preserve both section-scoped entries
- **AND** stage, unstage, discard, preview, and commit inclusion controls MUST continue to target the same section semantics as before

#### Scenario: Canonical identities remain role-specific
- **WHEN** the same path appears in multiple Git panel responsibilities
- **THEN** file-list row identity MUST be section-scoped
- **AND** diff viewer identity MUST remain path-scoped
- **AND** mutation action identity MUST include section and operation semantics

### Requirement: Canonical Git Change Projection SHALL Be Cross-Platform

Canonical Git change projection SHALL behave consistently on Windows, macOS, Linux, and browser/Web Service surfaces.

#### Scenario: Path separators do not change file identity
- **WHEN** status or diff inputs refer to the same repository-relative file using `src/foo.ts` and `src\foo.ts`
- **THEN** canonical projection MUST treat them as the same logical Git path for merge purposes
- **AND** it MUST NOT rely on OS-specific path APIs to determine identity

#### Scenario: Line endings do not change status inference
- **WHEN** diff text uses LF or CRLF line endings
- **THEN** canonical projection MUST infer added, deleted, and modified fallback status consistently
- **AND** additions/deletions best-effort counting MUST classify `+` and `-` diff lines consistently across both line-ending styles

#### Scenario: Web Service and desktop use the same projection rules
- **WHEN** Git Diff panel data arrives from local desktop commands, remote daemon forwarding, or a Web Service-facing interface
- **THEN** the UI MUST apply the same canonical projection rules after data receipt
- **AND** Web-facing behavior MUST NOT diverge through a parallel status/diff merge implementation

#### Scenario: Incomplete Web-facing payloads are handled safely
- **WHEN** a Web-facing Git payload entry lacks `path`
- **THEN** canonical projection MUST discard that entry from visible changed-file rows
- **AND** it MUST use existing diagnostic/error reporting paths where available

#### Scenario: Missing diff does not create fallback entries
- **WHEN** a Web-facing or daemon diff payload omits `diff`
- **AND** no status-derived entry exists for that path
- **THEN** canonical projection MUST NOT synthesize a diff-only fallback row for that entry

### Requirement: Deleted File Rows SHALL Expose Explicit Deleted-State Visual Semantics

Deleted file rows in the Git Diff panel SHALL be visually distinguishable from modified and added files without changing existing actions or accessibility semantics.

#### Scenario: Deleted row uses explicit deleted styling
- **WHEN** a changed file row has status `D`
- **THEN** the row MUST expose a deleted-state visual treatment such as line-through, subdued text, or equivalent deleted affordance
- **AND** the status marker MUST remain distinguishable from added, modified, renamed, and typechange statuses

#### Scenario: Deleted styling preserves interaction affordances
- **WHEN** a deleted file row is selected, focused, hovered, or opened through keyboard interaction
- **THEN** the row MUST preserve existing focus, active, selected, preview, context menu, and commit inclusion affordances
- **AND** the deleted styling MUST NOT hide stage, unstage, discard, or preview controls that were available before

### Requirement: Git Diff Canonical Model SHALL Preserve Payload Compatibility

Git Diff panel canonical projection SHALL be compatible with existing local, remote daemon, and Web Service payloads that omit optional diff status.

#### Scenario: Optional diff status enriches projection
- **WHEN** a diff entry includes an optional status field
- **THEN** canonical projection MAY use that status for fallback entries
- **AND** status-derived staged or unstaged entries MUST still take precedence for existing paths

#### Scenario: Missing optional diff status remains supported
- **WHEN** a local, remote daemon, or Web-facing diff entry omits optional status
- **THEN** canonical projection MUST fall back to diff-header inference
- **AND** existing error handling, loading states, and return-shape compatibility MUST remain unchanged

#### Scenario: Rename headers infer rename display status
- **WHEN** a diff-only entry includes `rename from` and `rename to` headers
- **THEN** canonical projection MUST infer rename display status `R`
- **AND** it MUST NOT require deep rename pairing to preserve existing compatibility

### Requirement: Git Diff Canonical Model SHALL Respect Large-File Governance

Implementation of canonical Git change projection SHALL avoid increasing large-file debt and SHALL remain compatible with the large-file governance workflow.

#### Scenario: Implementation avoids mega-component growth
- **WHEN** canonical projection logic is implemented
- **THEN** merge, inference, path normalization, and stat counting logic MUST live in focused utility code rather than being embedded deeply in large React components
- **AND** component changes MUST remain thin wiring and presentation updates unless the design document records an explicit exception

#### Scenario: Large-file governance remains passable across OS matrix
- **WHEN** the change is ready for review
- **THEN** the implementation MUST be compatible with the workflow steps in `.github/workflows/large-file-governance.yml`
- **AND** it MUST remain suitable for `ubuntu-latest`, `macos-latest`, and `windows-latest` runners

### Requirement: Turn Semantic Diff Provides Evidence-Backed Review Facts

The session activity semantic diff SHALL provide evidence-backed review facts for a conversation turn, including deterministic diff-derived facts, validation command evidence, risk hints, and future AI review hints that reference evidence.

#### Scenario: Semantic facts carry structured evidence refs

- **WHEN** a semantic diff fact is rendered
- **THEN** the fact SHALL carry one or more structured evidence refs when concrete evidence exists
- **AND** the UI SHALL expose one compact evidence line without duplicating the same path in a second ref row
- **AND** file-backed evidence SHALL be actionable and open the referenced file line when line data exists
- **AND** long evidence labels and refs such as file paths SHALL wrap within the available surface instead of overflowing or being replaced by an ellipsis.

#### Scenario: Validation command evidence is connected

- **WHEN** a turn contains command events that run validation commands such as tests, lint, typecheck, or OpenSpec validation
- **THEN** the semantic diff SHALL render those commands as validation evidence
- **AND** completed commands SHALL be distinguished from failed commands.

#### Scenario: Test files are not treated as executed tests

- **WHEN** a turn changes test files but has no validation command evidence
- **THEN** the semantic diff MAY show a test-file coverage hint
- **AND** it SHALL NOT claim that tests were run successfully.

#### Scenario: TypeScript and React facts are extracted from hunks

- **WHEN** a turn's diff hunk adds TypeScript exports, React components, hooks, state hooks, or event handlers
- **THEN** the semantic diff SHALL describe those concrete facts when extractable
- **AND** it SHALL cite the file or hunk evidence.

#### Scenario: Test assertion facts are extracted from hunks

- **WHEN** a turn's diff hunk adds test cases or assertions
- **THEN** the semantic diff SHALL describe the added test coverage or assertion surface when extractable
- **AND** it SHALL keep confidence bounded to the diff evidence.

#### Scenario: AI review facts require evidence

- **WHEN** future AI review facts are supplied to the semantic diff model
- **THEN** facts without evidence refs SHALL be ignored
- **AND** AI-sourced facts SHALL render as review hints rather than verified deterministic facts.

#### Scenario: Deterministic facts remain visible with AI review

- **WHEN** AI review facts and deterministic rule facts are both available
- **THEN** the semantic diff SHALL preserve deterministic facts
- **AND** AI review SHALL augment rather than replace them.

### Requirement: Session Activity Shows Turn Artifacts And Semantic Diff

The session activity surface SHALL show which conversation turn produced which changed files and SHALL provide a turn-scoped semantic diff explaining likely change intent, behavior impact, risk, and validation evidence.

#### Scenario: User reviews AI-produced files by conversation turn

- **WHEN** a session activity turn contains one or more file-change events
- **THEN** the turn SHALL render a single artifact module for those changes
- **AND** the artifact module SHALL show a deduped file list rather than a separate `File change` timeline card per event.

#### Scenario: Activity category labels changed files as artifacts

- **WHEN** the session activity category tabs include file-change events
- **THEN** the user-facing tab label SHALL be "Artifacts" / "产物"
- **AND** it SHALL NOT be labeled "File" / "文件".

#### Scenario: Turn artifact module has file and semantic tabs

- **WHEN** the artifact module is visible in an expanded turn
- **THEN** it SHALL provide tabs for the artifact file list and semantic diff
- **AND** the semantic diff tab SHALL remain scoped to that same conversation turn.

#### Scenario: Semantic diff includes turn meaning

- **WHEN** the semantic diff tab is visible and the turn has a user message
- **THEN** the tab SHALL show a compact "Turn meaning" / "本轮语义" section before diff-derived facts
- **AND** the turn meaning SHALL render as escaped text rather than trusted HTML.

#### Scenario: Semantic diff uses compact layout

- **WHEN** semantic diff sections are visible in the session activity panel
- **THEN** the sections SHALL use a single-column layout
- **AND** the artifact header SHALL avoid stacking kicker, title, stats, and tabs across multiple rows when horizontal space allows.

#### Scenario: Turn artifact module uses flat visual treatment

- **WHEN** the artifact module is visible in an expanded turn
- **THEN** the module SHALL avoid outer card borders, inset shadows, raised shadows, and framed tab rails
- **AND** the artifact and semantic content SHALL read as a flat continuation of the turn rather than a nested card.

#### Scenario: Turn artifact content is left-compact

- **WHEN** the artifact file list is visible in an expanded turn
- **THEN** the module SHALL keep left indentation compact relative to nested cards
- **AND** file rows SHALL avoid excessive inner left padding that visually detaches file names from the turn content.

#### Scenario: Turn artifact tabs remain scannable without chrome

- **WHEN** the artifact module tab controls are visible
- **THEN** each tab SHALL include a leading icon plus label
- **AND** the icons SHALL NOT require bordered or raised button chrome to communicate the two modes.

#### Scenario: Concrete code facts are available

- **WHEN** a turn's diff hunk includes concrete code tokens such as exception handlers, endpoint mappings, HTTP status mapping, response envelope calls, exports, or public declarations
- **THEN** the semantic summary SHALL describe those concrete facts
- **AND** it SHALL NOT replace them with generic file-count or file-type statements.

#### Scenario: Evidence boundary is explicit

- **WHEN** the summary is derived only from diff evidence
- **THEN** the UI SHALL avoid presenting inferred statements as verified business facts
- **AND** validation status SHALL state when external validation evidence is not connected.

#### Scenario: Traditional diff remains available

- **WHEN** the user needs line-level evidence for a turn artifact file
- **THEN** the file row SHALL still allow opening the traditional diff preview or file location
- **AND** the standalone Git diff viewer SHALL remain focused on line-level diff review instead of adding a separate global semantic panel.

#### Scenario: Risk hints remain review aids

- **WHEN** the diff touches configuration, tests/specs, deleted files, large file sets, or behavior-facing source files
- **THEN** the semantic summary MAY surface risk hints
- **AND** those hints SHALL NOT block Git actions or mutate commit selection.

### Requirement: Manual Git Status Refresh Affordance

The Git Diff panel SHALL expose a manual refresh affordance for the active workspace Git status without changing the existing automatic polling cadence.

#### Scenario: User manually refreshes Git status

- **WHEN** the Git Diff panel is visible for an active workspace
- **THEN** the panel SHALL render an icon button with an accessible refresh status label
- **AND** clicking the button SHALL invoke the existing Git status refresh callback.

#### Scenario: Manual refresh reuses existing status path

- **WHEN** the refresh affordance is activated
- **THEN** the frontend SHALL reuse the existing `refreshGitStatus` / queued refresh path
- **AND** it SHALL NOT introduce a new backend command or duplicate Git status bridge logic.

#### Scenario: Automatic polling remains unchanged

- **WHEN** the manual refresh affordance is added
- **THEN** the existing active/background Git status polling cadence SHALL remain unchanged
- **AND** existing Git diff, root scan, commit, stage, unstage, discard, and preview actions SHALL remain available.

