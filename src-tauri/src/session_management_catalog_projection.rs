fn build_claude_catalog_entry_from_fact(
    fact: engine::claude_history::ClaudeSessionSourceFact,
    owner_workspace: &WorkspaceEntry,
    owner_metadata: &WorkspaceSessionCatalogMetadata,
) -> WorkspaceSessionCatalogEntry {
    let session_id = format!("claude:{}", fact.canonical_session_id);
    WorkspaceSessionCatalogEntry {
        archived_at: archived_at_for_session(owner_metadata, &owner_workspace.id, &session_id),
        session_id,
        stable_session_key: None,
        canonical_session_id: Some(fact.canonical_session_id),
        parent_session_id: fact
            .parent_session_id
            .as_ref()
            .map(|parent_session_id| format!("claude:{parent_session_id}")),
        workspace_id: owner_workspace.id.clone(),
        workspace_label: Some(owner_workspace.name.clone()),
        engine: "claude".to_string(),
        title: fact
            .first_real_user_message
            .unwrap_or_else(|| "Claude Session".to_string()),
        updated_at: fact.updated_at.max(0),
        thread_kind: "native".to_string(),
        source: None,
        source_label: None,
        source_completeness: Some(if fact.source_health.eq_ignore_ascii_case("partial") {
            WorkspaceSessionSourceCompleteness::Partial
        } else {
            WorkspaceSessionSourceCompleteness::Complete
        }),
        source_status_reason: if fact.source_health.eq_ignore_ascii_case("partial") {
            Some("claude-source-diagnostics".to_string())
        } else {
            None
        },
        size_bytes: fact.file_size_bytes,
        cwd: fact.cwd,
        attribution_status: fact.attribution_status,
        attribution_reason: fact.attribution_reason,
        attribution_confidence: None,
        matched_workspace_id: Some(owner_workspace.id.clone()),
        matched_workspace_label: Some(owner_workspace.name.clone()),
        folder_id: None,
        auto_session: None,
        exists_on_disk: false,
        inconsistency_code: None,
        delete_mode: None,
        physical_path: Some(fact.physical_path),
        children_count: None,
    }
}

fn build_catalog_page(
    entries: Vec<WorkspaceSessionCatalogEntry>,
    query: WorkspaceSessionCatalogQuery,
    cursor: Option<String>,
    limit: Option<u32>,
    partial_source: Option<String>,
    source_statuses: Vec<WorkspaceSessionCatalogSourceStatus>,
) -> WorkspaceSessionCatalogPage {
    let source_statuses = normalize_source_statuses(source_statuses);
    let cursor_state = parse_catalog_cursor_state(cursor.as_deref());
    let status_filter = parse_status_filter(query.status.as_deref());
    let keyword = query
        .keyword
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(|value| value.to_lowercase());
    let engine_filter = query
        .engine
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(|value| value.to_lowercase());
    let folder_filter = normalize_query_folder_filter(&query);

    let filtered: Vec<WorkspaceSessionCatalogEntry> = entries
        .into_iter()
        .filter(|entry| !entry_is_hidden_automatic_session(entry))
        .filter(|entry| {
            entry_matches_engine_and_keyword(entry, engine_filter.as_deref(), keyword.as_deref())
                && entry_matches_status(entry, status_filter)
        })
        .collect();
    let mut filtered = filter_catalog_entries_by_folder(filtered, folder_filter.as_deref());

    filtered.sort_by(|left, right| {
        right
            .updated_at
            .cmp(&left.updated_at)
            .then_with(|| left.session_id.cmp(&right.session_id))
            .then_with(|| left.workspace_id.cmp(&right.workspace_id))
            .then_with(|| catalog_entry_sort_key(left).cmp(&catalog_entry_sort_key(right)))
    });

    let requested_limit = limit.map(|value| value as usize);
    let limit_capped = matches!(limit, Some(value) if value > SESSION_CATALOG_MAX_LIMIT as u32);
    let effective_limit = normalize_catalog_page_limit(limit);
    let offset = catalog_page_start_index(&filtered, &query, cursor_state);
    let data: Vec<WorkspaceSessionCatalogEntry> = filtered
        .iter()
        .skip(offset)
        .take(effective_limit)
        .cloned()
        .map(|entry| decorate_catalog_entry_for_response(entry, &source_statuses))
        .collect();
    let next_cursor = if offset + data.len() < filtered.len() {
        data.last()
            .map(|entry| build_catalog_stable_cursor(entry, &query, offset + data.len()))
    } else {
        None
    };

    WorkspaceSessionCatalogPage {
        data,
        next_cursor,
        requested_limit,
        effective_limit,
        limit_capped,
        partial_source,
        source_statuses,
    }
}

