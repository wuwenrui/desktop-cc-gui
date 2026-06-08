## ADDED Requirements

### Requirement: API contract scan branch

The system SHALL add an API contract discovery branch to Project Map scanning and SHALL keep API contract artifacts independent from file relationship artifacts.

#### Scenario: API scan runs independently from file relationship scan

- **WHEN** the user starts a Project Map scan for a workspace
- **THEN** the system SHALL run or schedule API contract discovery as a distinct scan branch
- **AND** API contract results SHALL be written to `project-map-relations/<storage-key>/api-contracts/`
- **AND** file relationship artifacts SHALL NOT be overwritten by API contract artifacts

#### Scenario: One scan branch fails without corrupting the other

- **WHEN** API contract discovery fails
- **THEN** file relationship scan results SHALL remain readable if that branch succeeded
- **AND** the API branch SHALL expose its own failure reason
- **AND** the system SHALL NOT merge partial API candidates into trusted file relationship artifacts

### Requirement: API scan scope control

The API contract scanner SHALL respect workspace scope, ignore rules, generated-code boundaries, and file size limits.

#### Scenario: Dependency and generated directories are skipped

- **WHEN** API contract discovery scans a workspace
- **THEN** the scanner SHALL skip dependency, build, generated, binary, and VCS directories such as `node_modules`, `target`, `build`, `dist`, `vendor`, and `.git`
- **AND** skipped buckets SHALL be counted in scan run metadata with a reason

#### Scenario: Oversized or binary files do not block scan

- **WHEN** the scanner encounters an oversized or binary file
- **THEN** the scanner SHALL skip that file with a recorded reason
- **AND** the scanner SHALL continue scanning eligible files

### Requirement: Multi-language API adapter contract

The system SHALL discover API contracts through a pluggable adapter contract that supports strong contract sources and language-specific source inference.

#### Scenario: Language parsing uses mature parser sources

- **WHEN** an adapter needs to inspect source code semantics
- **THEN** the adapter SHALL prefer mature parser, compiler API, syntax tree, or descriptor sources for that language
- **AND** the adapter SHALL NOT implement a full programming-language parser with handwritten string scanning

#### Scenario: Regex fallback stays localized

- **WHEN** an adapter uses regular expressions for route or symbol recognition
- **THEN** that regex SHALL be a localized fallback or confirmation step
- **AND** the adapter SHALL keep confidence and evidence boundaries explicit

#### Scenario: Strong contract sources are discovered first

- **WHEN** a workspace contains OpenAPI, Swagger, protobuf, gRPC, or GraphQL schema files
- **THEN** the API scan SHALL parse those files before weaker source inference
- **AND** endpoints discovered from these sources SHALL keep schema evidence
- **AND** endpoints discovered from these sources SHALL be eligible for `spec` confidence

#### Scenario: Mainstream language adapters produce candidates

- **WHEN** a workspace contains Java, Kotlin, Python, Go, C, C++, TypeScript, JavaScript, C#, or Rust source files
- **THEN** the API scan SHALL route those files through matching language adapters when available
- **AND** each adapter SHALL emit endpoint or handler candidates using the shared API contract model
- **AND** each candidate SHALL include language, source file, evidence, and confidence

#### Scenario: Declared languages have adapter skeletons

- **WHEN** a declared first-stage language adapter cannot identify a concrete endpoint in a source file
- **THEN** the adapter SHALL still report an explicit unsupported or no-candidate reason for that file family
- **AND** Java, Kotlin, Python, Go, C, C++, TypeScript, JavaScript, C#, and Rust SHALL NOT be completely absent from the adapter registry

#### Scenario: Parser source is recorded

- **WHEN** an adapter emits endpoint or handler candidates
- **THEN** the evidence SHALL identify whether the candidate came from a schema parser, compiler API, syntax tree parser, descriptor, or fallback pattern
- **AND** candidates from fallback patterns SHALL NOT be presented as compiler-grade AST evidence

#### Scenario: Weak semantic languages keep confidence boundaries

- **WHEN** a C or C++ adapter infers an API from handler tables, macros, framework calls, or ABI-style entry points
- **THEN** the emitted candidate SHALL include evidence explaining the inference
- **AND** the candidate SHALL NOT be marked as `spec` confidence unless it came from a strong contract source

### Requirement: Unified API contract graph model

The system SHALL normalize discovered API data into a language-neutral API contract graph.

