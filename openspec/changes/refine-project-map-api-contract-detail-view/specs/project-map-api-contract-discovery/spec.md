## ADDED Requirements

### Requirement: API discovery preserves evidence-backed endpoint descriptions
API contract discovery SHALL extract and preserve evidence-backed endpoint descriptions from code comments, doc comments, schema descriptions, and Swagger-like annotations when available.

#### Scenario: Java endpoint exposes code and Swagger descriptions
- **WHEN** a Java controller method contains a Chinese doc comment and Swagger-like summary or operation annotation
- **THEN** API discovery SHALL emit the endpoint path, HTTP method, handler method name, doc comment description, annotation description, source evidence, parser source, and confidence

#### Scenario: Schema contract endpoint exposes description
- **WHEN** an OpenAPI or Swagger document defines operation summary or description
- **THEN** API discovery SHALL emit that text as endpoint description evidence
- **AND** the endpoint SHALL keep `spec` confidence when the operation comes from the schema contract

### Requirement: API discovery emits structured request parameters
API contract discovery SHALL emit request parameters in a language-neutral structure that the frontend can render without language-specific branching.

#### Scenario: Query and path parameters are discovered
- **WHEN** a supported adapter detects path, query, header, or cookie parameters
- **THEN** each parameter SHALL include name, location, required state when known, schema or type when known, description when known, example or default when known, and evidence

#### Scenario: Request body structure is discovered
- **WHEN** a supported adapter detects request body DTO, schema, typed payload, protobuf request message, GraphQL argument, or OpenAPI request body
- **THEN** API discovery SHALL emit the method parameter as an input parameter with body location when the source language exposes a method argument
- **AND** API discovery SHALL emit request body content type when known, schema reference or structured fields when known, required state when known, examples when available, and evidence
- **AND** object body parameters SHALL preserve expandable DTO/schema fields when the source fields are available

### Requirement: API discovery emits structured response bodies
API contract discovery SHALL emit response structures in a language-neutral format with evidence and confidence.

#### Scenario: Response schema is discovered
- **WHEN** a supported adapter detects response DTO, return type, protobuf response message, GraphQL field type, or OpenAPI response schema
- **THEN** API discovery SHALL emit response status when known, content type when known, schema reference or structured fields when known, examples when available, error marker when applicable, and evidence

#### Scenario: Response structure is unavailable
- **WHEN** a supported adapter cannot reliably infer response structure
- **THEN** API discovery SHALL emit the endpoint without fabricated response fields
- **AND** the unavailable state SHALL remain visible through confidence, evidence, or explicit missing-schema metadata

### Requirement: Multi-language API discovery uses the same contract model
API contract discovery SHALL make all supported language and schema adapters emit the shared API contract model rather than language-specific UI payloads.

#### Scenario: Supported adapters emit normalized contract fields
- **WHEN** discovery scans Java, Kotlin, Python, Go, TypeScript, JavaScript, C#, Rust, C, C++, OpenAPI, protobuf, or GraphQL sources
- **THEN** every discovered endpoint SHALL use the same endpoint, parameter, request body, response, schema, evidence, parser source, and confidence fields
- **AND** adapter-specific parser details SHALL NOT leak into frontend-only payloads

#### Scenario: Fallback adapters remain conservative
- **WHEN** discovery uses fallback-pattern extraction rather than a mature parser or schema source
- **THEN** the endpoint SHALL expose fallback parser source and reduced confidence
- **AND** missing comments, request structures, or response structures SHALL NOT be guessed
