## ADDED Requirements

### Requirement: relationship file navigation preserves scan reachability
The Project Map relationship dashboard SHALL distinguish bounded graph recommendation surfaces from full scan-backed file navigation.

#### Scenario: graph rail shows bounded top files
- **WHEN** relationship scan data contains more files than the graph rail can render
- **THEN** the graph rail SHALL label itself as a high-relevance Top Files surface rather than a complete File Tree
- **AND** the rail SHALL show count context that makes the cap transparent

#### Scenario: graph rail groups top files
- **WHEN** the Top Files surface contains many files with different roles or modules
- **THEN** the rail SHALL group files by at least one semantic layer such as role, module, or path segment
- **AND** role and module groups SHALL be collapsible
- **AND** each expanded leaf group SHALL support bounded default rendering with an explicit expand affordance

#### Scenario: files explorer uses full scan set
- **WHEN** the user opens the relationship Files Explorer view
- **THEN** the file groups SHALL be derived from all scanned files that match active query, role filter, and noise visibility settings
- **AND** the explorer SHALL NOT derive its only data source from the bounded graph rail list

#### Scenario: large scans remain navigable
- **WHEN** a relationship snapshot contains thousands of scanned files
- **THEN** the Files Explorer SHALL keep matching files reachable through grouping and search
- **AND** the UI SHALL distinguish scanned total, matching total, and currently rendered or highlighted counts

#### Scenario: selecting explorer file focuses graph context
- **WHEN** the user selects a file from the Files Explorer
- **THEN** the dashboard SHALL preserve the existing behavior of selecting that file and focusing the graph or inspector context
