use std::collections::{BTreeMap, BTreeSet};

use serde::Serialize;
use serde_json::Value;

use crate::project_map_relations::ScannedFile;

#[derive(Debug, Clone)]
pub(crate) struct ApiRouteAnnotation {
    pub(crate) method: Option<String>,
    pub(crate) path: Option<String>,
    pub(crate) framework: String,
    pub(crate) confidence: String,
    pub(crate) parser_source: String,
}

#[derive(Debug, Clone, Default)]
pub(crate) struct JavaApiMethodMetadata {
    pub(crate) description: Option<String>,
    pub(crate) parameter_descriptions: BTreeMap<String, String>,
    pub(crate) response_descriptions: Vec<(String, String)>,
}

#[derive(Debug, Clone)]
pub(crate) struct JavaIndexedMethod {
    pub(crate) class_name: String,
    pub(crate) method_name: String,
    pub(crate) source_file: String,
    pub(crate) signature_line: usize,
    pub(crate) body_start_line: usize,
    pub(crate) end_line: usize,
}

#[derive(Debug, Clone, Default)]
pub(crate) struct JavaSourceIndex {
    pub(crate) class_name: String,
    pub(crate) injected_fields: BTreeMap<String, String>,
    pub(crate) methods: Vec<JavaIndexedMethod>,
}

#[derive(Debug, Clone)]
pub(crate) struct ApiRouteCandidate {
    pub(crate) protocol: String,
    pub(crate) language: String,
    pub(crate) framework: Option<String>,
    pub(crate) method: Option<String>,
    pub(crate) path: Option<String>,
    pub(crate) operation_name: Option<String>,
    pub(crate) handler_symbol: Option<String>,
    pub(crate) source_file: String,
    pub(crate) line: usize,
    pub(crate) excerpt: String,
    pub(crate) confidence: String,
    pub(crate) parser_source: String,
    pub(crate) module_label: String,
    pub(crate) controller_label: String,
    pub(crate) parameter_overrides: Vec<ApiParameter>,
    pub(crate) request_body_override: Option<ApiRequestBody>,
    pub(crate) response_overrides: Vec<ApiResponse>,
    pub(crate) request_schema_override: Option<ApiSchemaRef>,
    pub(crate) response_schema_override: Option<ApiSchemaRef>,
    pub(crate) description: Option<String>,
    pub(crate) usage_scenario: Option<String>,
}

#[derive(Debug, Clone, Default)]
pub(crate) struct ApiGroupBuild {
    pub(crate) id: String,
    pub(crate) label: String,
    pub(crate) level: String,
    pub(crate) parent_id: Option<String>,
    pub(crate) endpoint_ids: BTreeSet<String>,
    pub(crate) child_group_ids: BTreeSet<String>,
    pub(crate) protocol_counts: BTreeMap<String, usize>,
    pub(crate) language_counts: BTreeMap<String, usize>,
    pub(crate) confidence_counts: BTreeMap<String, usize>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ApiEvidence {
    pub(crate) path: String,
    pub(crate) line: usize,
    pub(crate) excerpt: String,
    pub(crate) redacted: bool,
    pub(crate) parser_source: String,
    pub(crate) extractor_version: String,
    pub(crate) observed_at: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ApiSchemaRef {
    pub(crate) id: String,
    pub(crate) name: String,
    pub(crate) language: String,
    pub(crate) source_file: String,
    pub(crate) evidence: Vec<ApiEvidence>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ApiParameter {
    pub(crate) name: String,
    pub(crate) location: String,
    pub(crate) required: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) schema: Option<ApiSchemaRef>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) default_value: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) example: Option<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub(crate) structured_fields: Vec<ApiStructuredSchemaField>,
    pub(crate) evidence: Vec<ApiEvidence>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ApiStructuredSchemaField {
    pub(crate) name: String,
    #[serde(rename = "type", skip_serializing_if = "Option::is_none")]
    pub(crate) field_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) required: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) default_value: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) description: Option<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub(crate) enum_values: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) range: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) example: Option<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub(crate) children: Vec<ApiStructuredSchemaField>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub(crate) evidence: Vec<ApiEvidence>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ApiRequestBody {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) content_type: Option<String>,
    pub(crate) required: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) schema: Option<ApiSchemaRef>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub(crate) structured_fields: Vec<ApiStructuredSchemaField>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub(crate) examples: Vec<String>,
    pub(crate) evidence: Vec<ApiEvidence>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ApiResponse {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) status_code: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) content_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) schema: Option<ApiSchemaRef>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub(crate) structured_fields: Vec<ApiStructuredSchemaField>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub(crate) examples: Vec<String>,
    pub(crate) is_error: bool,
    pub(crate) evidence: Vec<ApiEvidence>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ApiDescriptionSource {
    pub(crate) kind: String,
    pub(crate) text: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) language: Option<String>,
    pub(crate) evidence: Vec<ApiEvidence>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ApiEndpoint {
    pub(crate) id: String,
    pub(crate) protocol: String,
    pub(crate) language: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) framework: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) method: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) operation_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) handler_symbol: Option<String>,
    pub(crate) source_file: String,
    pub(crate) parameters: Vec<ApiParameter>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) request_body: Option<ApiRequestBody>,
    pub(crate) responses: Vec<ApiResponse>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) request_schema: Option<ApiSchemaRef>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) response_schema: Option<ApiSchemaRef>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) description: Option<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub(crate) description_sources: Vec<ApiDescriptionSource>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) usage_scenario: Option<String>,
    pub(crate) group_ids: Vec<String>,
    pub(crate) call_chain_ids: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) call_chain_unavailable_reason: Option<String>,
    pub(crate) confidence: String,
    pub(crate) evidence: Vec<ApiEvidence>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) canonical_identity: Option<String>,
    pub(crate) identity_kind: String,
    pub(crate) ambiguous_identity: bool,
}

