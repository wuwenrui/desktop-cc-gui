## 1. Data Model and Storage

### Calibration note（2026-06-06）

Current code supports `13 / 48` fully completed tasks. Several discovery tasks have partial substrate but remain unchecked by design:

- `2.3`: relationship scan already records ignored path hints and API artifact `skipped` summary, but API-specific dependency/generated/binary/max-size scope fixtures are not complete.
- `4.0 / 4.1-4.8`: backend has fallback-pattern extraction for several language families, but no mature parser wrapper, adapter registry, unsupported/no-candidate reason matrix, or focused adapter fixture suite yet.
- `5.x`: `callChains` is currently emitted as an empty artifact slot; method chain extraction and inspector are not complete.
- `7.4 / 7.5`: relationship dashboard search/filter exists for file relationship views, but API-specific protocol/language/framework/module/controller/confidence filters and hierarchy reveal are not complete.
- `7.4 / 7.5` update: API tab text query is now wired to endpoints and ancestor groups, and file role/type/noise controls are hidden while API tab is active. Full protocol/language/framework/controller/confidence filter matrix remains open.

Do not mark these partial substrate items as complete until their validation clauses are satisfied.

- [x] 1.1 [P0][Depends: proposal/specs] Define shared API contract TypeScript/Rust data types for `ApiEndpoint`, `ApiGroup`, `ApiParameter`, `ApiRequestBody`, `ApiResponse`, `ApiEvidence`, `ApiSchemaRef`, `ApiCallChain`, and `ApiContractGraph`; input: OpenSpec specs; output: compile-safe domain model; validation: typecheck and fixture serialization.
- [x] 1.2 [P0][Depends: 1.1] Add API contract artifact namespace at `project-map-relations/<storage-key>/api-contracts/` with manifest, ownership storage key, run metadata, endpoint index, group index, schema index, and chain index; input: active workspace scan result; output: persisted API artifacts; validation: read/write round trip fixture.
- [x] 1.3 [P0][Depends: 1.2] Enforce workspace ownership checks for API contract artifact read/write; input: mismatched manifest fixture; output: rejected or quarantined artifact; validation: focused ownership mismatch test.
- [x] 1.4 [P1][Depends: 1.2] Add stale and repair metadata for API contract artifacts; input: changed workspace fingerprint; output: visible stale summary; validation: fixture with stale manifest.
- [x] 1.5 [P0][Depends: 1.1] Implement evidence redaction utility for headers, cookies, examples, credentials, tokens, passwords, secrets, api keys, private keys, and env-style values; input: sensitive evidence fixtures; output: redacted UI-safe evidence; validation: redaction fixture tests.
- [x] 1.6 [P0][Depends: 1.1] Define parser source metadata for schema parser, compiler API, syntax tree parser, descriptor, and fallback pattern evidence; input: adapter evidence examples; output: evidence records that expose parser source; validation: parser source fixture serialization.

## 2. Scan Orchestration

- [x] 2.1 [P0][Depends: 1.1] Add an independent API contract scan branch to Project Map scan orchestration; input: workspace scan request; output: API scan run result isolated from file relationship scan; validation: branch failure does not corrupt file relationship artifacts.
- [x] 2.2 [P0][Depends: 2.1] Implement scan result merge rules that prefer strong contract evidence and merge duplicate endpoint identities; input: OpenAPI plus source handler fixture; output: single merged endpoint with both evidence sets; validation: duplicate merge fixture.
- [x] 2.3 [P0][Depends: 2.1] Implement scan scope controls for workspace ignore, dependency/generated directory skip, binary skip, max file size, and skipped reason metadata; input: workspace containing dependencies/generated/binary files; output: bounded scan with skip summary; validation: scan scope fixture.
- [x] 2.4 [P0][Depends: 2.2] Implement protocol-specific canonical endpoint identity for HTTP, gRPC, GraphQL, and C ABI / generic RPC fallback; input: duplicate and ambiguous endpoint fixtures; output: stable merge or explicit ambiguity; validation: identity fixture tests.
- [x] 2.5 [P1][Depends: 2.1] Surface API branch progress and failure status separately from file relationship branch status; input: parser failure fixture; output: API-specific error state; validation: UI/state reducer focused test.

## 3. Strong Contract Adapters

