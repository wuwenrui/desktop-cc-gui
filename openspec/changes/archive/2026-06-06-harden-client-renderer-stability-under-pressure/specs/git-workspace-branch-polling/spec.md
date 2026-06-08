## ADDED Requirements

### Requirement: Branch polling MUST validate Git repository state before listing branches
The system SHALL verify that a workspace path is a Git repository before attempting branch list polling.

#### Scenario: workspace is not a Git repository
- **WHEN** the configured workspace path exists but is not a Git repository
- **THEN** the system MUST return a neutral or degraded branch state
- **AND** it MUST NOT repeatedly write `git/branches/list error` for the same non-repository path

#### Scenario: workspace is a Git repository
- **WHEN** the configured workspace path is a valid Git repository
- **THEN** the system MUST continue listing branches through the existing branch state path
- **AND** valid branch data MUST remain available to Git UI surfaces

### Requirement: Branch polling diagnostics MUST preserve real Git failures with dedupe
The system SHALL dedupe repeated branch polling diagnostics without hiding real repository failures.

#### Scenario: repeated identical branch failure occurs
- **WHEN** the same branch polling failure repeats for the same path and reason within the configured window
- **THEN** the system MUST suppress or aggregate duplicate log entries
- **AND** it MUST keep enough metadata to show that polling is degraded

#### Scenario: real repository error occurs
- **WHEN** branch polling fails for a path that is expected to be a Git repository due to permission, corruption, lock, or command failure
- **THEN** the system MUST surface a classified Git diagnostic
- **AND** it MUST NOT downgrade that failure to neutral non-repository state unless repository validation proves the path is not a Git repository
