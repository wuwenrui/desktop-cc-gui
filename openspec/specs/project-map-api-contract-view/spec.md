# project-map-api-contract-view Specification

## Purpose
TBD - created by archiving change add-project-map-api-contract-view. Update Purpose after archive.
## Requirements
### Requirement: Project Map API tab

The Project Map relationship dashboard SHALL expose an `接口 API` tab for API contract graph exploration.

#### Scenario: API tab appears alongside existing tabs

- **WHEN** the Project Map relationship dashboard is visible
- **THEN** the tab group SHALL include Graph, Files, Read, and API entries
- **AND** selecting the API entry SHALL show the API contract view without replacing existing Graph, Files, or Read behavior

#### Scenario: API view shows empty state without artifacts

- **WHEN** the API tab is selected
- **AND** no API contract artifact exists for the active workspace
- **THEN** the view SHALL show an empty state explaining that API contracts have not been scanned
- **AND** the view SHALL provide a scan-oriented next action or status hint

### Requirement: Group-first API graph rendering

The API contract view SHALL use hierarchical group-first rendering and SHALL NOT default to a flat endpoint graph when endpoint volume is large.

#### Scenario: Large API graph is grouped by hierarchy

- **WHEN** API endpoint count exceeds 50
- **THEN** the API graph SHALL initially render group nodes instead of every endpoint node
- **AND** the default hierarchy SHALL group by protocol, module/package/namespace, controller/router/service, and endpoint
- **AND** group nodes SHALL show aggregate endpoint counts and confidence summaries

#### Scenario: Medium API graph reveals only local endpoint context

- **WHEN** API endpoint count is between 31 and 50
- **THEN** the API graph SHALL render group nodes by default
- **AND** the API graph MAY render endpoint nodes only for the selected or searched group

#### Scenario: Small API graph preserves group context

- **WHEN** API endpoint count is 30 or fewer
- **THEN** the API view MAY show endpoint nodes directly
- **AND** the view SHALL still preserve group context through labels, breadcrumbs, or inspector metadata

#### Scenario: User drills down from group to endpoint

- **WHEN** the user selects or expands an API group node
- **THEN** the view SHALL reveal the next hierarchy level or endpoint nodes within that group
- **AND** unrelated endpoint groups SHALL remain collapsed unless selected, searched, or filtered

#### Scenario: Controller hierarchy stays in the left navigator

- **WHEN** the API contract view renders a selected service or module
- **THEN** service or module groups and controller/router groups SHALL appear in a collapsible left hierarchy navigator
- **AND** the center stage SHALL render endpoint cards grouped by API type or method
- **AND** the center stage SHALL NOT render controller cards as a separate redundant grid

### Requirement: API graph controls

The API contract view SHALL support graph navigation controls consistent with the relationship graph.

#### Scenario: API graph supports explicit zoom and reset

- **WHEN** the API tab is selected
- **THEN** the user SHALL be able to zoom in, zoom out, and reset the API graph view
- **AND** mouse wheel interaction SHALL preserve page or panel scrolling
- **AND** mouse wheel interaction SHALL NOT zoom the API graph canvas

#### Scenario: API graph supports layout selection

- **WHEN** the API tab is selected
- **THEN** the user SHALL be able to choose graph layout modes such as radial, tree, or force when supported
- **AND** changing layout SHALL preserve the current selection when possible

### Requirement: API inspector

The API contract view SHALL provide an inspector for selected API groups, endpoints, schemas, and method chain nodes.

#### Scenario: Endpoint inspector shows API contract details

- **WHEN** the user selects an endpoint node
- **THEN** the inspector SHALL show protocol, method or operation name, path when known, framework when known, handler symbol, source file, path/query/header/cookie parameters, request body, response status codes, response content types, error responses, request schema, response schema, description, usage scenario, confidence, and evidence

#### Scenario: Endpoint inspector masks sensitive evidence

- **WHEN** endpoint evidence includes examples, headers, cookies, tokens, passwords, secrets, credentials, or api keys
- **THEN** the inspector SHALL show only redacted evidence values
- **AND** source file and line provenance SHALL remain visible when available

#### Scenario: Method chain inspector shows evidence

- **WHEN** the user selects a method chain edge or chain node
- **THEN** the inspector SHALL show source symbol, target symbol, source file, line evidence when known, excerpt when available, and confidence

#### Scenario: Group inspector shows aggregated structure

- **WHEN** the user selects an API group node
- **THEN** the inspector SHALL show group name, hierarchy level, endpoint count, protocol distribution, language distribution, confidence distribution, and drill-down affordances

### Requirement: API filtering and search

The API contract view SHALL allow users to reduce large API graphs by structure and contract metadata.

#### Scenario: User filters API graph

- **WHEN** the user filters by protocol, language, framework, module, namespace, controller, confidence, or text query
- **THEN** the API graph SHALL reduce visible groups and endpoints to matching results
- **AND** matching endpoints SHALL remain reachable through their group hierarchy

#### Scenario: Search result preserves hierarchy

- **WHEN** a text search matches an endpoint inside a collapsed group
- **THEN** the view SHALL reveal enough ancestor groups to explain where the endpoint belongs
- **AND** the view SHALL NOT replace the graph with an ungrouped flat result list

### Requirement: API view localization

The API contract view SHALL provide localized UI labels for all new API tab controls, empty states, filters, confidence labels, inspector fields, and error states.

#### Scenario: Chinese UI renders API labels

