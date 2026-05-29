## MODIFIED Requirements

### Requirement: Directory Child Queries Shall Be Bounded And One-Level
The backend SHALL resolve workspace directory-child queries as bounded one-level listings that return direct children only, plus completion metadata.

#### Scenario: root direct children query
- **WHEN** the client requests workspace directory children with an empty path
- **THEN** the backend SHALL interpret the path as the workspace root
- **AND** the response SHALL return only direct root files and direct root directories
- **AND** the backend MUST NOT recursively return the full workspace subtree in that response
- **AND** the response SHOULD avoid synchronous root-level gitignore marker computation to keep first paint bounded

#### Scenario: existing nested directory query behavior is preserved
- **WHEN** the client requests children for a non-empty workspace directory path
- **THEN** the backend SHALL keep the existing one-level child listing behavior
- **AND** the backend SHALL keep gitignore marker behavior for the requested non-empty directory
- **AND** invalid traversal, absolute, prefix, or `.git` paths MUST still be rejected

#### Scenario: whitespace-only directory paths are not root sentinels
- **WHEN** the client requests workspace directory children with a whitespace-only path
- **THEN** the backend MUST reject the path as invalid or empty
- **AND** the backend MUST NOT interpret it as the workspace root sentinel

### Requirement: Workspace File Tree Responses Shall Expose Scan Metadata
The system SHALL expose explicit scan metadata for workspace file tree responses so clients can distinguish complete, partial, unknown, and empty directory states without inferring them only from returned child paths.

#### Scenario: root-first response remains progressive
- **WHEN** the visible file tree receives a root direct-children response
- **THEN** returned directories SHALL include directory metadata that lets the client treat their children as unknown, partial, loaded, or empty
- **AND** the client MUST allow unknown or partial root children to be expanded on demand
