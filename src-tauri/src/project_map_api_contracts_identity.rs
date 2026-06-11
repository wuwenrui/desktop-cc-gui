use sha2::{Digest, Sha256};

use super::project_map_api_contracts_types::ApiRouteCandidate;

pub(crate) fn stable_hash(value: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(value.as_bytes());
    let digest = hasher.finalize();
    digest
        .iter()
        .take(8)
        .map(|byte| format!("{byte:02x}"))
        .collect()
}

pub(crate) fn normalize_api_path(value: Option<String>) -> Option<String> {
    let raw = value?.trim().to_string();
    if raw.is_empty() {
        return Some("/".to_string());
    }
    if raw.starts_with('/') {
        Some(raw)
    } else {
        Some(format!("/{raw}"))
    }
}

pub(crate) fn join_api_paths(prefix: &str, path: Option<String>) -> Option<String> {
    let path = normalize_api_path(path)?;
    let prefix = normalize_api_path(Some(prefix.to_string())).unwrap_or_else(|| "/".to_string());
    if prefix == "/" {
        return Some(path);
    }
    if path == "/" {
        return Some(prefix);
    }
    Some(format!(
        "{}/{}",
        prefix.trim_end_matches('/'),
        path.trim_start_matches('/')
    ))
}

pub(crate) fn api_endpoint_instance_identity(candidate: &ApiRouteCandidate) -> String {
    let fingerprint = format!(
        "source-candidate|{}|{}|{}|{}|{}|{}",
        candidate.protocol,
        candidate
            .method
            .as_deref()
            .unwrap_or("*")
            .to_ascii_uppercase(),
        candidate.path.as_deref().unwrap_or("").to_ascii_lowercase(),
        candidate.source_file.to_ascii_lowercase(),
        candidate.line,
        candidate.handler_symbol.as_deref().unwrap_or("")
    );
    fingerprint
}

fn normalized_api_identity_path(path: Option<&str>) -> Option<String> {
    let path = normalize_api_path(path.map(str::to_string))?;
    let mut normalized_segments = Vec::new();
    for segment in path.split('/') {
        if segment.is_empty() {
            continue;
        }
        let normalized = if segment.starts_with('{') && segment.ends_with('}') {
            "{}".to_string()
        } else if segment.starts_with(':') || segment.starts_with('<') && segment.ends_with('>') {
            "{}".to_string()
        } else {
            segment.to_ascii_lowercase()
        };
        normalized_segments.push(normalized);
    }
    if normalized_segments.is_empty() {
        Some("/".to_string())
    } else {
        Some(format!("/{}", normalized_segments.join("/")))
    }
}

pub(crate) fn api_endpoint_identity_kind(candidate: &ApiRouteCandidate) -> String {
    match candidate.protocol.as_str() {
        "http" => "http",
        "grpc" => "grpc",
        "graphql" => "graphql",
        "c-abi" => "c-abi",
        "rpc" => "generic-rpc",
        _ => "source-candidate",
    }
    .to_string()
}

pub(crate) fn canonical_api_endpoint_identity(candidate: &ApiRouteCandidate) -> Option<String> {
    match candidate.protocol.as_str() {
        "http" => {
            let path = normalized_api_identity_path(candidate.path.as_deref())?;
            Some(format!(
                "http|{}|{}",
                candidate
                    .method
                    .as_deref()
                    .unwrap_or("*")
                    .to_ascii_uppercase(),
                path
            ))
        }
        "grpc" => candidate
            .operation_name
            .as_ref()
            .or(candidate.handler_symbol.as_ref())
            .map(|operation| {
                format!(
                    "grpc|{}|{}|{}",
                    candidate.module_label.to_ascii_lowercase(),
                    candidate.controller_label.to_ascii_lowercase(),
                    operation
                )
            }),
        "graphql" => candidate.operation_name.as_ref().map(|operation| {
            format!(
                "graphql|{}|{}",
                candidate
                    .method
                    .as_deref()
                    .unwrap_or("operation")
                    .to_ascii_lowercase(),
                operation
            )
        }),
        "c-abi" | "rpc" => candidate.handler_symbol.as_ref().map(|symbol| {
            format!(
                "{}|{}|{}",
                api_endpoint_identity_kind(candidate),
                symbol,
                candidate.source_file.to_ascii_lowercase()
            )
        }),
        _ => None,
    }
}

pub(crate) fn api_endpoint_merge_identity(candidate: &ApiRouteCandidate) -> String {
    canonical_api_endpoint_identity(candidate)
        .unwrap_or_else(|| api_endpoint_instance_identity(candidate))
}

pub(crate) fn api_endpoint_id_from_identity(identity: &str) -> String {
    format!("api-endpoint-{}", stable_hash(identity))
}

fn api_confidence_rank(value: &str) -> u8 {
    match value {
        "spec" => 4,
        "high" => 3,
        "medium" => 2,
        "low" => 1,
        _ => 0,
    }
}

fn api_parser_source_rank(value: &str) -> u8 {
    match value {
        "schema-parser" | "descriptor" => 4,
        "compiler-api" => 3,
        "syntax-tree-parser" => 2,
        "fallback-pattern" => 1,
        _ => 0,
    }
}

pub(crate) fn api_candidate_priority(candidate: &ApiRouteCandidate) -> (u8, u8) {
    (
        api_confidence_rank(&candidate.confidence),
        api_parser_source_rank(&candidate.parser_source),
    )
}
