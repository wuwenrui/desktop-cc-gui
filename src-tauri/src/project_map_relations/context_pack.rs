use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::Path;

use serde_json::{json, Value};

use super::{
    content_hash, git_metadata, git_status_changed_paths, stable_hash, FileRelation, ScannedFile,
};

fn push_unique_id(target: &mut Vec<String>, value: &str) {
    if !target.iter().any(|item| item == value) {
        target.push(value.to_string());
    }
}

fn sorted_paths_for_ids(
    ids: &[String],
    file_by_id: &HashMap<String, &ScannedFile>,
    limit: usize,
) -> Vec<String> {
    let mut paths = ids
        .iter()
        .filter_map(|id| file_by_id.get(id).map(|file| file.path.clone()))
        .collect::<Vec<_>>();
    paths.sort();
    paths.dedup();
    paths.truncate(limit);
    paths
}

fn file_has_test_relation(
    file_id: &str,
    relations: &[FileRelation],
    file_by_id: &HashMap<String, &ScannedFile>,
) -> bool {
    relations.iter().any(|relation| {
        if relation.relation_type == "tested_by"
            && (relation.source_file_id == file_id || relation.target_file_id == file_id)
        {
            return true;
        }
        let adjacent_file_id = if relation.source_file_id == file_id {
            Some(&relation.target_file_id)
        } else if relation.target_file_id == file_id {
            Some(&relation.source_file_id)
        } else {
            None
        };
        adjacent_file_id
            .and_then(|id| file_by_id.get(id))
            .is_some_and(|file| file.role == "test")
    })
}

