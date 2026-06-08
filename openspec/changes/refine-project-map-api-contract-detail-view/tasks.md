## 1. Contract and Projection Model

- [x] 1.1 [P0][Depends: proposal/design/specs] Extend `src/features/project-map/types.ts` API contract types for evidence-backed description sources and structured request/response schema fields; input: delta specs; output: compile-safe optional fields; validation: `npm run typecheck`.
- [x] 1.2 [P0][Depends: 1.1] Update `src/features/project-map/utils/relationshipDashboardModel.ts` normalizers to accept old artifacts and new optional description/schema fields; input: mixed old/new artifact fixtures; output: safe `ProjectMapApiContractGraph`; validation: focused normalizer assertions or API smoke fixture.
- [x] 1.3 [P0][Depends: 1.2] Add feature-local projection helpers in `src/features/project-map/components/projectMapRelationshipApiModel.ts` for endpoint row summary and Swagger-like detail sections; input: normalized endpoint; output: row/detail view model; validation: unit-level fixture or component smoke.

## 2. Scanner and Artifact Enrichment

- [x] 2.1 [P0][Depends: 1.1] Extend Rust `ApiEndpoint` / parameter / body / response structs in `src-tauri/src/project_map_api_contracts.rs` with optional comment, annotation description, and structured schema metadata; input: OpenSpec discovery requirements; output: serializable artifact fields; validation: Rust compile and fixture serialization.
- [x] 2.2 [P0][Depends: 2.1] Extract Java/Spring-style doc comments, `@Operation`, `@ApiResponses`, `@ApiResponse`, inline `@Parameter(description=...)`, `@RequestBody` DTO type, and method return type near controller methods; input: Java controller fixture like `cancel(@Parameter(description = "订单号") @RequestBody FcsOrderCancelParam orderCancelParam)`; output: endpoint description evidence, request body schema, parameter/body description, response descriptions, and response schema; validation: focused Rust test in `src-tauri/src/project_map_api_contracts_tests.rs`.
- [x] 2.3 [P0][Depends: 2.1] Preserve OpenAPI/Swagger operation summary, description, parameters, request body, and responses as structured endpoint metadata; input: OpenAPI fixture; output: spec-confidence endpoint detail fields; validation: existing strong contract test extended.
- [x] 2.4 [P1][Depends: 2.1] Add conservative structured request/response extraction for fallback language adapters where type hints or schema names are already detectable; input: mixed language fixtures; output: low/medium-confidence schema refs or unavailable metadata; validation: adapter fixture tests.

## 3. Adjustable API Layout

- [x] 3.1 [P0][Depends: 1.3] Refactor API workspace in `src/features/project-map/components/ProjectMapRelationshipWorkspaces.tsx` into left tree, center endpoint list, and right inspector panes; input: existing API tab props; output: three-pane API surface; validation: API smoke test renders all panes.
- [x] 3.2 [P0][Depends: 3.1] Implement feature-local drag handles and width clamp logic for left/center/right panes without adding dependencies; input: pointer drag events; output: resized panes with bounded widths; validation: component interaction test or manual smoke.
- [x] 3.3 [P1][Depends: 3.2] Add API pane CSS in Project Map relationship styles with responsive overflow, non-overlap guarantees, and stable dark theme contrast; input: design screenshot target; output: production CSS; validation: visual smoke.

## 4. Endpoint List Refactor

- [x] 4.1 [P0][Depends: 1.3,3.1] Replace endpoint card grid with single-column endpoint rows; input: `apiEndpointSections`; output: one endpoint per row; validation: API smoke test asserts row count and no tag list.
- [x] 4.2 [P0][Depends: 4.1] Render concise Chinese/code comment summary in endpoint rows and keep endpoint paths single-line with truncation; input: endpoint with doc comment; output: readable row summary; validation: component fixture.
- [x] 4.3 [P1][Depends: 4.1] Preserve group-first navigation semantics while center pane lists only selected group endpoints; input: selected group and filters; output: visible hierarchy + endpoint rows; validation: existing hierarchy/search smoke remains valid.

## 5. Swagger-like Inspector Refactor

