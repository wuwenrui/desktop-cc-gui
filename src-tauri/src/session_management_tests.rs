    #[test]
    fn parses_prefixed_and_stable_cursor() {
        assert_eq!(parse_catalog_cursor(Some("offset:25")), 25);
        assert_eq!(parse_catalog_cursor(Some("bad")), 0);

        let mut entry = catalog_entry("codex:session-anchor", "ws-1", Some("Project"), None);
        entry.updated_at = 1_234;
        entry.stable_session_key = Some("codex:ws-1:codex:session-anchor".to_string());
        let query = WorkspaceSessionCatalogQuery {
            engine: Some(" codex ".to_string()),
            status: Some("active".to_string()),
            ..Default::default()
        };
        let cursor = build_catalog_stable_cursor(&entry, &query, 25);

        assert!(cursor.starts_with(SESSION_CATALOG_STABLE_CURSOR_PREFIX));
        assert_eq!(parse_catalog_cursor(Some(&cursor)), 25);
        match parse_catalog_cursor_state(Some(&cursor)) {
            SessionCatalogCursor::Stable(payload) => {
                assert_eq!(payload.version, 1);
                assert_eq!(payload.updated_at, 1_234);
                assert_eq!(payload.session_id, "codex:session-anchor");
                assert_eq!(payload.workspace_id, "ws-1");
                assert_eq!(payload.offset_hint, 25);
                assert_eq!(payload.query_fingerprint, catalog_query_fingerprint(&query));
            }
            SessionCatalogCursor::LegacyOffset(_) => panic!("expected stable cursor"),
        }
    }
    #[test]
    fn catalog_scan_limit_uses_requested_page_window_plus_lookahead() {
        assert_eq!(build_catalog_scan_limit(None, Some(25)), 26);
        assert_eq!(build_catalog_scan_limit(Some("offset:50"), Some(25)), 76);
        assert_eq!(build_catalog_scan_limit(Some("offset:50"), None), 101);
        assert_eq!(
            build_catalog_scan_limit(Some("offset:50"), Some(10_000)),
            10_050
        );
    }

    #[test]
    fn catalog_page_preserves_next_cursor_from_scan_lookahead_entry() {
        let entries = (0..26)
            .map(|index| {
                let mut entry = catalog_entry(
                    &format!("codex:session-{index:02}"),
                    "ws-1",
                    Some("Project"),
                    None,
                );
                entry.updated_at = 1_000 - i64::from(index);
                entry
            })
            .collect();

        let page = build_catalog_page(
            entries,
            WorkspaceSessionCatalogQuery::default(),
            None,
            Some(25),
            Some(SESSION_CATALOG_PARTIAL_CODEX.to_string()),
            vec![WorkspaceSessionCatalogSourceStatus {
                engine: "codex".to_string(),
                source_kind: None,
            completeness: WorkspaceSessionSourceCompleteness::Complete,
                reason: None,
                scanned_candidates: Some(26),
                skipped_candidates: None,
                scan_cap_reached: Some(true),
                diagnostics: Vec::new(),
                cache: None,
            }],
        );

        assert_eq!(page.data.len(), 25);
        assert!(page
            .next_cursor
            .as_deref()
            .is_some_and(|cursor| cursor.starts_with(SESSION_CATALOG_STABLE_CURSOR_PREFIX)));
        assert_eq!(page.requested_limit, Some(25));
        assert_eq!(page.effective_limit, 25);
        assert!(!page.limit_capped);
        assert_eq!(
            page.partial_source,
            Some(SESSION_CATALOG_PARTIAL_CODEX.to_string())
        );
        assert_eq!(
            page.source_statuses[0].completeness,
            WorkspaceSessionSourceCompleteness::Partial
        );
        assert_eq!(
            page.source_statuses[0].reason.as_deref(),
            Some("codex-scan-cap-reached")
        );
        assert_eq!(
            page.data[0].stable_session_key.as_deref(),
            Some("codex:ws-1:codex:session-00")
        );
    }

    #[test]
    fn stable_catalog_cursor_survives_newer_entry_insertion() {
        let initial_entries = [300, 200, 100]
            .into_iter()
            .enumerate()
            .map(|(index, updated_at)| {
                let mut entry = catalog_entry(
                    &format!("codex:session-{index}"),
                    "ws-1",
                    Some("Project"),
                    None,
                );
                entry.updated_at = updated_at;
                entry
            })
            .collect();
        let first_page = build_catalog_page(
            initial_entries,
            WorkspaceSessionCatalogQuery::default(),
            None,
            Some(2),
            None,
            Vec::new(),
        );
        let cursor = first_page.next_cursor.clone().expect("next cursor");

        let entries_after_insertion = [400, 300, 200, 100]
            .into_iter()
            .enumerate()
            .map(|(index, updated_at)| {
                let session_number = if index == 0 { 99 } else { index - 1 };
                let mut entry = catalog_entry(
                    &format!("codex:session-{session_number}"),
                    "ws-1",
                    Some("Project"),
                    None,
                );
                entry.updated_at = updated_at;
                entry
            })
            .collect();
        let second_page = build_catalog_page(
            entries_after_insertion,
            WorkspaceSessionCatalogQuery::default(),
            Some(cursor),
            Some(2),
            None,
            Vec::new(),
        );

        assert_eq!(first_page.data[0].session_id, "codex:session-0");
        assert_eq!(first_page.data[1].session_id, "codex:session-1");
        assert_eq!(second_page.data.len(), 1);
        assert_eq!(second_page.data[0].session_id, "codex:session-2");
    }

    #[test]
    fn stable_catalog_cursor_restarts_when_filter_context_changes() {
        let mut anchor = catalog_entry("codex:session-1", "ws-1", Some("Project"), None);
        anchor.updated_at = 200;
        let cursor = build_catalog_stable_cursor(
            &decorate_catalog_entry_for_response(anchor, &[]),
            &WorkspaceSessionCatalogQuery {
                engine: Some("codex".to_string()),
                ..Default::default()
            },
            1,
        );
        let mut codex_entry = catalog_entry("codex:session-1", "ws-1", Some("Project"), None);
        codex_entry.updated_at = 200;
        let mut claude_entry = catalog_entry("claude:session-1", "ws-1", Some("Project"), None);
        claude_entry.engine = "claude".to_string();
        claude_entry.updated_at = 100;

        let page = build_catalog_page(
            vec![codex_entry, claude_entry],
            WorkspaceSessionCatalogQuery {
                engine: Some("claude".to_string()),
                ..Default::default()
            },
            Some(cursor),
            Some(1),
            None,
            Vec::new(),
        );

        assert_eq!(page.data.len(), 1);
        assert_eq!(page.data[0].session_id, "claude:session-1");
    }

    #[test]
    fn success_source_status_treats_capped_non_empty_scan_as_partial() {
        let status = build_success_source_status(
            "opencode",
            25,
            SessionCatalogScanMode::Bounded(25),
            WorkspaceSessionSourceCompleteness::AuthoritativeEmpty,
            None,
        );

        assert_eq!(
            status.completeness,
            WorkspaceSessionSourceCompleteness::Partial
        );
        assert_eq!(status.reason.as_deref(), Some("opencode-scan-cap-reached"));
        assert_eq!(status.scan_cap_reached, Some(true));
    }

    #[test]
    fn source_status_normalization_preserves_incomplete_claude_evidence() {
        let statuses = normalize_source_statuses(vec![
            WorkspaceSessionCatalogSourceStatus {
                engine: "codex".to_string(),
                source_kind: None,
            completeness: WorkspaceSessionSourceCompleteness::Complete,
                reason: None,
                scanned_candidates: Some(10),
                skipped_candidates: None,
                scan_cap_reached: Some(false),
                diagnostics: Vec::new(),
                cache: None,
            },
            WorkspaceSessionCatalogSourceStatus {
                engine: "claude".to_string(),
                source_kind: None,
            completeness: WorkspaceSessionSourceCompleteness::Complete,
                reason: None,
                scanned_candidates: Some(2),
                skipped_candidates: None,
                scan_cap_reached: Some(false),
                diagnostics: Vec::new(),
                cache: None,
            },
            WorkspaceSessionCatalogSourceStatus {
                engine: "claude".to_string(),
                source_kind: None,
            completeness: WorkspaceSessionSourceCompleteness::UncertainEmpty,
                reason: Some(SESSION_CATALOG_PARTIAL_CLAUDE_UNCERTAIN_EMPTY.to_string()),
                scanned_candidates: Some(0),
                skipped_candidates: None,
                scan_cap_reached: Some(false),
                diagnostics: Vec::new(),
                cache: None,
            },
        ]);

        let claude_status = statuses
            .iter()
            .find(|status| status.engine == "claude")
            .expect("claude status");
        let codex_status = statuses
            .iter()
            .find(|status| status.engine == "codex")
            .expect("codex status");

        assert_eq!(
            claude_status.completeness,
            WorkspaceSessionSourceCompleteness::UncertainEmpty
        );
        assert_eq!(
            claude_status.reason.as_deref(),
            Some(SESSION_CATALOG_PARTIAL_CLAUDE_UNCERTAIN_EMPTY)
        );
        assert_eq!(
            codex_status.completeness,
            WorkspaceSessionSourceCompleteness::Complete
        );
    }

    #[test]
    fn active_keyword_and_archived_queries_require_exhaustive_scan() {
        assert!(!query_requires_exhaustive_scan(
            &WorkspaceSessionCatalogQuery::default()
        ));
        assert!(query_requires_exhaustive_scan(
            &WorkspaceSessionCatalogQuery {
                keyword: Some("needle".to_string()),
                engine: None,
                status: Some("all".to_string()),
                folder_id: None,
                ..Default::default()
            }
        ));
        assert!(query_requires_exhaustive_scan(
            &WorkspaceSessionCatalogQuery {
                keyword: None,
                engine: None,
                status: Some("archived".to_string()),
                folder_id: None,
                ..Default::default()
            }
        ));
        assert!(query_requires_exhaustive_scan(
            &WorkspaceSessionCatalogQuery {
                keyword: None,
                engine: None,
                status: Some("active".to_string()),
                folder_id: Some("folder-a".to_string()),
                ..Default::default()
            }
        ));
        assert!(!query_requires_exhaustive_scan(
            &WorkspaceSessionCatalogQuery {
                keyword: None,
                engine: None,
                status: Some("all".to_string()),
                folder_id: None,
                ..Default::default()
            }
        ));
    }

    #[test]
    fn normalize_session_ids_rejects_invalid_path_like_values() {
        let error = normalize_session_ids(vec!["../escape".to_string()])
            .expect_err("path traversal session ids must be rejected");
        assert_eq!(error, "invalid session_id");

        let error = normalize_session_ids(vec!["claude:folder/session".to_string()])
            .expect_err("slash-containing session ids must be rejected");
        assert_eq!(error, "invalid session_id");

        let error = normalize_session_ids(vec![".".to_string()])
            .expect_err("current-directory session ids must be rejected");
        assert_eq!(error, "invalid session_id");
    }

    #[test]
    fn parses_catalog_identity_by_engine_prefix() {
        assert_eq!(
            parse_catalog_identity("claude:abc"),
            SessionCatalogIdentity::Claude {
                session_id: "abc".to_string()
            }
        );
        assert_eq!(
            parse_catalog_identity("plain-codex-id"),
            SessionCatalogIdentity::Codex {
                session_id: "plain-codex-id".to_string()
            }
        );
    }

    #[test]
    fn writes_and_reads_catalog_metadata_roundtrip() {
        let base = std::env::temp_dir().join(format!("session-catalog-{}", Uuid::new_v4()));
        std::fs::create_dir_all(&base).expect("create temp dir");
        let storage_path = base.join("workspaces.json");
        std::fs::write(&storage_path, "[]").expect("seed storage path");

        let metadata = WorkspaceSessionCatalogMetadata {
            archived_at_by_session_id: HashMap::from([("claude:1".to_string(), 42_i64)]),
            ..Default::default()
        };

        with_catalog_metadata_mutation(&storage_path, "ws-1", |stored| {
            *stored = metadata;
            Ok(())
        })
        .expect("write metadata");
        let loaded = read_catalog_metadata(&storage_path, "ws-1").expect("read metadata");
        assert_eq!(
            loaded.archived_at_by_session_id.get("claude:1").copied(),
            Some(42)
        );

        std::fs::remove_dir_all(base).ok();
    }

    #[test]
    fn catalog_metadata_lookup_prefers_stable_key_and_keeps_legacy_compatibility() {
        let mut entry = catalog_entry("claude:session-1", "child", Some("Child"), None);
        entry.engine = "claude".to_string();
        entry.canonical_session_id = Some("session-1".to_string());
        let stable_key = build_catalog_entry_stable_key(&entry);

        let mut metadata = WorkspaceSessionCatalogMetadata::default();
        metadata
            .archived_at_by_session_id
            .insert(stable_key.clone(), 42);
        metadata
            .folder_id_by_session_id
            .insert(stable_key.clone(), "folder-a".to_string());

        assert_eq!(stable_key, "claude:child:session-1");
        assert_eq!(archived_at_for_entry(&metadata, &entry), Some(42));
        assert_eq!(
            folder_assignment_for_entry(&metadata, &entry).map(String::as_str),
            Some("folder-a")
        );
        assert_eq!(
            metadata_stable_key_for_session_id("child", "claude:session-1"),
            stable_key
        );

        metadata
            .archived_at_by_session_id
            .insert("claude:session-1".to_string(), 7);
        remove_catalog_metadata_for_session(&mut metadata, "child", "claude:session-1");
        assert!(metadata
            .archived_at_by_session_id
            .get("claude:session-1")
            .is_none());
        assert!(metadata
            .archived_at_by_session_id
            .get("claude:child:session-1")
            .is_none());
        assert!(metadata
            .folder_id_by_session_id
            .get("claude:child:session-1")
            .is_none());
    }
