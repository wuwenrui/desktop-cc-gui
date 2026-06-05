## ADDED Requirements

### Requirement: Project Map relation context support
Project Map generation and persistence SHALL tolerate optional typed relations between nodes, including relation type, source/target node IDs, confidence, stale state, source kind, and supporting evidence.

#### Scenario: Dataset contains optional relations
- **WHEN** a Project Map dataset includes relation records between existing nodes
- **THEN** generation, persistence, and display preparation preserve those relations without breaking existing node rendering

#### Scenario: Dataset omits relations
- **WHEN** a Project Map dataset does not include relation records
- **THEN** existing Project Map loading and incremental generation continue to work without requiring migration

### Requirement: Project Map context ignore policy
Project Map context and impact construction SHALL apply an ignore policy that excludes dependency folders, generated outputs, runtime artifacts, binary assets, and other non-source paths before matching files to nodes.

#### Scenario: Ignored file path is provided to impact analysis
- **WHEN** changed file paths include dependency, generated, runtime, or binary paths covered by the ignore policy
- **THEN** those paths are excluded from node matching and do not create changed or unmapped Project Map nodes

#### Scenario: Source file path is not ignored
- **WHEN** a changed file path is a source or specification file not covered by the ignore policy
- **THEN** Project Map context and impact construction can use it for node matching