- [x] 5.1 [P0][Depends: 1.3,3.1] Split endpoint inspector rendering into structured sections: overview, description, parameters, request body, responses, schemas, evidence, confidence; input: selected endpoint projection; output: Swagger-like detail UI; validation: API smoke test asserts key section headings.
- [x] 5.2 [P0][Depends: 5.1] Render parameters grouped by path/query/header/cookie with name, required flag, type/schema, description, example/default; input: endpoint parameter fixtures; output: structured parameter table/list; validation: component fixture.
- [x] 5.3 [P0][Depends: 5.1] Render request body and responses as schema trees or explicit unavailable states; input: body/response fixtures; output: structured schema display; validation: component fixture.
- [x] 5.4 [P1][Depends: 5.1] Keep group inspector and method chain inspector compatible with the new right pane layout; input: selected group/chain; output: aggregate or evidence-rich detail; validation: existing API smoke and chain fixture.

## 6. Noise Removal and Localization

- [x] 6.1 [P0][Depends: 3.1] Remove the always-visible bottom `Repair / Read issues` strip from API tab main surface; input: active API tab; output: no bottom issue chip region; validation: component assertion or manual smoke.
- [x] 6.2 [P0][Depends: 5.1] Add/update Chinese and English i18n keys for new endpoint row, detail section, unavailable, schema, and resize affordance labels; input: new UI copy; output: no raw i18n keys; validation: focused UI smoke.
- [x] 6.3 [P1][Depends: 6.1] Re-home useful scan/repair metadata into top summary, empty state, or inspector evidence sections; input: scan status artifact; output: useful status without bottom noise; validation: empty/error state smoke.

## 7. API Documentation Export

- [x] 7.1 [P0][Depends: 1.3,5.1] Build `src/features/project-map/utils/apiContractExport.ts` with an API export projection from normalized `ProjectMapApiContractGraph`; input: full workspace endpoints/groups/schemas/evidence; output: format-agnostic export document; validation: fixture projection test.
- [x] 7.2 [P0][Depends: 7.1] Implement Markdown export renderer with Swagger-like endpoint sections and filename `api-contracts.md`; input: export document; output: Markdown string; validation: snapshot or focused string assertions.
- [x] 7.3 [P0][Depends: 7.1] Implement HTML export renderer with escaped artifact text, malicious comment/evidence fixtures, Swagger-like sections, and filename `api-contracts.html`; input: export document; output: safe HTML string; validation: `<script>` / `onerror=` escaping test and focused string assertions.
- [x] 7.4 [P0][Depends: 7.1] Implement OpenAPI 3.0 JSON export renderer with filename `api-contracts.openapi.json`, preserving confidence/evidence/unavailable metadata through product-specific extension fields; input: export document; output: OpenAPI 3.0 JSON payload; validation: structured JSON assertions.
- [x] 7.5 [P1][Depends: 7.2,7.3,7.4] Add API tab export UI with Markdown, HTML, and OpenAPI JSON format choices; input: active full workspace API contract graph; output: downloadable export file; validation: component interaction test or manual smoke.

## 8. Verification and OpenSpec Closure

- [x] 8.1 [P0][Depends: 1-7] Run `openspec validate refine-project-map-api-contract-detail-view --strict --no-interactive`; input: completed artifacts; output: strict validation pass.
- [x] 8.2 [P0][Depends: frontend changes] Run `npm run typecheck`; input: TypeScript changes; output: typecheck pass.
- [x] 8.3 [P0][Depends: frontend changes] Run focused Vitest for API relationship section, e.g. `npm run test -- src/features/project-map/components/ProjectMapRelationshipSection.api-smoke.test.tsx`; input: frontend UI changes; output: focused tests pass.
- [x] 8.4 [P0][Depends: backend changes] Run `cargo test --manifest-path src-tauri/Cargo.toml project_map_api_contracts`; input: Rust scanner changes; output: focused scanner tests pass.
- [x] 8.5 [P1][Depends: style changes] Run `npm run check:large-files` if Project Map CSS files grow or split; input: stylesheet changes; output: large-file guard pass.