pub(super) fn build_relationship_impact_and_context(
    files: &[ScannedFile],
    relations: &[FileRelation],
    hotspots: &[Value],
    scan_root: &Path,
    explicit_changed_paths: Option<&[String]>,
    scan_run_id: &str,
    generated_at: &str,
) -> (Value, Value) {
    let file_by_id = files
        .iter()
        .map(|file| (file.id.clone(), file))
        .collect::<HashMap<_, _>>();
    let file_id_by_path = files
        .iter()
        .map(|file| (file.path.clone(), file.id.clone()))
        .collect::<HashMap<_, _>>();
    let changed_paths = explicit_changed_paths
        .map(|paths| {
            let mut paths = paths.to_vec();
            paths.sort();
            paths.dedup();
            paths
        })
        .unwrap_or_else(|| git_status_changed_paths(scan_root));
    let mut changed_file_ids = Vec::new();
    let mut unmapped_paths = Vec::new();
    for path in &changed_paths {
        if let Some(file_id) = file_id_by_path.get(path) {
            push_unique_id(&mut changed_file_ids, file_id);
        } else {
            unmapped_paths.push(path.clone());
        }
    }
    let changed_file_id_set = changed_file_ids.iter().cloned().collect::<HashSet<_>>();

    let mut directly_affected_ids = Vec::new();
    let mut directly_affected_set = HashSet::new();
    let mut provenance_relation_ids = Vec::new();
    for relation in relations {
        let touches_changed = changed_file_id_set.contains(&relation.source_file_id)
            || changed_file_id_set.contains(&relation.target_file_id);
        if !touches_changed {
            continue;
        }
        push_unique_id(&mut provenance_relation_ids, &relation.id);
        let adjacent = if changed_file_id_set.contains(&relation.source_file_id) {
            &relation.target_file_id
        } else {
            &relation.source_file_id
        };
        if !changed_file_id_set.contains(adjacent) && directly_affected_set.insert(adjacent.clone())
        {
            directly_affected_ids.push(adjacent.clone());
        }
    }

    let direct_set = directly_affected_ids
        .iter()
        .cloned()
        .collect::<HashSet<_>>();
    let mut transitive_affected_ids = Vec::new();
    let mut transitive_set = HashSet::new();
    for relation in relations {
        let touches_direct = direct_set.contains(&relation.source_file_id)
            || direct_set.contains(&relation.target_file_id);
        if !touches_direct {
            continue;
        }
        let adjacent = if direct_set.contains(&relation.source_file_id) {
            &relation.target_file_id
        } else {
            &relation.source_file_id
        };
        if changed_file_id_set.contains(adjacent) || direct_set.contains(adjacent) {
            continue;
        }
        if transitive_set.insert(adjacent.clone()) {
            transitive_affected_ids.push(adjacent.clone());
        }
    }

    let mut risk_flags = Vec::new();
    for path in &unmapped_paths {
        risk_flags.push(json!({
            "id": format!("risk-unmapped-{}", stable_hash(path)),
            "severity": "warning",
            "label": format!("Changed file is not present in latest relationship scan: {path}"),
            "fileId": path
        }));
    }
    for hotspot in hotspots {
        let Some(file_id) = hotspot.get("fileId").and_then(Value::as_str) else {
            continue;
        };
        if changed_file_id_set.contains(file_id) || direct_set.contains(file_id) {
            let label = file_by_id
                .get(file_id)
                .map(|file| {
                    format!(
                        "Hotspot participates in current change scope: {}",
                        file.path
                    )
                })
                .unwrap_or_else(|| {
                    format!("Hotspot participates in current change scope: {file_id}")
                });
            risk_flags.push(json!({
                "id": format!("risk-hotspot-{}", stable_hash(file_id)),
                "severity": "warning",
                "label": label,
                "fileId": file_id
            }));
        }
    }
    for file_id in &changed_file_ids {
        let Some(file) = file_by_id.get(file_id) else {
            continue;
        };
        if matches!(
            file.role.as_str(),
            "test" | "document" | "manifest" | "config" | "style"
        ) {
            continue;
        }
        if !file_has_test_relation(file_id, relations, &file_by_id) {
            risk_flags.push(json!({
                "id": format!("risk-missing-test-{}", stable_hash(file_id)),
                "severity": "info",
                "label": format!("No deterministic test relation found for changed file: {}", file.path),
                "fileId": file_id
            }));
        }
    }

    let mut must_read_ids = Vec::new();
    for file_id in &changed_file_ids {
        push_unique_id(&mut must_read_ids, file_id);
    }
    for hotspot in hotspots.iter().take(8) {
        if let Some(file_id) = hotspot.get("fileId").and_then(Value::as_str) {
            push_unique_id(&mut must_read_ids, file_id);
        }
    }
    if must_read_ids.is_empty() {
        for file in files
            .iter()
            .filter(|file| {
                matches!(
                    file.role.as_str(),
                    "controller" | "route" | "service" | "hook" | "component"
                )
            })
            .take(10)
        {
            push_unique_id(&mut must_read_ids, &file.id);
        }
    }

    let mut related_ids = Vec::new();
    for file_id in directly_affected_ids
        .iter()
        .chain(transitive_affected_ids.iter())
    {
        push_unique_id(&mut related_ids, file_id);
    }
    let mut test_target_ids = Vec::new();
    let mut contract_ids = Vec::new();
    let read_scope = must_read_ids
        .iter()
        .chain(related_ids.iter())
        .cloned()
        .collect::<HashSet<_>>();
    for relation in relations {
        if !(read_scope.contains(&relation.source_file_id)
            || read_scope.contains(&relation.target_file_id))
        {
            continue;
        }
        push_unique_id(&mut provenance_relation_ids, &relation.id);
        let source_file = file_by_id.get(&relation.source_file_id);
        let target_file = file_by_id.get(&relation.target_file_id);
        if relation.relation_type == "tested_by" {
            if source_file.is_some_and(|file| file.role == "test") {
                push_unique_id(&mut test_target_ids, &relation.source_file_id);
            }
            if target_file.is_some_and(|file| file.role == "test") {
                push_unique_id(&mut test_target_ids, &relation.target_file_id);
            }
        }
        if matches!(
            relation.relation_type.as_str(),
            "specified_by" | "documents" | "configures"
        ) {
            push_unique_id(&mut contract_ids, &relation.source_file_id);
            push_unique_id(&mut contract_ids, &relation.target_file_id);
        }
    }
    for file in files
        .iter()
        .filter(|file| matches!(file.role.as_str(), "manifest" | "config" | "document"))
        .take(12)
    {
        push_unique_id(&mut contract_ids, &file.id);
    }

    let impact = json!({
        "schemaVersion": 1,
        "generatedAt": generated_at,
        "inputFiles": changed_paths,
        "changedFiles": sorted_paths_for_ids(&changed_file_ids, &file_by_id, 40),
        "directlyAffectedFiles": sorted_paths_for_ids(&directly_affected_ids, &file_by_id, 80),
        "transitivelyAffectedFiles": sorted_paths_for_ids(&transitive_affected_ids, &file_by_id, 80),
        "unmappedFiles": unmapped_paths,
        "ignoredFiles": [],
        "riskFlags": risk_flags
    });
    let context_pack = json!({
        "schemaVersion": 1,
        "generatedAt": generated_at,
        "mustReadFiles": sorted_paths_for_ids(&must_read_ids, &file_by_id, 16),
        "relatedFiles": sorted_paths_for_ids(&related_ids, &file_by_id, 32),
        "testTargets": sorted_paths_for_ids(&test_target_ids, &file_by_id, 16),
        "contracts": sorted_paths_for_ids(&contract_ids, &file_by_id, 16),
        "riskFlags": impact.get("riskFlags").cloned().unwrap_or_else(|| json!([])),
        "provenance": {
            "scanRunId": scan_run_id,
            "relationIds": provenance_relation_ids.into_iter().take(80).collect::<Vec<_>>(),
            "fileIds": must_read_ids.into_iter().chain(related_ids).take(80).collect::<Vec<_>>()
        }
    });
    (impact, context_pack)
}

