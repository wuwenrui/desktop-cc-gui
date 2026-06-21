# app-shell-domain-context-isolation Specification

## Purpose

Defines the domain-context isolation contract for AppShell state propagation. The spec requires executable owner-map completeness, narrowed flatten boundaries for hot consumers, explicit search/composer field boundaries, separated settings/model/collaboration domains, and referentially stable action arrays so unrelated domain updates do not cascade through legacy flat context adapters.
## Requirements
### Requirement: AppShell Domain Owner Map MUST Cover Raw Context Keys

Every top-level key placed in `defineAppShellDomainContexts({ ... })` MUST have exactly one owner in `APP_SHELL_DOMAIN_CONTEXT_OWNED_KEYS`. The owner map MUST be executable governance, not a representative sample.

#### Scenario: all raw context keys are owned

- **WHEN** the owner map completeness test scans `src/app-shell.tsx`
- **THEN** every top-level key under each raw domain context MUST appear in `APP_SHELL_DOMAIN_CONTEXT_OWNED_KEYS` for that domain
- **AND** no raw key MAY remain unowned
- **AND** stale owner keys that are no longer present in raw contexts MUST be reported

#### Scenario: duplicate ownership is rejected

- **WHEN** a key appears in more than one domain owner list
- **THEN** `findOverlappingAppShellDomainKeys()` MUST report that key
- **AND** the owner map completeness test MUST fail

#### Scenario: parser uncertainty is explicit

- **WHEN** the raw context parser cannot classify a top-level property line
- **THEN** the test MUST fail with the source line
- **AND** the implementation MUST either make the property parseable or add an explicit reviewed exception

### Requirement: Full Flatten Boundaries MUST Be Narrowed For AppShell Hot Consumers

AppShell hot consumers MUST NOT default to flattening all domain contexts when they only need a subset. Each consumer MUST declare the selected domains or selected fields it reads.

#### Scenario: layout nodes section uses selected boundary

- **WHEN** `useAppShellLayoutNodesSection` builds its legacy boundary
- **THEN** it MUST use a selected-domain or selected-field helper
- **AND** it MUST NOT call full `flattenAppShellDomainContexts(input.appShellDomainContexts)` directly

#### Scenario: sections hook uses selected boundary

- **WHEN** `useAppShellSections` builds its legacy boundary
- **THEN** it MUST use a selected-domain or selected-field helper
- **AND** unrelated domain reference changes MUST NOT invalidate section memoized values that do not read that domain

#### Scenario: render boundary remains compatible while narrowed

- **WHEN** `renderAppShell` adapts AppShell state for legacy rendering
- **THEN** it MUST preserve existing visible behavior
- **AND** it SHOULD declare the selected domain list required for rendering
- **AND** future full flatten regression MUST be caught by focused tests

### Requirement: Search And Composer Boundary MUST Not Depend On Unused Domains

`useAppShellSearchAndComposerSection` MUST only receive domains or fields it actually reads. Search palette, composer send, git result opening, and kanban bridge behavior MUST remain unchanged after narrowing.

#### Scenario: unused selected domain is removed

- **WHEN** a selected domain in `COMPOSER_SEARCH_DOMAIN_NAMES` has no fields read by `ComposerSearchShellBoundary`
- **THEN** that domain MUST be removed from the selected list
- **AND** focused tests MUST prove search and composer behavior remains unchanged

#### Scenario: search behavior is preserved

- **WHEN** the boundary is narrowed
- **THEN** opening/closing the search palette, resetting selection, toggling filters, and opening results MUST preserve existing behavior

### Requirement: Settings And Model State MUST Be Split By Update Frequency And Ownership

Settings UI state, effective model selection state, and collaboration mode state MUST be represented by separate domain contexts when they have different consumers or update cadence.

#### Scenario: model refresh does not invalidate settings-only consumers

- **WHEN** effective model data changes
- **THEN** consumers that depend only on settings UI state MUST keep stable selected-boundary references
- **AND** model selection consumers MUST observe the updated model data

#### Scenario: collaboration mode changes stay scoped

- **WHEN** selected collaboration mode changes
- **THEN** consumers that do not read collaboration mode MUST NOT be invalidated by the collaboration context

### Requirement: Hot Path Action Arrays MUST Be Referentially Stable

Arrays or objects passed to memoized AppShell hot path components MUST be referentially stable when their logical inputs have not changed.

#### Scenario: action array remains stable under identical inputs

- **WHEN** a toolbar/menu/action hook re-runs with identical deps
- **THEN** it MUST return the previous array reference
- **AND** each action MUST preserve id, label, icon, active flag, and callback behavior

#### Scenario: action array updates on real input change

- **WHEN** a visible label, active flag, availability flag, or callback dependency changes
- **THEN** the action array MUST get a new reference
- **AND** the changed action MUST reflect the new input