#### Scenario: Endpoint model preserves contract fields

- **WHEN** an adapter emits an endpoint candidate
- **THEN** the normalized endpoint SHALL preserve protocol, language, framework when known, method or operation name, path when known, handler symbol, source file, path/query/header/cookie parameters, request body, response status codes, response content types, error responses, request schema, response schema, description, usage scenario, group ids, call chain ids, confidence, and evidence

#### Scenario: Duplicate endpoints are merged by stable identity

- **WHEN** a strong contract source and a source adapter describe the same endpoint
- **THEN** the system SHALL merge them into a stable endpoint identity
- **AND** strong contract evidence SHALL be preserved
- **AND** source-code evidence SHALL be preserved as implementation evidence

#### Scenario: Endpoint identity uses protocol-specific canonical keys

- **WHEN** the system calculates endpoint identity
- **THEN** HTTP endpoints SHALL use protocol, normalized method, normalized path, and operation/source root identity
- **AND** gRPC endpoints SHALL use package, service, and method
- **AND** GraphQL endpoints SHALL use operation type and field name
- **AND** C ABI or generic RPC fallback endpoints SHALL use symbol and normalized source or header path

#### Scenario: Ambiguous endpoint identity does not force merge

- **WHEN** two endpoint candidates cannot be safely matched by canonical identity
- **THEN** the scanner SHALL keep them as separate candidates
- **AND** the scanner SHALL expose ambiguity evidence rather than force-merging them

### Requirement: Evidence-backed descriptions and usage scenarios

The system SHALL keep endpoint descriptions and usage scenarios source-backed or explicitly marked as inferred.

#### Scenario: Description comes from trusted evidence

- **WHEN** an endpoint has schema descriptions, doc comments, route names, README examples, tests, or similar source evidence
- **THEN** the system SHALL attach that text as description or usage scenario with evidence provenance

#### Scenario: Missing description is not fabricated

- **WHEN** an endpoint has no reliable description or usage scenario evidence
- **THEN** the endpoint SHALL remain visible
- **AND** the endpoint SHALL expose that description or usage scenario is unavailable

### Requirement: API method chain candidates

The system SHALL attach method chain candidates to API endpoints when handler-to-implementation evidence can be found.

#### Scenario: Endpoint handler chain is captured

- **WHEN** a route handler calls service, repository, model, outbound API, or RPC symbols that can be conservatively detected
- **THEN** the API scan SHALL emit method chain candidate edges
- **AND** each edge SHALL include source symbol, target symbol, source file, line evidence when known, direction, edge kind, and confidence

#### Scenario: Method chain traversal is bounded

- **WHEN** method chain extraction follows handler calls
- **THEN** the scanner SHALL apply a maximum traversal depth
- **AND** cycles SHALL be truncated with a recorded truncated reason

#### Scenario: Unknown chain remains explicit

- **WHEN** an endpoint is discovered but no reliable method chain is found
- **THEN** the endpoint SHALL remain visible
- **AND** the endpoint SHALL expose that method chain evidence is unavailable rather than fabricating a chain

### Requirement: API evidence redaction

The system MUST redact sensitive evidence before API contract artifacts are rendered in the UI.

#### Scenario: Sensitive examples are masked

- **WHEN** API evidence includes headers, cookies, request examples, response examples, README snippets, tests, or schema examples
- **THEN** values that look like Authorization, Cookie, token, password, secret, api key, private key, credential, or env-style sensitive data SHALL be masked before UI display

#### Scenario: Redaction preserves provenance

- **WHEN** an evidence excerpt is redacted
- **THEN** the redacted excerpt SHALL keep source file and line provenance when available
- **AND** the UI SHALL NOT need the original unredacted value to explain the endpoint

### Requirement: API scan workspace ownership

The system MUST bind API contract scan artifacts to the workspace and storage key that were active when the scan started.

#### Scenario: Workspace switch does not redirect API artifacts

- **WHEN** an API contract scan starts for workspace A
- **AND** the user switches to workspace B before the scan completes
- **THEN** API contract artifacts SHALL be written only for workspace A
- **AND** workspace B SHALL NOT render workspace A's API contract graph as its own

#### Scenario: Storage ownership mismatch fails closed

- **WHEN** the API contract artifact manifest storage key does not match the target workspace storage key
- **THEN** the system SHALL reject or quarantine the artifact
- **AND** the UI SHALL NOT render that artifact as a trusted API view