fn catalog_entry_sort_key(entry: &WorkspaceSessionCatalogEntry) -> String {
    entry
        .stable_session_key
        .clone()
        .unwrap_or_else(|| build_catalog_entry_stable_key(entry))
}

fn catalog_entry_is_after_stable_cursor(
    entry: &WorkspaceSessionCatalogEntry,
    cursor: &SessionCatalogStableCursor,
) -> bool {
    if entry.updated_at != cursor.updated_at {
        return entry.updated_at < cursor.updated_at;
    }
    if entry.session_id.as_str() != cursor.session_id.as_str() {
        return entry.session_id.as_str() > cursor.session_id.as_str();
    }
    if entry.workspace_id.as_str() != cursor.workspace_id.as_str() {
        return entry.workspace_id.as_str() > cursor.workspace_id.as_str();
    }
    let entry_stable_key = catalog_entry_sort_key(entry);
    let cursor_stable_key = cursor.stable_session_key.as_deref().unwrap_or("");
    entry_stable_key.as_str() > cursor_stable_key
}

fn catalog_page_start_index(
    filtered: &[WorkspaceSessionCatalogEntry],
    query: &WorkspaceSessionCatalogQuery,
    cursor: SessionCatalogCursor,
) -> usize {
    match cursor {
        SessionCatalogCursor::LegacyOffset(offset) => offset.min(filtered.len()),
        SessionCatalogCursor::Stable(payload) => {
            if payload.query_fingerprint != catalog_query_fingerprint(query) {
                return 0;
            }
            filtered
                .iter()
                .position(|entry| catalog_entry_is_after_stable_cursor(entry, &payload))
                .unwrap_or(filtered.len())
        }
    }
}