fn relationship_stale_reason(
    kind: &str,
    message: String,
    path: Option<String>,
    previous: Option<String>,
    current: Option<String>,
) -> Value {
    json!({
        "kind": kind,
        "message": message,
        "path": path,
        "previous": previous,
        "current": current
    })
}

pub(super) fn summarize_relationship_stale_state(
    scan_root: &Path,
    manifest: &Option<Value>,
    files_value: &Option<Value>,
) -> Value {
    let generated_at = chrono::Utc::now().to_rfc3339();
    let manifest_commit_hash = manifest
        .as_ref()
        .and_then(|value| value.get("gitCommitHash"))
        .and_then(Value::as_str)
        .map(str::to_string);
    let (_, current_commit_hash) = git_metadata(scan_root);
    let mut reasons = Vec::new();
    let mut scope_warnings = Vec::new();

    if let (Some(previous), Some(current)) = (&manifest_commit_hash, &current_commit_hash) {
        if previous != current {
            reasons.push(relationship_stale_reason(
                "git-commit-changed",
                "Workspace git HEAD differs from the latest relationship scan.".to_string(),
                None,
                Some(previous.clone()),
                Some(current.clone()),
            ));
        }
    }

    let scanned_files = files_value
        .clone()
        .and_then(|value| serde_json::from_value::<Vec<ScannedFile>>(value).ok())
        .unwrap_or_default();
    let file_by_path = scanned_files
        .iter()
        .map(|file| (file.path.clone(), file))
        .collect::<HashMap<_, _>>();
    let changed_paths = git_status_changed_paths(scan_root);
    let mut stale_paths = Vec::new();
    let mut unmapped_paths = Vec::new();

    for path in &changed_paths {
        let Some(file) = file_by_path.get(path) else {
            unmapped_paths.push(path.clone());
            scope_warnings.push(relationship_stale_reason(
                "scan-scope-warning",
                format!("Changed file is outside the latest relationship scan scope: {path}"),
                Some(path.clone()),
                None,
                None,
            ));
            continue;
        };

        let absolute_path = scan_root.join(path);
        match fs::read_to_string(&absolute_path) {
            Ok(content) => {
                let current_hash = content_hash(&content);
                if current_hash != file.content_hash {
                    stale_paths.push(path.clone());
                    reasons.push(relationship_stale_reason(
                        "fingerprint-changed",
                        format!("Scanned file fingerprint changed after latest relationship scan: {path}"),
                        Some(path.clone()),
                        Some(file.content_hash.clone()),
                        Some(current_hash),
                    ));
                }
            }
            Err(error) => {
                stale_paths.push(path.clone());
                reasons.push(relationship_stale_reason(
                    "file-read-failed",
                    format!("Changed file could not be read for stale detection: {path}: {error}"),
                    Some(path.clone()),
                    Some(file.content_hash.clone()),
                    None,
                ));
            }
        }
    }

    reasons.truncate(40);
    scope_warnings.truncate(20);
    let refresh_mode = if unmapped_paths.is_empty() && stale_paths.is_empty() {
        if reasons.is_empty() {
            "ignore-only"
        } else {
            "full"
        }
    } else if unmapped_paths.is_empty() {
        "partial"
    } else {
        "full"
    };
    let is_fresh = reasons.is_empty();
    let all_reasons = reasons
        .into_iter()
        .chain(scope_warnings)
        .collect::<Vec<_>>();

    json!({
        "schemaVersion": 1,
        "generatedAt": generated_at,
        "isFresh": is_fresh,
        "reasons": all_reasons,
        "staleFileCount": stale_paths.len(),
        "changedFiles": changed_paths,
        "refreshSuggestion": if is_fresh {
            Value::Null
        } else {
            json!({
                "mode": refresh_mode,
                "changedFiles": stale_paths.into_iter().chain(unmapped_paths).take(80).collect::<Vec<_>>(),
                "reason": "Latest relationship snapshot is older than current workspace facts."
            })
        }
    })
}

