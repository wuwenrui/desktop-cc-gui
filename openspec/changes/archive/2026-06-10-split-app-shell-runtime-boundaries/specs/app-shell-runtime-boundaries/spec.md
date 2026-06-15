## ADDED Requirements

### Requirement: AppShell Uses Typed Runtime Boundaries

AppShell SHALL assemble application sections and layout while delegating runtime, task/run, navigation, and context business actions to typed boundaries.

#### Scenario: AppShell wires runtime actions

- **WHEN** AppShell needs renderer/runtime lifecycle actions
- **THEN** those actions SHALL be exposed through a runtime action boundary
- **AND** AppShell SHALL pass typed callbacks rather than defining long inline runtime business handlers.

#### Scenario: AppShell wires task or run actions

- **WHEN** AppShell needs TaskRun, Orchestration, Project Map, or task-like execution actions
- **THEN** those actions SHALL be exposed through a task/run action boundary
- **AND** they SHALL NOT be mixed with thread message transport or generic navigation handlers.

#### Scenario: AppShell wires navigation actions

- **WHEN** AppShell needs to open views, switch panels, or select workspace surfaces
- **THEN** those actions SHALL be exposed through a navigation action boundary
- **AND** navigation handlers SHALL NOT mutate runtime lifecycle state directly.

#### Scenario: AppShell wires context actions

- **WHEN** AppShell needs file refs, memory refs, evidence refs, or context insertion actions
- **THEN** those actions SHALL be exposed through a context action boundary
- **AND** context handlers SHALL NOT own message send or session lifecycle behavior.

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

#### Scenario: render shell is typed

- **WHEN** `renderAppShell.tsx` receives AppShell context
- **THEN** the context SHALL use an explicit TypeScript type
- **AND** the file SHALL NOT rely on `@ts-nocheck`.

#### Scenario: AppShell sections are typed

- **WHEN** `useAppShellSections.ts` receives section inputs or returns section outputs
- **THEN** those inputs and outputs SHALL use explicit TypeScript types
- **AND** the file SHALL NOT rely on `@ts-nocheck`.

#### Scenario: AppShell assembly is typed

- **WHEN** `app-shell.tsx` composes state, action boundaries, sections, and layout
- **THEN** the composition SHALL typecheck without `@ts-nocheck`
- **AND** it SHALL NOT replace type safety with broad `any` bags for core contracts.

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
