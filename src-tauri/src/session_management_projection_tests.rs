    #[test]
    fn catalog_entry_dedupe_key_includes_workspace_identity() {
        let left = catalog_entry("shared-session", "main", None, None);
        let right = WorkspaceSessionCatalogEntry {
            workspace_id: "worktree-a".to_string(),
            ..left.clone()
        };

        assert_ne!(
            build_catalog_entry_dedupe_key(&left),
            build_catalog_entry_dedupe_key(&right)
        );
    }

    #[test]
    fn catalog_entry_dedupe_key_collapses_same_workspace_identity() {
        let left = catalog_entry("shared-session", "main", None, None);
        let right = WorkspaceSessionCatalogEntry {
            source: Some("override".to_string()),
            source_label: Some("override/codex".to_string()),
            updated_at: 2,
            ..left.clone()
        };

        assert_eq!(
            build_catalog_entry_dedupe_key(&left),
            build_catalog_entry_dedupe_key(&right)
        );
    }

    #[test]
    fn partial_source_join_dedupes_scope_failures_without_dropping_signal() {
        let partial_source = join_partial_sources(vec![
            SESSION_CATALOG_PARTIAL_CODEX.to_string(),
            SESSION_CATALOG_PARTIAL_GEMINI.to_string(),
            SESSION_CATALOG_PARTIAL_CODEX.to_string(),
        ]);

        assert_eq!(
            partial_source,
            Some("codex-history-unavailable,gemini-history-unavailable".to_string())
        );
    }

    #[test]
    fn projection_summary_counts_filtered_total_separately_from_status_buckets() {
        let mut active = catalog_entry("codex:active", "main", Some("Main"), None);
        active.engine = "codex".to_string();
        active.title = "Bugfix discussion".to_string();

        let mut archived = catalog_entry("claude:archived", "worktree-a", Some("Worktree"), None);
        archived.engine = "claude".to_string();
        archived.title = "Bugfix archive".to_string();
        archived.archived_at = Some(42);

        let mut other = catalog_entry("gemini:other", "main", Some("Main"), None);
        other.engine = "gemini".to_string();
        other.title = "Other topic".to_string();

        let counts = build_catalog_count_summary(
            &[active, archived, other],
            &WorkspaceSessionCatalogQuery {
                keyword: Some("bugfix".to_string()),
                engine: None,
                status: Some("active".to_string()),
                folder_id: None,
                ..Default::default()
            },
        );

        assert_eq!(
            counts,
            SessionCatalogCountSummary {
                active_total: 1,
                archived_total: 1,
                all_total: 2,
                filtered_total: 1,
            }
        );
    }

    #[test]
    fn folder_count_summary_uses_filtered_entries_and_parent_folder_inheritance() {
        let mut parent = catalog_entry("codex:parent", "main", Some("Main"), None);
        parent.folder_id = Some("folder-a".to_string());
        parent.title = "Bugfix parent".to_string();

        let mut inherited_child = catalog_entry("codex:child", "main", Some("Main"), None);
        inherited_child.parent_session_id = Some("codex:parent".to_string());
        inherited_child.title = "Bugfix child".to_string();

        let mut root = catalog_entry("codex:root", "main", Some("Main"), None);
        root.title = "Bugfix root".to_string();

        let mut filtered_out = catalog_entry("codex:other", "main", Some("Main"), None);
        filtered_out.folder_id = Some("folder-a".to_string());
        filtered_out.title = "Other topic".to_string();

        let query = WorkspaceSessionCatalogQuery {
            keyword: Some("bugfix".to_string()),
            engine: None,
            status: Some("active".to_string()),
            folder_id: None,
            ..Default::default()
        };
        let entries = [parent, inherited_child, root, filtered_out];
        let filtered_entries = entries
            .iter()
            .filter(|entry| entry_matches_query(entry, &query))
            .collect::<Vec<_>>();
        let folder_counts = build_catalog_folder_count_summary(&filtered_entries);

        assert_eq!(folder_counts.folder_counts_by_id.get("folder-a"), Some(&2));
        assert_eq!(folder_counts.unassigned_folder_count, 1);
    }

    #[test]
    fn catalog_page_filters_by_effective_folder_before_pagination() {
        let mut newest = catalog_entry("codex:newest", "main", Some("Main"), None);
        newest.updated_at = 300;

        let mut parent = catalog_entry("codex:parent", "main", Some("Main"), None);
        parent.updated_at = 200;
        parent.folder_id = Some("folder-a".to_string());

        let mut child = catalog_entry("codex:child", "main", Some("Main"), None);
        child.updated_at = 100;
        child.parent_session_id = Some("codex:parent".to_string());

        let page = build_catalog_page(
            vec![newest, parent, child],
            WorkspaceSessionCatalogQuery {
                keyword: None,
                engine: None,
                status: Some("active".to_string()),
                folder_id: Some("folder-a".to_string()),
                ..Default::default()
            },
            None,
            Some(1),
            None,
            Vec::new(),
        );

        assert_eq!(page.data.len(), 1);
        assert_eq!(page.data[0].session_id, "codex:parent");
        assert!(page
            .next_cursor
            .as_deref()
            .is_some_and(|cursor| cursor.starts_with(SESSION_CATALOG_STABLE_CURSOR_PREFIX)));
    }

    #[test]
    fn normalize_partial_sources_preserves_first_seen_order() {
        let partial_sources = normalize_partial_sources(vec![
            SESSION_CATALOG_PARTIAL_GEMINI.to_string(),
            SESSION_CATALOG_PARTIAL_CODEX.to_string(),
            SESSION_CATALOG_PARTIAL_GEMINI.to_string(),
        ]);

        assert_eq!(
            partial_sources,
            vec![
                SESSION_CATALOG_PARTIAL_GEMINI.to_string(),
                SESSION_CATALOG_PARTIAL_CODEX.to_string(),
            ]
        );
    }
