## ADDED Requirements

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
