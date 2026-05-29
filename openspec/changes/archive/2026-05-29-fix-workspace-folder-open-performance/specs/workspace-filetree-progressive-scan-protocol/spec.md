## MODIFIED Requirements

### Requirement: Directory Child Queries Shall Be Bounded And One-Level
The backend SHALL resolve workspace directory-child queries as bounded one-level listings that return direct children only, plus completion metadata. Filesystem traversal and directory read work for these queries MUST run outside the async command runtime's cooperative task path.

#### Scenario: direct children only
- **WHEN** the client requests children for a workspace directory path
- **THEN** the backend SHALL return only direct child files and direct child directories for that path
- **AND** the backend MUST NOT recursively return the full subtree in that response

#### Scenario: oversized directory reports has more
- **WHEN** a directory contains more direct child entries than the directory-child query budget can return
- **THEN** the backend SHALL return a bounded sorted subset
- **AND** the response SHALL indicate partial or has-more state

#### Scenario: path boundary is enforced
- **WHEN** a directory-child query contains path traversal or resolves outside the active workspace root
- **THEN** the backend MUST reject the request with a recoverable error
- **AND** the file tree SHALL remain interactive

#### Scenario: blocking filesystem scan does not occupy async command task
- **WHEN** the initial workspace file listing or a directory-child listing performs filesystem traversal, canonicalization, root reading, or git-ignore classification
- **THEN** the command layer SHALL execute that blocking work through a blocking-task boundary or equivalent non-cooperative-runtime isolation
- **AND** the response SHALL preserve the existing progressive scan metadata contract
