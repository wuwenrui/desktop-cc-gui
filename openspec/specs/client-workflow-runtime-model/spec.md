# client-workflow-runtime-model Specification

## Purpose
TBD - created by archiving change unify-client-workflow-runtime-model. Update Purpose after archive.
## Requirements
### Requirement: Client Workflow Runtime Model Is An Integration Layer

The client workflow runtime model SHALL integrate existing TaskRun, Task Center, Orchestration, runtime telemetry, and evidence capabilities instead of introducing a parallel execution truth source.

#### Scenario: implementation needs run lifecycle truth

- **WHEN** New Home, Task Center, Conversation, or Orchestration surfaces display execution lifecycle
- **THEN** they SHALL derive lifecycle state from existing TaskRun records and existing projection helpers
- **AND** they SHALL NOT create a second run-status enum, store, or recovery action truth source.

#### Scenario: implementation needs card or detail display fields

- **WHEN** run card or run detail display fields are needed
- **THEN** the implementation SHALL extend or reuse the existing TaskRun surface projection boundary
- **AND** it SHALL NOT create a disconnected view-model helper with separate status priority semantics.

#### Scenario: older specs mention Workspace Home

- **WHEN** this change references the current home entry implementation
- **THEN** the implementation SHALL target `HomeChat` mounted through the layout home node
- **AND** older `Workspace Home` product terminology SHALL be treated as the home-entry concept unless explicitly referring to the deprecated component.

### Requirement: New Home Remains Creation-First

New Home SHALL remain a creation-first entry surface for choosing workspace context and starting conversation-first work while immature task-module entrypoints remain hidden.

#### Scenario: user opens New Home

- **WHEN** the user opens New Home
- **THEN** HomeChat SHALL keep workspace identity, engine identity, and the composer as the primary visible experience
- **AND** it SHALL NOT show a workspace-level run dashboard, run lanes, or inferred active/attention summaries.

#### Scenario: user opens New Home without run history

- **WHEN** the selected workspace has no active or recent TaskRuns
- **THEN** New Home SHALL still present a complete creation-first workspace cockpit
- **AND** it SHALL NOT show a noisy empty dashboard skeleton.

#### Scenario: user reviews recent conversations

- **WHEN** recent conversations are available
- **THEN** New Home MAY show lightweight recent conversation shortcuts
- **AND** it SHALL NOT present TaskRun artifacts or output as a Home dashboard.

#### Scenario: full run center entry is not product-ready

- **WHEN** Task Center / task drafting is not product-ready
- **THEN** New Home SHALL hide the `View all runs` / Task Center entry
- **AND** Project Map SHALL hide the create-task-draft entry instead of sending users into the unfinished task module.

### Requirement: Runtime Visibility Is Contextual

P0 SHALL place runtime visibility on contextual surfaces users actually revisit, such as session rows and Conversation linked-run indicators, instead of duplicating a workspace dashboard on New Home.

#### Scenario: session row has live activity

- **WHEN** a session row has existing live processing or review activity state
- **THEN** the Sidebar MAY show a small status badge for that row
- **AND** the badge SHALL be derived from existing thread activity state rather than inferred unlinked TaskRun state.

#### Scenario: linked run is available for active conversation

- **WHEN** the active conversation has an explicitly linked TaskRun
- **THEN** Conversation SHALL show a lightweight linked-run indicator/action
- **AND** opening detail SHALL use the shared run detail path.

#### Scenario: layout is compact

- **WHEN** the app is shown in a compact or narrow layout
- **THEN** New Home SHALL keep composer access prominent
- **AND** runtime status SHALL remain ambient or contextual rather than becoming a stacked Home dashboard.

#### Scenario: run state changes

- **WHEN** a run appears or changes status while visible
- **THEN** the UI SHOULD update in a way that preserves user orientation
- **AND** detail surfaces SHALL not lose the selected run only because list ordering changes.

### Requirement: TaskRun Is The Client Execution Truth

Task-like execution surfaces SHALL project user-visible execution lifecycle from `TaskRun` instead of inventing separate run-status truth sources.

#### Scenario: execution is dispatched from a task source

- **WHEN** a user dispatches executable work from New Home, Orchestration, Kanban, Project Map, or another task-like source
- **THEN** the client SHALL create or link a TaskRun for that execution
- **AND** user-facing execution state SHALL be derived from that TaskRun.

#### Scenario: source entry routes through existing model

- **WHEN** executable work starts from Kanban, Orchestration, Project Map, Browser Evidence, New Home, or Task Center recovery
- **THEN** the client SHALL route the work through the defined source routing contract
- **AND** Project Map and Browser Evidence SHALL attach source/evidence refs through OrchestrationTask or TaskRun evidence fields rather than inventing new UI-only TaskRun source kinds.

#### Scenario: New Home starts conversation-first work

- **WHEN** the user starts a normal conversation from New Home composer
- **THEN** the client SHALL treat the action as conversation-first work
- **AND** it SHALL create or link a TaskRun only when the user starts task-like executable work that has run lifecycle semantics.