- **WHEN** the application language is Chinese
- **THEN** the API tab, graph controls, group labels, filters, confidence states, inspector fields, empty states, and scan errors SHALL render Chinese text while preserving technical terms such as API, HTTP, gRPC, GraphQL, schema, endpoint, and confidence where appropriate

#### Scenario: Missing localization key is not shown to users

- **WHEN** a localization key for the API view is missing
- **THEN** the UI SHALL NOT render raw key names as user-facing labels

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

### Requirement: API contract view uses adjustable three-pane layout
The API contract view SHALL render left, center, and right panes with adjustable widths while preserving the existing default left navigation width and splitting the remaining width evenly between center and right panes.

#### Scenario: API panes render with default proportions
- **WHEN** the user opens the API tab
- **THEN** the left pane SHALL keep the established service/module tree default width
- **AND** the center endpoint pane and right detail pane SHALL each receive approximately half of the remaining horizontal space

#### Scenario: User resizes all API panes
- **WHEN** the user drags a separator between left, center, and right panes
- **THEN** the target pane width SHALL update within bounded minimum and maximum widths
- **AND** endpoint list and detail content SHALL remain usable without overlapping adjacent panes

### Requirement: API endpoint list renders one endpoint per row
The API contract view SHALL render endpoint candidates in a single-column list where each row represents exactly one endpoint and endpoint path text does not wrap.

#### Scenario: Endpoint row removes tag noise
- **WHEN** an endpoint is rendered in the center pane
- **THEN** the row SHALL show method, path, handler or operation name, and a concise description when available
- **AND** the row SHALL NOT render the previous bottom tag list for protocol, language, framework, or confidence

#### Scenario: Endpoint row shows Chinese comment summary
- **WHEN** an endpoint has a Chinese doc comment, code comment, schema description, or annotation description
- **THEN** the endpoint row SHALL show a concise Chinese description derived from that evidence
- **AND** the row SHALL keep the endpoint path on one line with truncation instead of wrapping

### Requirement: API endpoint inspector renders Swagger-like detail
The API contract inspector SHALL render selected endpoint details in structured sections similar to Swagger documentation pages.

#### Scenario: Endpoint detail shows descriptions and annotations
- **WHEN** the user selects an endpoint with code comments or Swagger-like annotation descriptions
- **THEN** the inspector SHALL show an interface description section with code comment text and annotation/schema description text when available
- **AND** each description source SHALL remain evidence-backed or explicitly unavailable

#### Scenario: Endpoint detail shows structured request data
- **WHEN** the selected endpoint has path, query, header, cookie, or body parameters
- **THEN** the inspector SHALL show them as a single interface input section with name, location, required flag, type or schema, description, default or example when available
- **AND** a request body parameter such as `@RequestBody RealNameCheckParam realNameCheckParam` SHALL be rendered as an input parameter with `location=body`
- **AND** object input parameters SHALL expand their DTO/schema fields, such as `realNameCheckParam.vin`, when field evidence is available
- **AND** request body content type and schema metadata MAY be shown in invocation metadata, but SHALL NOT replace the unified interface input section

#### Scenario: Endpoint detail shows structured response data
- **WHEN** the selected endpoint has response metadata
- **THEN** the inspector SHALL show response status, content type, schema or structured body fields, examples when available, and error response markers
- **AND** missing response body evidence SHALL be rendered as unavailable rather than invented text

### Requirement: API view removes low-value bottom issue strip
The API contract view SHALL NOT render the previous always-visible bottom `Repair / Read issues` strip when the user is reading API endpoints.

#### Scenario: Bottom issue strip is absent from API reading surface
- **WHEN** the API tab is active and endpoint data is visible
- **THEN** the main API surface SHALL NOT show the bottom issue chip strip
- **AND** relevant scan status, repair metadata, confidence, and evidence SHALL remain accessible through top summary, empty state, or inspector sections

### Requirement: API contract view exports Swagger-like documentation
The API contract view SHALL allow users to export the current workspace API contract graph as Markdown, HTML, or OpenAPI 3.0 JSON content generated from the normalized API contract graph.

#### Scenario: User exports Markdown documentation
- **WHEN** the user chooses Markdown export from the API tab
- **THEN** the system SHALL generate a Markdown document containing endpoint descriptions, methods, paths, parameters, request bodies, responses, schemas, confidence, and redacted evidence in a Swagger-like order
- **AND** unavailable request or response structures SHALL be marked as unavailable rather than fabricated

#### Scenario: User exports HTML documentation
- **WHEN** the user chooses HTML export from the API tab
- **THEN** the system SHALL generate an HTML document containing the same Swagger-like sections as Markdown export
- **AND** artifact text, comments, examples, and evidence excerpts SHALL be escaped or sanitized before entering HTML
- **AND** raw script tags or event-handler attributes from scanned source comments or evidence SHALL NOT remain executable in the exported HTML

#### Scenario: User exports OpenAPI JSON documentation
- **WHEN** the user chooses OpenAPI JSON export from the API tab
- **THEN** the system SHALL generate an OpenAPI 3.0 JSON document from endpoint method, path, description, parameters, request body, and responses when those fields are available
- **AND** confidence, parser source, source evidence, and unavailable state that cannot be represented as standard OpenAPI SHALL be preserved through product-specific extension metadata
- **AND** the exporter SHALL NOT invent schemas, required flags, status codes, or descriptions that are not present in the API contract graph

#### Scenario: Export scope defaults to full workspace graph
- **WHEN** the user exports API documentation without choosing an explicit scope
- **THEN** the system SHALL export the full current workspace API contract graph
- **AND** the export SHALL NOT silently limit output to the selected group, selected endpoint, or current filter result