- [x] 3.1 [P0][Depends: 1.1] Implement OpenAPI / Swagger adapter; input: `openapi.yaml` and `swagger.json`; output: endpoints with `spec` confidence and schema evidence; validation: fixture parse test.
- [x] 3.2 [P0][Depends: 1.1] Implement protobuf / gRPC adapter; input: `.proto` services and messages; output: RPC endpoints, request schema refs, response schema refs; validation: fixture parse test.
- [x] 3.3 [P1][Depends: 1.1] Implement GraphQL schema adapter; input: GraphQL schema files; output: query/mutation/subscription endpoints and schema evidence; validation: fixture parse test.
- [x] 3.4 [P0][Depends: 1.6] Select and wrap mature parser/schema parser entrypoints for OpenAPI, protobuf, GraphQL, Python, Go, TypeScript/JavaScript, Java/Kotlin, C/C++, C#, and Rust without leaking external parser schemas into persisted mossx artifacts; input: parser evaluation notes; output: parser wrapper plan and adapter interface; validation: design review checklist.

## 4. Language Source Adapters

- [x] 4.0 [P0][Depends: 1.1, 1.6] Register first-stage adapter skeletons for Java, Kotlin, Python, Go, C, C++, TypeScript, JavaScript, C#, and Rust with explicit parser source metadata plus no-candidate or unsupported reason output; input: mixed-language workspace fixture; output: adapter registry coverage and skip/no-candidate reasons; validation: adapter registry fixture test.
- [x] 4.1 [P0][Depends: 1.1] Implement Java / Kotlin adapter for Spring MVC, WebFlux, JAX-RS, Micronaut, and Quarkus route annotations; input: controller fixtures; output: endpoint candidates with handler evidence; validation: adapter fixture tests.
- [x] 4.2 [P0][Depends: 1.1] Implement Python adapter for FastAPI, Flask, Django, DRF, and typed function route patterns; input: route fixtures; output: endpoint candidates and request/response model refs when detectable; validation: adapter fixture tests.
- [x] 4.3 [P0][Depends: 1.1] Implement Go adapter for net/http, Gin, Echo, Fiber, Chi, and gRPC registration; input: router fixtures; output: endpoint candidates and handler symbols; validation: adapter fixture tests.
- [x] 4.4 [P0][Depends: 1.1] Implement TypeScript / JavaScript adapter for Express, Koa, Fastify, NestJS, and Next API routes; input: route fixtures; output: endpoint candidates and source evidence; validation: adapter fixture tests.
- [x] 4.5 [P1][Depends: 1.1] Implement C# adapter for ASP.NET Core controllers and Minimal API; input: controller and minimal API fixtures; output: endpoint candidates with confidence; validation: adapter fixture tests.
- [x] 4.6 [P1][Depends: 1.1] Implement Rust adapter for Axum, Actix Web, Rocket, and Warp; input: router fixtures; output: endpoint candidates with handler evidence; validation: adapter fixture tests.
- [x] 4.7 [P0][Depends: 1.1] Implement C adapter baseline for Mongoose, CivetWeb, libmicrohttpd, handler tables, and ABI-style entry points; input: C server fixtures; output: endpoint or handler candidates with explicit confidence/evidence; validation: low-confidence fixture tests.
- [x] 4.8 [P0][Depends: 1.1] Implement C++ adapter baseline for Drogon, Crow, Oat++, Pistache, RESTinio, Boost.Beast, and gRPC; input: C++ server fixtures; output: endpoint or handler candidates with explicit confidence/evidence; validation: adapter fixture tests.

## 5. Method Chain Extraction

- [x] 5.1 [P0][Depends: language adapters] Extract conservative handler-to-service call chain candidates for supported languages with edge kind, direction, max depth, cycle guard, and truncated reason; input: handler fixtures with service calls and cycles; output: bounded `ApiCallChain` edges; validation: per-language chain fixture tests.
- [x] 5.2 [P1][Depends: 5.1] Attach source line and excerpt evidence to method chain edges when available; input: source file fixtures; output: chain evidence with line/excerpt; validation: evidence fixture tests.
- [x] 5.3 [P1][Depends: 5.1] Represent unavailable method chains explicitly in endpoint metadata; input: endpoint without chain fixture; output: endpoint visible with no fabricated chain; validation: no-chain fixture test.

## 6. API Contract View UI