#### Scenario: run has a linked conversation

- **WHEN** a TaskRun has a `linkedThreadId`
- **THEN** run surfaces SHALL provide an affordance to open that conversation
- **AND** conversation surfaces MAY show a lightweight linked-run indicator for the active thread.

#### Scenario: run has no linked conversation yet

- **WHEN** a TaskRun is queued or pending and has no linked conversation
- **THEN** the UI SHALL show a clear pending state
- **AND** it SHALL NOT render a broken conversation link.

### Requirement: Run Detail Provides A Shared Explanation Surface

The client SHALL provide a shared run detail surface that can be opened from Conversation run indicators, Task Center internal paths, Project Map/Orchestration links, and existing run-open events.

#### Scenario: user opens run detail

- **WHEN** the user opens a TaskRun from any supported surface
- **THEN** the client SHALL show the same run detail information model
- **AND** the user SHALL be able to see status, current step, latest output or diagnostics, source, artifacts, linked conversation, evidence/context refs, and recovery actions when available.

#### Scenario: run has recovery actions

- **WHEN** a TaskRun exposes available recovery actions
- **THEN** run detail SHALL show only actions supported by that run
- **AND** unsupported actions SHALL NOT be presented as clickable controls.

#### Scenario: run includes artifacts

- **WHEN** a TaskRun includes artifacts
- **THEN** run detail SHALL list the artifacts with user-visible labels
- **AND** artifact refs SHALL be opened through existing safe file/link/navigation policies.

### Requirement: Task Center Is Deferred While Run Detail Remains Shared

Task Center code MAY remain available internally, but user entrypoints SHALL stay hidden until the task module is redesigned; shared run detail SHALL remain available from contextual linked-run paths.

#### Scenario: user opens contextual run detail

- **WHEN** the same TaskRun is opened from Conversation or another supported linked surface
- **THEN** the client SHALL show the shared run detail information model
- **AND** the detail SHALL use consistent status labels and severity semantics.

#### Scenario: task module is not product-ready

- **WHEN** Task Center / task drafting is not product-ready
- **THEN** New Home SHALL hide the `View all runs` / Task Center entry
- **AND** Project Map and Orchestration SHALL hide create-task or dispatch entrypoints into the unfinished task module.

### Requirement: Context And Evidence Are Shown With Evidence Boundaries

Run detail SHALL expose linked context and evidence references without claiming hidden or inferred evidence that is not present in the data model.

#### Scenario: browser evidence is linked

- **WHEN** a TaskRun includes Browser Evidence metadata
- **THEN** run detail SHALL show its title/url/state and diagnostics when available
- **AND** stale, expired, degraded, deleted, or unsupported evidence states SHALL be visible to the user.

#### Scenario: orchestration source refs are linked

- **WHEN** a TaskRun is linked to an OrchestrationTask with source or evidence refs
- **THEN** run detail SHALL show those refs as source/evidence entries
- **AND** opening a ref SHALL use the ref capability and existing navigation policy.

#### Scenario: no context or evidence is linked

- **WHEN** a TaskRun has no linked context or evidence refs
- **THEN** run detail SHALL show an honest empty state
- **AND** it SHALL NOT infer context usage from unrelated workspace state.

### Requirement: Deprecated WorkspaceHome Is Not The P0 Entry Surface

The P0 client workflow integration SHALL target the current New Home implementation and SHALL NOT use deprecated WorkspaceHome as the product planning baseline.

#### Scenario: planning or implementation chooses an entry component

- **WHEN** P0 work references the home entry surface
- **THEN** it SHALL target `HomeChat` mounted through layout home node
- **AND** it SHALL NOT add new behavior to deprecated `WorkspaceHome` as the primary user entry.

### Requirement: AppShell Remains Wiring-Oriented For P0 Additions

P0 additions SHALL keep new run-summary, run-detail, and run-view business logic in feature-local hooks/utilities/components rather than expanding AppShell as a business controller. P0 SHALL NOT claim the broader AppShell/useThreads/type-safety architecture refactor as completed.

#### Scenario: New Home needs derived run data

- **WHEN** New Home needs active/recent/attention run data
- **THEN** the derivation SHOULD live in a feature-local selector, hook, or utility under home/tasks boundaries
- **AND** layout/AppShell SHOULD pass data and callbacks rather than owning the derivation details.

#### Scenario: run detail navigation needs local state

- **WHEN** run detail navigation requires selected run id or open/close state
- **THEN** the state SHOULD be encapsulated in a small navigation hook or existing Task Center event path
- **AND** new run lifecycle rules SHALL NOT be added directly to `app-shell.tsx` or `useThreads.ts` unless no smaller boundary can own them.

#### Scenario: architecture note-card work is evaluated

- **WHEN** planning mentions splitting AppShell orchestration, splitting `useThreads` runtime, or removing core `@ts-nocheck`
- **THEN** those items SHALL be treated as follow-up architecture work outside current P0 acceptance
- **AND** they SHOULD be captured in a separate OpenSpec change rather than appended to the HomeChat/runtime visibility P0.

