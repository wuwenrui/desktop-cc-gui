# project-map-relationship-read-path-view Specification

## Purpose
TBD - created by archiving change polish-project-map-files-api-mvp. Update Purpose after archive.
## Requirements
### Requirement: Read Path presents selected file anatomy
The Relationship Read Path view SHALL present the selected file as a file anatomy graph rather than as raw relationship groups, context-pack lists, or a generic reading checklist.

#### Scenario: User opens Read Path for a selected file with relationships
- **WHEN** the selected file has relationship/context data
- **THEN** the view centers the current file
- **AND** incoming caller/collaborator relations are grouped on one side
- **AND** outgoing collaborator call relations are grouped on the other side
- **AND** import/export-only relations SHALL NOT be rendered as primary anatomy nodes
- **AND** verification material such as tests, specs, docs, or style relations is visually separated.

#### Scenario: User needs to jump from anatomy to source
- **WHEN** a displayed file node or evidence node has a source path
- **THEN** the view provides an action to open the file
- **AND** evidence actions SHALL open the available evidence line when line metadata exists.

#### Scenario: Anatomy data is sparse
- **WHEN** the selected file does not have enough relationship/context data to build a route
- **THEN** the Read Path view shows concise empty states for missing incoming/outgoing lanes instead of rendering low-value raw lists.

### Requirement: Read Path presents method-chain closure
The Relationship Read Path view SHALL help users inspect methods in the selected file and understand each method body's first-level flow.

#### Scenario: Selected file has scanned symbols and calls
- **WHEN** the selected file has method/function symbols and call relations
- **THEN** the view SHOULD derive method entries from the current file source text when source text can be read
- **AND** scanned symbols SHALL only be used as a fallback when source text is unavailable
- **AND** call-expression symbols inside a method body SHALL NOT be promoted as peer method entries
- **AND** selecting a method shows a flowchart that starts from the method
- **AND** the flowchart shows direct outgoing calls extracted from the method body in source-line order
- **AND** the flowchart ends with an end/return node.

#### Scenario: Method body graph is uncertain
- **WHEN** the source-derived flow cannot fully explain the method body
- **THEN** the view SHALL show the method body code snippet in the same panel so the user can verify the graph against source.

#### Scenario: Method source location exists
- **WHEN** the selected method has a source line
- **THEN** the view provides an action to open the current file at that method line.

#### Scenario: Method data is sparse
- **WHEN** scanned symbols are unavailable but call-site evidence exists
- **THEN** the view may synthesize method entries from call-site lines
- **AND** it SHALL label them as call sites rather than pretending full method metadata exists.

### Requirement: Read Path supports comprehension-oriented review
The Relationship Read Path view SHALL help the user decide whether they have understood the selected file by showing checklist questions and compact relationship/method signals.

#### Scenario: User reviews the anatomy and method chains
- **WHEN** file anatomy or method-chain data is visible
- **THEN** the side panel shows comprehension questions about entry points, responsibility boundaries, data flow, impact, and verification.

#### Scenario: Existing repair/read-error artifacts exist
- **WHEN** the relationship snapshot contains repair issues or read errors
- **THEN** the Read Path view SHALL NOT render them as a persistent bottom strip across tabs.