pub(super) fn enrich_context_pack_with_stale_state(
    context_pack: Option<Value>,
    stale_summary: &Option<Value>,
) -> Option<Value> {
    let Some(mut context_pack) = context_pack else {
        return None;
    };
    let Some(stale) = stale_summary else {
        return Some(context_pack);
    };
    let Some(is_fresh) = stale.get("isFresh").and_then(Value::as_bool) else {
        return Some(context_pack);
    };
    if is_fresh {
        return Some(context_pack);
    }
    let Some(object) = context_pack.as_object_mut() else {
        return Some(context_pack);
    };
    let stale_reason = stale
        .get("reasons")
        .and_then(Value::as_array)
        .and_then(|reasons| reasons.first())
        .and_then(|reason| reason.get("message"))
        .and_then(Value::as_str)
        .unwrap_or("Project Map relationship context is stale. Refresh before broad agent work.");
    object.insert(
        "staleReason".to_string(),
        Value::String(stale_reason.to_string()),
    );
    object.insert(
        "staleReasons".to_string(),
        stale
            .get("reasons")
            .cloned()
            .unwrap_or_else(|| Value::Array(Vec::new())),
    );
    Some(context_pack)
}

pub(super) fn enrich_context_pack_with_api_contracts(
    mut context_pack: Value,
    api_contracts: &Value,
) -> Value {
    let Some(object) = context_pack.as_object_mut() else {
        return context_pack;
    };
    let endpoints = api_contracts
        .get("endpoints")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    let groups = api_contracts
        .get("groups")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    let call_chains = api_contracts
        .get("callChains")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    if endpoints.is_empty() && groups.is_empty() {
        return context_pack;
    }

    let group_summaries = groups
        .iter()
        .take(48)
        .map(|group| json!({
            "id": group.get("id").cloned().unwrap_or(Value::Null),
            "label": group.get("label").cloned().unwrap_or(Value::Null),
            "level": group.get("level").cloned().unwrap_or(Value::Null),
            "endpointIds": group.get("endpointIds").cloned().unwrap_or_else(|| Value::Array(Vec::new())),
            "confidenceCounts": group.get("confidenceCounts").cloned().unwrap_or(Value::Null),
            "provenance": {
                "artifact": "api-contracts/groups.json"
            }
        }))
        .collect::<Vec<_>>();
    let endpoint_summaries = endpoints
        .iter()
        .take(80)
        .map(|endpoint| json!({
            "id": endpoint.get("id").cloned().unwrap_or(Value::Null),
            "protocol": endpoint.get("protocol").cloned().unwrap_or(Value::Null),
            "method": endpoint.get("method").cloned().unwrap_or(Value::Null),
            "path": endpoint.get("path").cloned().unwrap_or(Value::Null),
            "operationName": endpoint.get("operationName").cloned().unwrap_or(Value::Null),
            "framework": endpoint.get("framework").cloned().unwrap_or(Value::Null),
            "handlerSymbol": endpoint.get("handlerSymbol").cloned().unwrap_or(Value::Null),
            "sourceFile": endpoint.get("sourceFile").cloned().unwrap_or(Value::Null),
            "groupIds": endpoint.get("groupIds").cloned().unwrap_or_else(|| Value::Array(Vec::new())),
            "callChainIds": endpoint.get("callChainIds").cloned().unwrap_or_else(|| Value::Array(Vec::new())),
            "confidence": endpoint.get("confidence").cloned().unwrap_or(Value::Null),
            "evidence": endpoint.get("evidence").cloned().unwrap_or_else(|| Value::Array(Vec::new())),
            "provenance": {
                "artifact": "api-contracts/endpoints.json"
            }
        }))
        .collect::<Vec<_>>();
    let chain_summaries = call_chains
        .iter()
        .take(40)
        .map(|chain| {
            json!({
                "id": chain.get("id").cloned().unwrap_or(Value::Null),
                "endpointId": chain.get("endpointId").cloned().unwrap_or(Value::Null),
                "edges": chain.get("edges").cloned().unwrap_or_else(|| Value::Array(Vec::new())),
                "truncatedReason": chain.get("truncatedReason").cloned().unwrap_or(Value::Null),
                "provenance": {
                    "artifact": "api-contracts/chains.json"
                }
            })
        })
        .collect::<Vec<_>>();

    object.insert(
        "apiContracts".to_string(),
        json!({
            "schemaVersion": 1,
            "source": "project-map-api-contract-artifacts",
            "mode": "grouped-evidence",
            "flatteningPolicy": "preserve-api-hierarchy-do-not-create-root-semantic-node-per-endpoint",
            "endpointCount": endpoints.len(),
            "groupCount": groups.len(),
            "chainCount": call_chains.len(),
            "groups": group_summaries,
            "endpointSummaries": endpoint_summaries,
            "methodChains": chain_summaries,
            "provenance": {
                "artifact": "api-contracts/latest.json",
                "scanRunId": api_contracts.get("scanRunId").cloned().unwrap_or(Value::Null),
                "storageKey": api_contracts.get("storageKey").cloned().unwrap_or(Value::Null)
            }
        }),
    );
    context_pack
}
