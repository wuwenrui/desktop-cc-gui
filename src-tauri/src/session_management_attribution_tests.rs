    #[tokio::test]
    async fn catalog_workspace_scope_supports_windows_style_paths_without_changing_scope_ids() {
        let main = workspace_entry("main", "Main", r"C:\repo\main", WorkspaceKind::Main, None);
        let worktree = workspace_entry(
            "worktree-a",
            "Worktree A",
            r"C:\repo\main\.worktrees\a",
            WorkspaceKind::Worktree,
            Some("main"),
        );
        let unrelated = workspace_entry(
            "other",
            "Other",
            r"D:\repo\other",
            WorkspaceKind::Main,
            None,
        );
        let workspaces = Mutex::new(HashMap::from([
            (main.id.clone(), main),
            (worktree.id.clone(), worktree),
            (unrelated.id.clone(), unrelated),
        ]));

        let scope = catalog_workspace_scope(&workspaces, "main")
            .await
            .expect("resolve windows scope");

        let ids: Vec<_> = scope.into_iter().map(|entry| entry.id).collect();
        assert_eq!(ids, vec!["main", "worktree-a"]);
    }

    #[test]
    fn inferred_related_attribution_marks_same_worktree_family_as_high_confidence() {
        let main = workspace_entry("main", "Main", "/repo/main", WorkspaceKind::Main, None);
        let mut worktree_a = workspace_entry(
            "worktree-a",
            "A",
            "/repo/worktree-a",
            WorkspaceKind::Worktree,
            Some("main"),
        );
        let worktree_b = workspace_entry(
            "worktree-b",
            "B",
            "/repo/worktree-b",
            WorkspaceKind::Worktree,
            Some("main"),
        );
        worktree_a.settings.git_root = Some("/repo".to_string());

        let workspaces = HashMap::from([
            (main.id.clone(), main),
            (worktree_a.id.clone(), worktree_a.clone()),
            (worktree_b.id.clone(), worktree_b.clone()),
        ]);
        let entry = catalog_entry("codex:1", "worktree-b", Some("B"), Some("/repo/worktree-b"));

        let attribution = infer_related_attribution_for_workspace(&workspaces, &worktree_a, &entry)
            .expect("related attribution");

        assert_eq!(
            attribution.status,
            SessionCatalogAttributionStatus::InferredRelated
        );
        assert_eq!(
            attribution.reason,
            Some(SessionCatalogAttributionReason::SharedWorktreeFamily)
        );
        assert_eq!(
            attribution.confidence,
            Some(SessionCatalogAttributionConfidence::High)
        );
    }

    #[test]
    fn inferred_related_attribution_uses_unique_git_root_match() {
        let mut main = workspace_entry("main", "Main", "/repo/main", WorkspaceKind::Main, None);
        main.settings.git_root = Some("/repo".to_string());
        let unrelated = workspace_entry("other", "Other", "/elsewhere", WorkspaceKind::Main, None);
        let workspaces = HashMap::from([
            (main.id.clone(), main.clone()),
            (unrelated.id.clone(), unrelated),
        ]);
        let entry = catalog_entry(
            "codex:2",
            SESSION_CATALOG_UNASSIGNED_WORKSPACE_ID,
            None,
            Some("/repo/tools"),
        );

        let attribution = infer_related_attribution_for_workspace(&workspaces, &main, &entry)
            .expect("git root attribution");

        assert_eq!(
            attribution.reason,
            Some(SessionCatalogAttributionReason::SharedGitRoot)
        );
        assert_eq!(
            attribution.confidence,
            Some(SessionCatalogAttributionConfidence::Medium)
        );
    }

    #[test]
    fn inferred_related_attribution_keeps_ambiguous_git_root_unassigned() {
        let mut main_a = workspace_entry("main-a", "Main A", "/repo-a", WorkspaceKind::Main, None);
        main_a.settings.git_root = Some("/shared".to_string());
        let mut main_b = workspace_entry("main-b", "Main B", "/repo-b", WorkspaceKind::Main, None);
        main_b.settings.git_root = Some("/shared".to_string());
        let workspaces = HashMap::from([
            (main_a.id.clone(), main_a.clone()),
            (main_b.id.clone(), main_b),
        ]);
        let entry = catalog_entry(
            "codex:3",
            SESSION_CATALOG_UNASSIGNED_WORKSPACE_ID,
            None,
            Some("/shared/tools"),
        );

        let attribution = infer_related_attribution_for_workspace(&workspaces, &main_a, &entry);

        assert!(attribution.is_none());
    }

    #[tokio::test]
    async fn project_related_sessions_include_claude_inferred_entries() {
        let base = std::env::temp_dir().join(format!("related-claude-{}", Uuid::new_v4()));
        std::fs::create_dir_all(&base).expect("create temp dir");
        let storage_path = base.join("workspaces.json");
        std::fs::write(&storage_path, "[]").expect("seed storage path");

        let repo_path = base.join("repo");
        let worktree_a_path = repo_path.join("worktree-a");
        let worktree_b_path = repo_path.join("worktree-b");
        std::fs::create_dir_all(&worktree_a_path).expect("create worktree a");
        std::fs::create_dir_all(&worktree_b_path).expect("create worktree b");

        let claude_home = base.join("claude-home");
        let claude_projects_dir = claude_home.join("projects");
        write_claude_session_fixture(
            &claude_projects_dir,
            &worktree_b_path,
            "related-claude-session",
            &worktree_b_path,
            "related claude task",
        );

        let main = workspace_entry(
            "main",
            "Main",
            &repo_path.to_string_lossy(),
            WorkspaceKind::Main,
            None,
        );
        let selected = workspace_entry(
            "worktree-a",
            "A",
            &worktree_a_path.to_string_lossy(),
            WorkspaceKind::Worktree,
            Some("main"),
        );
        let sibling = workspace_entry(
            "worktree-b",
            "B",
            &worktree_b_path.to_string_lossy(),
            WorkspaceKind::Worktree,
            Some("main"),
        );
        let workspaces = Mutex::new(HashMap::from([
            (main.id.clone(), main),
            (selected.id.clone(), selected),
            (sibling.id.clone(), sibling),
        ]));
        let engine_manager = engine::EngineManager::new();
        engine_manager
            .set_engine_config(
                engine::EngineType::Claude,
                engine::EngineConfig {
                    home_dir: Some(claude_home.to_string_lossy().to_string()),
                    ..engine::EngineConfig::default()
                },
            )
            .await;

        let page = list_project_related_sessions_core(
            &workspaces,
            &engine_manager,
            &storage_path,
            "worktree-a".to_string(),
            Some(WorkspaceSessionCatalogQuery {
                engine: Some("claude".to_string()),
                status: Some("active".to_string()),
                ..Default::default()
            }),
            None,
            Some(20),
        )
        .await
        .expect("list related sessions");

        assert!(page.data.iter().any(|entry| {
            entry.engine == "claude"
                && entry.session_id == "claude:related-claude-session"
                && entry.workspace_id == "worktree-b"
                && entry.attribution_status.as_deref()
                    == Some(SessionCatalogAttributionStatus::InferredRelated.as_str())
        }));
        std::fs::remove_dir_all(base).ok();
    }

    #[test]
    fn legacy_related_codex_query_forces_codex_engine_filter() {
        let query = force_codex_related_query(Some(WorkspaceSessionCatalogQuery {
            keyword: Some("feature".to_string()),
            engine: Some("claude".to_string()),
            status: Some("active".to_string()),
            folder_id: Some("__all__".to_string()),
            ..Default::default()
        }));

        assert_eq!(query.keyword.as_deref(), Some("feature"));
        assert_eq!(query.engine.as_deref(), Some("codex"));
        assert_eq!(query.status.as_deref(), Some("active"));
        assert_eq!(query.folder_id.as_deref(), Some("__all__"));

        let default_query = force_codex_related_query(None);
        assert_eq!(default_query.engine.as_deref(), Some("codex"));
    }

    #[test]
    fn shared_attribution_resolver_uses_cwd_strict_match_for_any_engine() {
        let main = workspace_entry("main", "Main", "/repo/main", WorkspaceKind::Main, None);
        let workspaces = HashMap::from([(main.id.clone(), main.clone())]);
        let mut entry = catalog_entry(
            "claude:cwd",
            SESSION_CATALOG_UNASSIGNED_WORKSPACE_ID,
            None,
            Some("/repo/main/src"),
        );
        entry.engine = "claude".to_string();

        let attribution = resolve_catalog_entry_attribution(&workspaces, &entry);

        assert_eq!(
            attribution.status,
            SessionCatalogAttributionStatus::StrictMatch
        );
        assert_eq!(
            attribution.reason,
            Some(SessionCatalogAttributionReason::CwdLongest)
        );
        assert_eq!(attribution.matched_workspace_id.as_deref(), Some("main"));
    }

    #[test]
    fn shared_attribution_resolver_marks_exact_cwd_evidence() {
        let main = workspace_entry("main", "Main", "/repo/main", WorkspaceKind::Main, None);
        let workspaces = HashMap::from([(main.id.clone(), main)]);
        let mut entry = catalog_entry(
            "claude:cwd-exact",
            SESSION_CATALOG_UNASSIGNED_WORKSPACE_ID,
            None,
            Some("/repo/main"),
        );
        entry.engine = "claude".to_string();

        let attribution = resolve_catalog_entry_attribution(&workspaces, &entry);

        assert_eq!(
            attribution.status,
            SessionCatalogAttributionStatus::StrictMatch
        );
        assert_eq!(
            attribution.reason,
            Some(SessionCatalogAttributionReason::CwdExact)
        );
        assert_eq!(attribution.matched_workspace_id.as_deref(), Some("main"));
    }

    #[test]
    fn shared_attribution_resolver_marks_claude_project_dir_direct_evidence() {
        let main = workspace_entry("main", "Main", "/repo/main", WorkspaceKind::Main, None);
        let workspaces = HashMap::from([(main.id.clone(), main)]);
        let mut entry = catalog_entry("claude:project-dir", "main", Some("Main"), None);
        entry.engine = "claude".to_string();
        entry.attribution_reason =
            Some(engine::claude_history::CLAUDE_ATTRIBUTION_REASON_PROJECT_DIRECTORY.to_string());

        let attribution = resolve_catalog_entry_attribution(&workspaces, &entry);

        assert_eq!(
            attribution.status,
            SessionCatalogAttributionStatus::StrictMatch
        );
        assert_eq!(
            attribution.reason,
            Some(SessionCatalogAttributionReason::ProjectDirDirect)
        );
        assert_eq!(
            attribution.confidence,
            Some(SessionCatalogAttributionConfidence::Medium)
        );
        assert_eq!(attribution.matched_workspace_id.as_deref(), Some("main"));
    }

    #[test]
    fn shared_attribution_resolver_rejects_cwd_project_dir_owner_conflict() {
        let left = workspace_entry("left", "Left", "/repo/left", WorkspaceKind::Main, None);
        let right = workspace_entry("right", "Right", "/repo/right", WorkspaceKind::Main, None);
        let workspaces = HashMap::from([(left.id.clone(), left), (right.id.clone(), right)]);
        let mut entry = catalog_entry("claude:conflict", "left", Some("Left"), Some("/repo/right"));
        entry.engine = "claude".to_string();
        entry.attribution_reason =
            Some(engine::claude_history::CLAUDE_ATTRIBUTION_REASON_PROJECT_DIRECTORY.to_string());

        let attribution = resolve_catalog_entry_attribution(&workspaces, &entry);

        assert_eq!(
            attribution.status,
            SessionCatalogAttributionStatus::Unassigned
        );
        assert_eq!(
            attribution.reason,
            Some(SessionCatalogAttributionReason::CwdProjectConflict)
        );
        assert_eq!(attribution.matched_workspace_id, None);
    }

    #[test]
    fn shared_attribution_resolver_uses_git_root_strict_match() {
        let mut main = workspace_entry("main", "Main", "/repo/main/app", WorkspaceKind::Main, None);
        main.settings.git_root = Some("/repo/main".to_string());
        let other = workspace_entry("other", "Other", "/elsewhere", WorkspaceKind::Main, None);
        let workspaces = HashMap::from([(main.id.clone(), main.clone()), (other.id.clone(), other)]);
        let mut entry = catalog_entry(
            "claude:git",
            SESSION_CATALOG_UNASSIGNED_WORKSPACE_ID,
            None,
            Some("/repo/main/tools"),
        );
        entry.engine = "claude".to_string();

        let attribution = resolve_catalog_entry_attribution(&workspaces, &entry);

        assert_eq!(
            attribution.status,
            SessionCatalogAttributionStatus::StrictMatch
        );
        assert_eq!(
            attribution.reason,
            Some(SessionCatalogAttributionReason::GitRootInferred)
        );
        assert_eq!(attribution.matched_workspace_id.as_deref(), Some("main"));
    }

    #[test]
    fn shared_attribution_resolver_keeps_ambiguous_workspace_match_unassigned() {
        let main_a = workspace_entry("main-a", "Main A", "/repo/main", WorkspaceKind::Main, None);
        let main_b = workspace_entry("main-b", "Main B", "/repo/main", WorkspaceKind::Main, None);
        let workspaces = HashMap::from([(main_a.id.clone(), main_a), (main_b.id.clone(), main_b)]);
        let mut entry = catalog_entry(
            "claude:ambiguous",
            SESSION_CATALOG_UNASSIGNED_WORKSPACE_ID,
            None,
            Some("/repo/main/src"),
        );
        entry.engine = "claude".to_string();

        let attribution = resolve_catalog_entry_attribution(&workspaces, &entry);

        assert_eq!(
            attribution.status,
            SessionCatalogAttributionStatus::Unassigned
        );
        assert_eq!(
            attribution.reason,
            Some(SessionCatalogAttributionReason::AmbiguousSibling)
        );
        assert_eq!(attribution.matched_workspace_id, None);
    }

    #[test]
    fn catalog_dedupe_key_preserves_same_title_across_engines() {
        let mut codex = catalog_entry("shared-id", "main", Some("Main"), Some("/repo/main"));
        codex.engine = "codex".to_string();
        codex.title = "Same title".to_string();
        let mut claude = catalog_entry("shared-id", "main", Some("Main"), Some("/repo/main"));
        claude.engine = "claude".to_string();
        claude.title = "Same title".to_string();

        assert_ne!(
            build_catalog_entry_dedupe_key(&codex),
            build_catalog_entry_dedupe_key(&claude)
        );
    }

    #[test]
    fn claude_attribution_scopes_include_git_root_without_duplication() {
        let mut main = workspace_entry("main", "Main", "/repo/main", WorkspaceKind::Main, None);
        main.settings.git_root = Some("/repo/main".to_string());

        let scopes = build_claude_attribution_scopes(&main);

        assert_eq!(scopes.len(), 1);
        assert_eq!(scopes[0].path, PathBuf::from("/repo/main"));
    }

    #[test]
    fn claude_source_status_treats_capped_empty_scan_as_partial() {
        let result = engine::claude_history::ClaudeSessionSourceFactList {
            facts: Vec::new(),
            diagnostics: Vec::new(),
            scanned_candidates: 2,
            skipped_candidates: 0,
            scan_cap_reached: true,
            cache_metrics: engine::claude_history::ClaudeSessionSourceFactCacheMetrics::default(),
        };

        let status =
            build_claude_source_fact_status(&result, SessionCatalogScanMode::Bounded(1), Vec::new());

        assert_eq!(
            status.completeness,
            WorkspaceSessionSourceCompleteness::Partial
        );
        assert_eq!(status.reason.as_deref(), Some("claude-scan-cap-reached"));
    }

    #[test]
    fn claude_source_status_treats_unreadable_diagnostics_as_degraded() {
        let result = engine::claude_history::ClaudeSessionSourceFactList {
            facts: Vec::new(),
            diagnostics: vec![engine::claude_history::ClaudeSessionScanDiagnostic {
                code: engine::claude_history::ClaudeSessionScanDiagnosticCode::UnreadableFile,
                reason: "unreadable-file".to_string(),
                physical_path: "/repo/.claude/projects/bad".to_string(),
                session_id: None,
                cwd: None,
            }],
            scanned_candidates: 0,
            skipped_candidates: 1,
            scan_cap_reached: false,
            cache_metrics: engine::claude_history::ClaudeSessionSourceFactCacheMetrics::default(),
        };

        let status =
            build_claude_source_fact_status(&result, SessionCatalogScanMode::Exhaustive, Vec::new());

        assert_eq!(
            status.completeness,
            WorkspaceSessionSourceCompleteness::Degraded
        );
        assert_eq!(status.reason.as_deref(), Some("claude-source-degraded"));
    }
