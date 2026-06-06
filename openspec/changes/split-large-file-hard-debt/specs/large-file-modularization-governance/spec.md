# large-file-modularization-governance Delta Spec

## MODIFIED Requirements

### Requirement: Completion Criteria for Governance Milestones

The system SHALL define measurable completion criteria for the Deferred + JIT governance mode, retained hard-debt elimination, and staged P0/P1 modularization batches.

#### Scenario: Deferred strategy review
- **WHEN** governance review is performed
- **THEN** review MUST include hard-gate violations count, JIT remediation outcomes, and unresolved risk list
- **AND** retained near-threshold files MAY be documented as watchlist items without mandatory decomposition plan

#### Scenario: Staged P0/P1 split completion review
- **WHEN** a P0/P1 modularization batch is marked complete
- **THEN** the review MUST list the original line count, final line count, matched policy, warn threshold, fail threshold, and remaining headroom for each split file
- **AND** each P0 file MUST either be reduced below warn threshold or retain at least 150 lines of fail-threshold headroom with a recorded follow-up split rationale
- **AND** each P1 file MUST retain at least 200 lines of fail-threshold headroom unless an explicit risk acceptance is documented
- **AND** no batch MAY be marked complete if it introduces new large-file hard debt

#### Scenario: Retained hard-debt elimination
- **WHEN** a retained fail-scope baseline entry is selected for cleanup
- **THEN** the cleanup MUST reduce the source file below its matched fail threshold through boundary-driven modularization
- **AND** the baseline MUST be regenerated only after the retained source no longer exceeds the fail threshold
- **AND** the cleanup MUST preserve public facades, selector contracts, command names, payload shapes, and persisted fields for the same batch

#### Scenario: Four-file retained hard-debt cleanup
- **WHEN** this change is marked complete
- **THEN** `src/features/project-map/components/ProjectMapRelationshipSection.tsx` MUST be below the default-source fail threshold
- **AND** `src/features/layout/hooks/useLayoutNodes.tsx` MUST be below the default-source fail threshold
- **AND** `src-tauri/src/project_map_relations.rs` MUST be below the default-source fail threshold
- **AND** `src/styles/project-map.relationship.css` MUST be below the styles fail threshold
- **AND** the regenerated hard-debt baseline MUST NOT contain retained fail-scope entries for those four files

#### Scenario: Project Map relationship facade preservation
- **WHEN** `ProjectMapRelationshipSection.tsx` is split
- **THEN** the exported `ProjectMapRelationshipSection` component MUST remain available from the same module path
- **AND** existing props, callbacks, visible view modes, API contract entry behavior, graph/file/read view behavior, and class names MUST remain compatible

#### Scenario: Layout hook facade preservation
- **WHEN** `useLayoutNodes.tsx` is split
- **THEN** the exported `useLayoutNodes` hook MUST keep the same public input and return contracts
- **AND** existing panel ordering, selected tab behavior, code-selection relationship graph behavior, and lazy panel fallback behavior MUST remain compatible

#### Scenario: Rust relationship scanner facade preservation
- **WHEN** `project_map_relations.rs` is split
- **THEN** existing Tauri command names and registered backend entrypoints MUST remain available
- **AND** snapshot ownership validation, path safety validation, scan output schema, API contract enrichment, and stale-state summaries MUST remain compatible

#### Scenario: Project Map relationship stylesheet contract preservation
- **WHEN** `project-map.relationship.css` is split
- **THEN** existing class selectors MUST remain valid
- **AND** imported stylesheet order MUST preserve graph, inspector, file-list, action-output, loading, and responsive cascade behavior
