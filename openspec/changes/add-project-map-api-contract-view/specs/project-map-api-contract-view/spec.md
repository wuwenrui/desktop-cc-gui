## ADDED Requirements

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
