## ADDED Requirements

### Requirement: API contract view communicates scan-derived trust
The API contract view SHALL communicate that endpoint details and exports are generated from scan evidence, including confidence, fallback, or evidence caveats when available.

#### Scenario: User inspects an endpoint
- **WHEN** the user selects an API endpoint in Project Map
- **THEN** the inspector shows a concise trust summary including confidence and evidence availability.

#### Scenario: User exports API documentation
- **WHEN** the user views API export actions
- **THEN** the UI communicates that exported documentation is generated from scan evidence and is not necessarily the authoritative backend API spec.

### Requirement: API filters preserve first-screen clarity
The API contract view SHALL visually separate primary filters from advanced filters so module/controller/confidence remain the default decision path.

#### Scenario: User opens the API workspace
- **WHEN** the API workspace renders with endpoint data
- **THEN** primary filters are presented ahead of advanced protocol/language/framework filters.

#### Scenario: User needs scan or export actions
- **WHEN** the user opens advanced API controls
- **THEN** scan and export actions are available without occupying the primary toolbar row by default.

### Requirement: API inspector supports detail focus and restoration
The API contract view SHALL let users focus the inspector/detail area when opening source files from endpoint evidence or method chains, and SHALL provide a restore action to return to the list/detail layout.

#### Scenario: User opens a source anchor from endpoint details
- **WHEN** the user opens a source file from API evidence or Method chain
- **THEN** the API workspace hides list panes so the detail/source reading area has more space
- **AND** the inspector exposes a restore control that returns the module/endpoint lists.

### Requirement: API response details avoid narrow-column wrapping artifacts
The API contract inspector SHALL render response status, content type, schema summary, and response fields as separate structured regions so field names and descriptions do not wrap inside the status column.

#### Scenario: Response fields include nested paths
- **WHEN** an endpoint response contains fields such as `data.description`
- **THEN** the field path and description render in a full-width field region instead of being split by the status-code column.

### Requirement: Java API method chains are scoped to the selected endpoint
The API contract scanner SHALL build Java/Spring method chains from the selected handler method body and resolved collaborator calls, rather than from fixed-range proximity scanning.

#### Scenario: Controller contains adjacent handler-like methods
- **WHEN** an endpoint handler is selected
- **THEN** Method chain includes calls found inside that handler's method body
- **AND** Method chain excludes calls that only appear in later sibling methods in the same source file.

#### Scenario: Collaborator method resolves to a scanned source file
- **WHEN** a handler calls an injected service/repository/manager collaborator whose target method is indexed
- **THEN** Method chain exposes the target symbol and target file/line anchor for navigation.

### Requirement: API Method chain is displayed as a layered call tree
The API contract inspector SHALL render endpoint Method chain edges as a bounded hierarchy from the selected handler symbol when chain edges can be connected by source and target symbols.

#### Scenario: Endpoint has resolved downstream calls
- **WHEN** the selected endpoint has Method chain edges
- **THEN** the inspector presents the calls as a layered tree
- **AND** each resolved edge can expose both call-site and target-definition file anchors.