pub(crate) fn api_description_sources(
    candidate: &ApiRouteCandidate,
    evidence: &[ApiEvidence],
) -> Vec<ApiDescriptionSource> {
    candidate
        .description
        .as_ref()
        .map(|description| {
            let kind = if candidate.confidence == "spec" {
                "schema-description"
            } else if candidate
                .framework
                .as_deref()
                .map(|framework| framework.contains("Spring") || framework.contains("Swagger"))
                .unwrap_or(false)
            {
                "swagger-annotation"
            } else if candidate.parser_source == "fallback-pattern" {
                "doc-comment"
            } else {
                "swagger-annotation"
            };
            vec![ApiDescriptionSource {
                kind: kind.to_string(),
                text: description.clone(),
                language: Some(candidate.language.clone()),
                evidence: evidence.to_vec(),
            }]
        })
        .unwrap_or_default()
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ApiGroup {
    pub(crate) id: String,
    pub(crate) label: String,
    pub(crate) level: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) parent_id: Option<String>,
    pub(crate) endpoint_ids: Vec<String>,
    pub(crate) child_group_ids: Vec<String>,
    pub(crate) protocol_counts: BTreeMap<String, usize>,
    pub(crate) language_counts: BTreeMap<String, usize>,
    pub(crate) confidence_counts: BTreeMap<String, usize>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ApiCallChainEdge {
    pub(crate) id: String,
    pub(crate) source_symbol: String,
    pub(crate) target_symbol: String,
    pub(crate) source_file: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) line: Option<usize>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) target_file: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) target_line: Option<usize>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) excerpt: Option<String>,
    pub(crate) direction: String,
    pub(crate) kind: String,
    pub(crate) confidence: String,
    pub(crate) evidence: Vec<ApiEvidence>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ApiCallChain {
    pub(crate) id: String,
    pub(crate) endpoint_id: String,
    pub(crate) edges: Vec<ApiCallChainEdge>,
    pub(crate) max_depth: usize,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) truncated_reason: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ApiSkippedSummary {
    pub(crate) reason: String,
    pub(crate) count: usize,
}

#[derive(Debug, Clone, Copy)]
pub(crate) struct ApiAdapterDescriptor {
    pub(crate) language: &'static str,
    pub(crate) parser_source: &'static str,
    pub(crate) frameworks: &'static [&'static str],
    pub(crate) extractor: fn(&ScannedFile, &str) -> Vec<ApiRouteCandidate>,
}

#[derive(Debug, Clone, Default)]
pub(crate) struct ApiAdapterCoverageBuild {
    pub(crate) file_count: usize,
    pub(crate) endpoint_count: usize,
    pub(crate) no_candidate_count: usize,
    pub(crate) unsupported_count: usize,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ApiAdapterCoverage {
    pub(crate) language: String,
    pub(crate) parser_source: String,
    pub(crate) frameworks: Vec<String>,
    pub(crate) status: String,
    pub(crate) file_count: usize,
    pub(crate) endpoint_count: usize,
    pub(crate) no_candidate_count: usize,
    pub(crate) unsupported_count: usize,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ApiContractGraph {
    pub(crate) schema_version: u8,
    pub(crate) generated_at: String,
    pub(crate) storage_key: String,
    pub(crate) scan_run_id: String,
    pub(crate) workspace_fingerprint: String,
    pub(crate) endpoints: Vec<ApiEndpoint>,
    pub(crate) groups: Vec<ApiGroup>,
    pub(crate) schemas: Vec<ApiSchemaRef>,
    pub(crate) call_chains: Vec<ApiCallChain>,
    pub(crate) adapters: Vec<ApiAdapterCoverage>,
    pub(crate) stale: Value,
    pub(crate) repair: Value,
    pub(crate) skipped: Vec<ApiSkippedSummary>,
}
