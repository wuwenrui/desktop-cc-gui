## MODIFIED Requirements

### Requirement: AppShell Uses Typed Runtime Boundaries

AppShell SHALL assemble application sections and layout while delegating runtime, task/run, navigation, context, and low-frequency feature activation behavior to typed boundaries.

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