async fn build_workspace_scope_catalog_data(
    workspaces: &Mutex<HashMap<String, WorkspaceEntry>>,
    engine_manager: &engine::EngineManager,
    storage_path: &Path,
    workspace_id: &str,
    scan_mode: SessionCatalogScanMode,
    attribution_mode: WorkspaceSessionAttributionMode,
) -> Result<WorkspaceScopeCatalogData, String> {
    let workspace_scope = catalog_workspace_scope(workspaces, workspace_id).await?;
    let workspaces_snapshot = workspaces.lock().await.clone();
    let metadata_by_workspace_id = read_catalog_metadata_for_scope(storage_path, &workspace_scope)?;
    let mut partial_sources = Vec::new();
    let mut source_statuses = Vec::new();
    let mut entries = Vec::new();
    let scope_kind = workspace_scope
        .first()
        .map(|workspace| {
            if workspace.kind.is_worktree() {
                WorkspaceSessionProjectionScopeKind::Worktree
            } else {
                WorkspaceSessionProjectionScopeKind::Project
            }
        })
        .unwrap_or(WorkspaceSessionProjectionScopeKind::Project);
    let owner_workspace_ids = workspace_scope
        .iter()
        .map(|workspace| workspace.id.clone())
        .collect::<Vec<_>>();

    let gemini_config = engine_manager
        .get_engine_config(engine::EngineType::Gemini)
        .await;
    let claude_config = engine_manager
        .get_engine_config(engine::EngineType::Claude)
        .await;
    let claude_source_fact_cache_dir = source_fact_cache_dir(storage_path, "claude").ok();
    for workspace in &workspace_scope {
        let owner_workspace_id = workspace.id.clone();
        let owner_workspace_path = PathBuf::from(&workspace.path);
        let owner_metadata = metadata_by_workspace_id
            .get(&owner_workspace_id)
            .cloned()
            .unwrap_or_default();

        match local_usage::list_codex_session_summaries_for_workspace(
            workspaces,
            &owner_workspace_id,
            scan_mode.limit(),
        )
        .await
        {
            Ok((_, sessions)) => {
                source_statuses.push(build_success_source_status(
                    "codex",
                    sessions.len(),
                    scan_mode,
                    WorkspaceSessionSourceCompleteness::AuthoritativeEmpty,
                    None,
                ));
                entries.extend(sessions.into_iter().map(|summary| {
                    let session_id = summary.session_id.clone();
                    let archived_at =
                        archived_at_for_session(&owner_metadata, &owner_workspace_id, &session_id);
                    let source_label =
                        build_source_label(summary.source.as_deref(), summary.provider.as_deref());
                    let entry = WorkspaceSessionCatalogEntry {
                        session_id,
                        stable_session_key: None,
                        canonical_session_id: Some(summary.session_id.clone()),
                        parent_session_id: None,
                        workspace_id: owner_workspace_id.clone(),
                        workspace_label: Some(workspace.name.clone()),
                        engine: "codex".to_string(),
                        title: summary
                            .summary
                            .unwrap_or_else(|| "Codex Session".to_string()),
                        updated_at: summary.timestamp.max(0),
                        archived_at,
                        thread_kind: "native".to_string(),
                        source: summary.source,
                        source_label,
                        source_completeness: None,
                        source_status_reason: None,
                        size_bytes: summary.file_size_bytes,
                        cwd: summary.cwd,
                        attribution_status: Some(
                            SessionCatalogAttributionStatus::StrictMatch
                                .as_str()
                                .to_string(),
                        ),
                        attribution_reason: None,
                        attribution_confidence: None,
                        matched_workspace_id: Some(owner_workspace_id.clone()),
                        matched_workspace_label: Some(workspace.name.clone()),
                        folder_id: None,
                        auto_session: None,
                        exists_on_disk: false,
                        inconsistency_code: None,
                        delete_mode: None,
                        physical_path: None,
                        children_count: None,
                    };
                    finalize_existing_catalog_entry(entry, &metadata_by_workspace_id)
                }));
            }
            Err(error) => {
                log::warn!(
                    "[session_management.list_workspace_sessions] codex history unavailable for workspace {}: {}",
                    owner_workspace_id,
                    error
                );
                partial_sources.push(SESSION_CATALOG_PARTIAL_CODEX.to_string());
                source_statuses.push(build_degraded_source_status(
                    "codex",
                    SESSION_CATALOG_PARTIAL_CODEX,
                ));
            }
        }

        let claude_source_facts_result = match attribution_mode {
            WorkspaceSessionAttributionMode::Related => {
                engine::claude_history::list_claude_session_source_facts_for_attribution_scopes_with_config(
                    &owner_workspace_path,
                    build_claude_attribution_scopes(workspace),
                    Some(scan_mode.limit()),
                    claude_config.as_ref(),
                    claude_source_fact_cache_dir.as_deref(),
                )
                .await
            }
            WorkspaceSessionAttributionMode::WorkspaceOnly => {
                engine::claude_history::list_workspace_only_claude_session_source_facts_for_attribution_scopes_with_config(
                    &owner_workspace_path,
                    build_claude_attribution_scopes(workspace),
                    Some(scan_mode.limit()),
                    claude_config.as_ref(),
                    claude_source_fact_cache_dir.as_deref(),
                )
                .await
            }
        };

        match claude_source_facts_result {
            Ok(claude_source_facts) => {
                let claude_session_count = claude_source_facts.facts.len();
                if claude_session_count == 0 {
                    partial_sources
                        .push(SESSION_CATALOG_PARTIAL_CLAUDE_UNCERTAIN_EMPTY.to_string());
                }
                let mut unresolved_diagnostics = Vec::new();
                let claude_entries = claude_source_facts
                    .facts
                    .iter()
                    .cloned()
                    .filter_map(|fact| {
                        let mut entry =
                            build_claude_catalog_entry_from_fact(fact, workspace, &owner_metadata);
                        entry = apply_strict_attribution_owner(
                            entry,
                            &workspaces_snapshot,
                            &metadata_by_workspace_id,
                        );
                        if entry.attribution_status.as_deref()
                            == Some(SessionCatalogAttributionStatus::Unassigned.as_str())
                        {
                            unresolved_diagnostics
                                .push(unresolved_catalog_entry_to_diagnostic(&entry));
                            return None;
                        }
                        if !owner_workspace_ids.contains(&entry.workspace_id) {
                            return None;
                        }
                        Some(finalize_existing_catalog_entry(
                            entry,
                            &metadata_by_workspace_id,
                        ))
                    })
                    .collect::<Vec<_>>();
                source_statuses.push(build_claude_source_fact_status(
                    &claude_source_facts,
                    scan_mode,
                    unresolved_diagnostics,
                ));
                entries.extend(claude_entries);
            }
            Err(error) => {
                log::warn!(
                    "[session_management.list_workspace_sessions] claude history unavailable for workspace {}: {}",
                    owner_workspace_id,
                    error
                );
                partial_sources.push(SESSION_CATALOG_PARTIAL_CLAUDE.to_string());
                source_statuses.push(build_degraded_source_status(
                    "claude",
                    SESSION_CATALOG_PARTIAL_CLAUDE,
                ));
            }
        }

        match engine::gemini_history::list_gemini_sessions(
            &owner_workspace_path,
            Some(scan_mode.limit()),
            gemini_config
                .as_ref()
                .and_then(|item| item.home_dir.as_deref()),
        )
        .await
        {
            Ok(gemini_sessions) => {
                source_statuses.push(build_success_source_status(
                    "gemini",
                    gemini_sessions.len(),
                    scan_mode,
                    WorkspaceSessionSourceCompleteness::AuthoritativeEmpty,
                    None,
                ));
                entries.extend(gemini_sessions.into_iter().map(|session| {
                    let session_id = format!("gemini:{}", session.session_id);
                    let entry = WorkspaceSessionCatalogEntry {
                        archived_at: archived_at_for_session(
                            &owner_metadata,
                            &owner_workspace_id,
                            &session_id,
                        ),
                        session_id,
                        stable_session_key: None,
                        canonical_session_id: Some(session.session_id.clone()),
                        parent_session_id: None,
                        workspace_id: owner_workspace_id.clone(),
                        workspace_label: Some(workspace.name.clone()),
                        engine: "gemini".to_string(),
                        title: session.first_message,
                        updated_at: session.updated_at.max(0),
                        thread_kind: "native".to_string(),
                        source: None,
                        source_label: None,
                        source_completeness: None,
                        source_status_reason: None,
                        size_bytes: session.file_size_bytes,
                        cwd: None,
                        attribution_status: Some(
                            SessionCatalogAttributionStatus::StrictMatch
                                .as_str()
                                .to_string(),
                        ),
                        attribution_reason: None,
                        attribution_confidence: None,
                        matched_workspace_id: Some(owner_workspace_id.clone()),
                        matched_workspace_label: Some(workspace.name.clone()),
                        folder_id: None,
                        auto_session: None,
                        exists_on_disk: false,
                        inconsistency_code: None,
                        delete_mode: None,
                        physical_path: None,
                        children_count: None,
                    };
                    finalize_existing_catalog_entry(entry, &metadata_by_workspace_id)
                }));
            }
            Err(error) => {
                log::warn!(
                    "[session_management.list_workspace_sessions] gemini history unavailable for workspace {}: {}",
                    owner_workspace_id,
                    error
                );
                partial_sources.push(SESSION_CATALOG_PARTIAL_GEMINI.to_string());
                source_statuses.push(build_degraded_source_status(
                    "gemini",
                    SESSION_CATALOG_PARTIAL_GEMINI,
                ));
            }
        }

        let opencode_disabled = engine_manager
            .get_engine_status(engine::EngineType::OpenCode)
            .await
            .is_some_and(|status| {
                status.error.as_deref() == Some(engine::OPENCODE_DISABLED_DIAGNOSTIC)
            });
        if opencode_disabled {
            source_statuses.push(build_success_source_status(
                "opencode",
                0,
                scan_mode,
                WorkspaceSessionSourceCompleteness::AuthoritativeEmpty,
                None,
            ));
            continue;
        }

        match engine::commands::opencode_session_list_core(
            workspaces,
            engine_manager,
            &owner_workspace_id,
        )
        .await
        {
            Ok(opencode_sessions) => {
                source_statuses.push(build_success_source_status(
                    "opencode",
                    opencode_sessions.len(),
                    scan_mode,
                    WorkspaceSessionSourceCompleteness::AuthoritativeEmpty,
                    None,
                ));
                entries.extend(opencode_sessions.into_iter().map(|session| {
                    let session_id = format!("opencode:{}", session.session_id);
                    let entry = WorkspaceSessionCatalogEntry {
                        archived_at: archived_at_for_session(
                            &owner_metadata,
                            &owner_workspace_id,
                            &session_id,
                        ),
                        session_id,
                        stable_session_key: None,
                        canonical_session_id: Some(session.session_id.clone()),
                        parent_session_id: None,
                        workspace_id: owner_workspace_id.clone(),
                        workspace_label: Some(workspace.name.clone()),
                        engine: "opencode".to_string(),
                        title: session.title,
                        updated_at: session.updated_at.unwrap_or(0).max(0),
                        thread_kind: "native".to_string(),
                        source: None,
                        source_label: None,
                        source_completeness: None,
                        source_status_reason: None,
                        size_bytes: None,
                        cwd: None,
                        attribution_status: Some(
                            SessionCatalogAttributionStatus::StrictMatch
                                .as_str()
                                .to_string(),
                        ),
                        attribution_reason: None,
                        attribution_confidence: None,
                        matched_workspace_id: Some(owner_workspace_id.clone()),
                        matched_workspace_label: Some(workspace.name.clone()),
                        folder_id: None,
                        auto_session: None,
                        exists_on_disk: false,
                        inconsistency_code: None,
                        delete_mode: None,
                        physical_path: None,
                        children_count: None,
                    };
                    finalize_existing_catalog_entry(entry, &metadata_by_workspace_id)
                }));
            }
            Err(error) => {
                if error.contains("OpenCode CLI not found")
                    || error.contains(engine::OPENCODE_DISABLED_DIAGNOSTIC)
                {
                    source_statuses.push(build_success_source_status(
                        "opencode",
                        0,
                        scan_mode,
                        WorkspaceSessionSourceCompleteness::AuthoritativeEmpty,
                        None,
                    ));
                    continue;
                }
                log::warn!(
                    "[session_management.list_workspace_sessions] opencode history unavailable for workspace {}: {}",
                    owner_workspace_id,
                    error
                );
                partial_sources.push(SESSION_CATALOG_PARTIAL_OPENCODE.to_string());
                source_statuses.push(build_degraded_source_status(
                    "opencode",
                    SESSION_CATALOG_PARTIAL_OPENCODE,
                ));
            }
        }
    }

    let source_statuses = normalize_source_statuses(source_statuses);
    push_orphan_entries_for_scope(
        &mut entries,
        &workspace_scope,
        &metadata_by_workspace_id,
        &source_statuses,
    );
    apply_children_counts(&mut entries);

    let mut deduped = Vec::new();
    let mut seen_ids = HashSet::new();
    for entry in entries {
        if !seen_ids.insert(build_catalog_entry_dedupe_key(&entry)) {
            continue;
        }
        deduped.push(entry);
    }

    Ok(WorkspaceScopeCatalogData {
        scope_kind,
        owner_workspace_ids,
        entries: deduped,
        partial_sources: normalize_partial_sources(partial_sources),
        source_statuses,
    })
}