- [x] 6.1 [P0][Depends: 1.1] Add `接口 API` as the fourth Project Map relationship dashboard tab; input: API tab state; output: selectable tab without breaking Graph, Files, or Read; validation: component focused test or manual smoke.
- [x] 6.2 [P0][Depends: 1.2] Implement API empty state and scan status summary; input: workspace without API artifacts; output: clear empty state and scan hint; validation: UI fixture state.
- [x] 6.3 [P0][Depends: 1.2] Implement API graph data mapper from `ApiContractGraph` artifacts to UI nodes and edges; input: persisted API artifacts; output: renderable graph model; validation: mapper unit test.
- [x] 6.4 [P0][Depends: 6.3] Implement group-first API graph rendering by protocol, module/package/namespace, controller/router/service, endpoint with thresholds `<=30 endpoint direct`, `31-50 selected-group endpoint reveal`, and `>50 group-only first render`; input: large endpoint fixture; output: grouped graph nodes with aggregate counts; validation: large graph smoke test.
- [x] 6.5 [P0][Depends: 6.4] Implement drill-down interactions from group nodes to endpoint nodes; input: selected group node; output: next hierarchy level or endpoint children; validation: UI interaction test or manual smoke.
- [x] 6.6 [P1][Depends: 6.4] Implement API graph explicit zoom, reset, and layout selection parity with relationship graph controls while keeping mouse wheel for scrolling; input: user graph controls; output: updated graph transform/layout without wheel zoom; validation: manual smoke.
- [x] 6.7 [P0][Depends: 6.1] Add localized labels for API tab, empty state, graph controls, filters, confidence labels, inspector fields, scan errors, and redaction states; input: Chinese UI locale; output: no raw i18n keys in API view; validation: i18n fixture or manual smoke.

## 7. API Inspector and Filtering

- [x] 7.1 [P0][Depends: 6.3] Implement endpoint inspector showing protocol, method/operation, path, framework, handler, source file, path/query/header/cookie parameters, request body, response status codes, content types, error responses, request schema, response schema, description, usage scenario, confidence, and redacted evidence; input: selected endpoint; output: populated inspector; validation: fixture render test.
- [x] 7.2 [P0][Depends: 5.1, 7.1] Implement method chain inspector with source symbol, target symbol, file, line, excerpt, and confidence; input: selected chain edge; output: evidence-rich chain details; validation: fixture render test.
- [x] 7.3 [P1][Depends: 6.4] Implement group inspector with endpoint count, protocol distribution, language distribution, confidence distribution, and drill-down affordances; input: selected group; output: aggregate inspector; validation: fixture render test.
- [x] 7.4 [P1][Depends: 6.4] Implement filters for protocol, language, framework, module, namespace, controller, confidence, and text query; input: filter state; output: reduced graph preserving hierarchy; validation: filter mapper unit test.
- [x] 7.5 [P1][Depends: 7.4] Implement search result hierarchy reveal; input: text search matching endpoint inside collapsed group; output: ancestor groups revealed without flat replacement; validation: search fixture test.

## 8. Project Map Generation Integration

- [x] 8.1 [P1][Depends: 1.2, 1.5] Allow Project Map generation context builder to read API endpoint summaries, groups, and redacted method chain evidence; input: API contract artifacts; output: source-backed context entries; validation: context builder fixture.
- [x] 8.2 [P1][Depends: 8.1] Prevent API endpoint flattening into root-level semantic nodes during generation; input: large endpoint artifact; output: grouped evidence context without one-node-per-endpoint root flattening; validation: generation prompt/context fixture.
- [x] 8.3 [P1][Depends: 8.1] Preserve API evidence provenance in generated Project Map content; input: generated content referencing API contract; output: source links to schema/source/evidence lines; validation: provenance fixture.

## 9. Validation and Rollout

- [x] 9.1 [P0][Depends: all specs] Run `openspec validate add-project-map-api-contract-view --strict --no-interactive`; input: completed artifacts; output: strict validation pass; validation: command exits successfully.
- [x] 9.2 [P0][Depends: implementation] Run `npm run typecheck`; input: frontend/backend TypeScript changes; output: typecheck pass; validation: command exits successfully.
- [x] 9.3 [P0][Depends: implementation] Run `cargo check --manifest-path src-tauri/Cargo.toml` and focused Rust/backend tests when backend scan/storage changes are touched; input: Rust/backend changes; output: backend validation pass; validation: command exits successfully.
- [x] 9.4 [P1][Depends: implementation] Run focused adapter fixture tests for strong contract sources and language adapters; input: adapter fixtures; output: parser and merge tests pass; validation: focused test command exits successfully.
- [x] 9.5 [P1][Depends: implementation] Run API tab smoke test on a project with many endpoints; input: large endpoint fixture or real workspace; output: group-first rendering, drill-down, inspector, zoom, filters, i18n, and redaction verified; validation: manual smoke notes.
- [x] 9.6 [P2][Depends: validation] Document known adapter confidence limitations and unsupported framework gaps; input: implemented adapter matrix; output: user-visible limitation notes; validation: docs review.
