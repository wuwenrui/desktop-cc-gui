# app-shell-runtime-boundaries Specification

## Purpose
TBD - created by archiving change split-app-shell-runtime-boundaries. Update Purpose after archive.
## Requirements
### Requirement: AppShell Uses Typed Runtime Boundaries

AppShell SHALL assemble application sections and layout while delegating runtime, task/run, navigation, context, low-frequency feature activation behavior, and lane-specific render pressure to typed boundaries.

#### Scenario: AppShell wires runtime actions

- **WHEN** AppShell needs renderer/runtime lifecycle actions
- **THEN** those actions SHALL be exposed through a runtime action boundary
- **AND** AppShell SHALL pass typed callbacks rather than defining long inline runtime business handlers.

#### Scenario: AppShell wires feature activation boundaries

- **WHEN** AppShell needs inactive tabs, optional panels, detached windows, settings, SpecHub, Git History, Kanban, WorkspaceHome, search, or other non-first-screen surfaces
- **THEN** those surfaces SHOULD be reached through lazy feature activation boundaries
- **AND** AppShell MUST NOT directly import their heavy implementation modules unless a documented critical-shell invariant requires eager loading.

#### Scenario: AppShell keeps critical shell eager

- **WHEN** the app first renders
- **THEN** sidebar shell, active thread shell, composer basic input, and essential runtime notices SHALL remain available without waiting for low-frequency feature chunks
- **AND** feature-local suspense MUST NOT suspend the whole shell.

#### Scenario: five-zone ownership isolates canvas pressure

- **WHEN** the center conversation canvas receives high-frequency realtime updates
- **THEN** AppShell MUST keep top, left, right, and bottom interaction lanes behind narrow typed props or pressure signals
- **AND** AppShell MUST NOT pass full canvas render snapshots, message arrays, or canvas-only hydration state into those interaction lanes
- **AND** layout recomputation for interaction lanes MUST NOT be triggered solely by canvas-lane render churn

### Requirement: Thread Runtime Separates Lifecycle From Message Transport

Thread runtime SHALL separate session lifecycle responsibilities from message send/realtime/history responsibilities while preserving existing public hook compatibility.

#### Scenario: session lifecycle is handled

- **WHEN** a thread session is created, selected, recovered, rebound, or diagnosed
- **THEN** the behavior SHALL be owned by a lifecycle controller or equivalent boundary
- **AND** it SHALL remain compatible with existing `useThreads` consumers during migration.

#### Scenario: message runtime is handled

- **WHEN** a message is sent, realtime events are applied, history is replayed, or optimistic messages are updated
- **THEN** the behavior SHALL be owned by a message runtime controller or equivalent boundary
- **AND** it SHALL communicate lifecycle changes through explicit typed callbacks.

#### Scenario: existing public hooks remain during migration

- **WHEN** existing code imports `useThreads` or `useThreadMessaging`
- **THEN** those imports SHALL continue to work unless a later proposal explicitly changes the public contract
- **AND** the extraction SHALL be testable behind the facade.

### Requirement: Core Shell Files Remove ts-nocheck

The core shell orchestration files SHALL remove `@ts-nocheck` by introducing typed render and section contracts instead of suppressing TypeScript errors.

#### Scenario: AppShell assembly is typed without broad any bags

- **WHEN** `app-shell.tsx` composes state, action boundaries, sections, and layout
- **THEN** the composition SHALL typecheck without `@ts-nocheck`
- **AND** it SHALL NOT replace type safety with broad `any` bags for core contracts.

#### Scenario: lazy feature props remain typed

- **WHEN** a feature surface is moved behind a lazy boundary
- **THEN** the boundary props SHALL use explicit TypeScript types for state and callbacks
- **AND** missing required props SHALL fail typecheck rather than surfacing as runtime undefined behavior.

### Requirement: Refactor Preserves User-Facing Runtime Behavior

The architecture split SHALL preserve the previously accepted P0 runtime visibility behavior.

#### Scenario: HomeChat remains creation-first

- **WHEN** AppShell and thread runtime boundaries are refactored
- **THEN** HomeChat SHALL remain creation-first
- **AND** it SHALL NOT regain workspace-level run dashboard or Task Center entrypoints.

#### Scenario: contextual runtime surfaces remain available

- **WHEN** Conversation, Sidebar, Run Detail, Project Map, or Orchestration paths are exercised
- **THEN** existing contextual runtime indicators and detail open paths SHALL continue to work
- **AND** no new parallel TaskRun lifecycle truth source SHALL be introduced.

### Requirement: AppShell Boundary Closeout MUST Separate Domain Extraction From Physical Modularization
AppShell runtime-boundary closeout MUST distinguish domain context extraction and structured input boundaries from complete physical file modularization.

#### Scenario: domain extraction is complete but adapter remains
- **WHEN** AppShell has been split into domain context objects and section hooks receive structured inputs
- **AND** rendering still uses a flat compatibility adapter or a large physical file remains above the modularization threshold
- **THEN** the change MAY claim domain-boundary completion
- **AND** it MUST keep physical modularization as explicit follow-up debt rather than claiming full module split completion

#### Scenario: large shell files remain after performance fix
- **WHEN** files such as `app-shell.tsx`, `useAppServerEvents.ts`, `useLayoutNodes.tsx`, `MessagesRows.tsx`, `Markdown.tsx`, or `FileViewPanel.tsx` remain large after a performance-focused change
- **THEN** the closeout notes MUST classify them as structural modularization debt if they are not part of the current implementation scope
- **AND** archive readiness MUST NOT depend on reducing those files unless the active change explicitly set that as an acceptance criterion

### Requirement: AppShell file surfaces MUST use narrow runtime boundaries

AppShell and layout composition MUST pass file surfaces narrow, typed signals rather than broad realtime or workspace projection objects.

#### Scenario: file surface does not receive thread status map

- **WHEN** AppShell composes the main file view, detached file explorer, or editor split file surface
- **THEN** those file surfaces MUST NOT receive the whole `threadStatusById` map
- **AND** any engine-processing awareness MUST be represented as a narrow typed pressure signal

#### Scenario: layout recomputation isolates realtime status churn

- **WHEN** realtime status changes for non-file conversation rows
- **THEN** layout node construction for file surfaces MUST avoid recomputing file-specific props that are unrelated to the pressure signal
- **AND** file editor input state MUST remain owned by the file session boundary

#### Scenario: Sidebar aggregation does not leak into file props

- **WHEN** Sidebar or WorktreeSection derives running session indicators from realtime status
- **THEN** those derived values MUST remain sidebar/workspace UI concerns
- **AND** they MUST NOT be passed through to file view props except as an explicit narrow signal documented by the file render contract

### Requirement: AppShell MUST Compose Shell And Canvas Through Separate Runtime Boundaries
AppShell runtime boundaries SHALL distinguish Shell control node construction from Conversation Canvas content node construction.

#### Scenario: Active canvas state uses selector boundary
- **WHEN** active conversation state changes because of stream item, tool event, thread status, token usage, or rate-limit churn
- **THEN** Conversation Canvas consumers SHALL subscribe to the required active canvas slice through selector-based external-store access
- **AND** Shell control node construction SHALL NOT require full active canvas arrays or maps solely to preserve canvas rendering
- **AND** selector equality SHALL suppress updates when the selected slice is unchanged.

#### Scenario: Composer and StatusPanel live slices use the same selector boundary
- **WHEN** Composer or StatusPanel needs live advisory state from the active conversation
- **THEN** those surfaces SHALL consume `items`, status maps, token usage, rate limits, and active thread facts through selector-derived props
- **AND** AppShell layout composition SHALL keep send-critical Composer state such as draft text, attachments, model selection, and callbacks outside the active canvas store.

