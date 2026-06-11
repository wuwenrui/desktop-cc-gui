    #[tokio::test]
    async fn auto_session_metadata_rejects_invalid_boundary_values() {
        let base = std::env::temp_dir().join(format!("auto-session-invalid-{}", Uuid::new_v4()));
        std::fs::create_dir_all(&base).expect("create temp dir");
        let storage_path = base.join("workspaces.json");
        std::fs::write(&storage_path, "[]").expect("seed storage path");
        let workspace = workspace_entry("ws-1", "Workspace", "/tmp/ws-1", WorkspaceKind::Main, None);
        let workspaces = Mutex::new(HashMap::from([(workspace.id.clone(), workspace)]));

        let valid_metadata = AutoSessionMetadata {
            session_purpose: "prompt-enhancer".to_string(),
            visibility: AutoSessionVisibility::Hidden,
            owner_feature: "composer".to_string(),
            auto_archive: Some(true),
            created_by: AutoSessionCreatedBy::System,
        };

        let invalid_session = record_auto_session_metadata_core(
            &workspaces,
            &storage_path,
            "ws-1".to_string(),
            "../escape".to_string(),
            valid_metadata.clone(),
        )
        .await
        .expect_err("invalid session id rejected");
        assert_eq!(invalid_session, "invalid session_id");

        let empty_purpose = record_auto_session_metadata_core(
            &workspaces,
            &storage_path,
            "ws-1".to_string(),
            "codex-valid".to_string(),
            AutoSessionMetadata {
                session_purpose: "   ".to_string(),
                ..valid_metadata.clone()
            },
        )
        .await
        .expect_err("empty session purpose rejected");
        assert_eq!(empty_purpose, "sessionPurpose is required");

        let path_like_owner = record_auto_session_metadata_core(
            &workspaces,
            &storage_path,
            "ws-1".to_string(),
            "codex-valid".to_string(),
            AutoSessionMetadata {
                owner_feature: "feature\\nested".to_string(),
                ..valid_metadata
            },
        )
        .await
        .expect_err("path-like owner feature rejected");
        assert_eq!(path_like_owner, "invalid ownerFeature");

        let metadata = read_catalog_metadata(&storage_path, "ws-1").expect("read metadata");
        assert!(metadata.auto_session_by_session_id.is_empty());

        std::fs::remove_dir_all(base).ok();
    }
    #[tokio::test]
    async fn system_auto_metadata_exposes_reserved_folder_group() {
        let base = std::env::temp_dir().join(format!("system-auto-folder-{}", Uuid::new_v4()));
        std::fs::create_dir_all(&base).expect("create temp dir");
        let storage_path = base.join("workspaces.json");
        std::fs::write(&storage_path, "[]").expect("seed storage path");
        let workspace = workspace_entry("ws-1", "Workspace", "/tmp/ws-1", WorkspaceKind::Main, None);
        let workspaces = Mutex::new(HashMap::from([(workspace.id.clone(), workspace)]));

        let empty_tree = list_workspace_session_folders_core(
            &workspaces,
            &storage_path,
            "ws-1".to_string(),
        )
        .await
        .expect("list empty folders");
        assert!(
            empty_tree
                .folders
                .iter()
                .all(|folder| folder.id != SESSION_FOLDER_SYSTEM_AUTO_ID)
        );

        record_auto_session_metadata_core(
            &workspaces,
            &storage_path,
            "ws-1".to_string(),
            "codex-traceable".to_string(),
            AutoSessionMetadata {
                session_purpose: "spec-hub-apply".to_string(),
                visibility: AutoSessionVisibility::SystemAuto,
                owner_feature: "spec-hub".to_string(),
                auto_archive: Some(false),
                created_by: AutoSessionCreatedBy::System,
            },
        )
        .await
        .expect("record system-auto metadata");

        let tree = list_workspace_session_folders_core(
            &workspaces,
            &storage_path,
            "ws-1".to_string(),
        )
        .await
        .expect("list system-auto folders");
        let system_folder = tree
            .folders
            .iter()
            .find(|folder| folder.id == SESSION_FOLDER_SYSTEM_AUTO_ID)
            .expect("system-auto folder");
        assert_eq!(system_folder.workspace_id, "ws-1");
        assert_eq!(system_folder.parent_id, None);
        assert_eq!(system_folder.name, "system-auto");

        assert!(create_workspace_session_folder_core(
            &workspaces,
            &storage_path,
            "ws-1".to_string(),
            "Invalid".to_string(),
            Some(SESSION_FOLDER_SYSTEM_AUTO_ID.to_string()),
        )
        .await
        .is_err());

        std::fs::remove_dir_all(base).ok();
    }
    #[tokio::test]
    async fn workspace_session_folder_tree_starts_empty_and_persists_nested_folders() {
        let base = std::env::temp_dir().join(format!("session-folders-{}", Uuid::new_v4()));
        std::fs::create_dir_all(&base).expect("create temp dir");
        let storage_path = base.join("workspaces.json");
        std::fs::write(&storage_path, "[]").expect("seed storage path");
        let workspace = workspace_entry("ws-1", "Workspace", "/tmp/ws-1", WorkspaceKind::Main, None);
        let workspaces = Mutex::new(HashMap::from([(workspace.id.clone(), workspace)]));

        let empty = list_workspace_session_folders_core(&workspaces, &storage_path, "ws-1".to_string())
            .await
            .expect("list empty tree");
        assert_eq!(empty.folders, Vec::<WorkspaceSessionFolder>::new());

        let parent = create_workspace_session_folder_core(
            &workspaces,
            &storage_path,
            "ws-1".to_string(),
            "Bugs".to_string(),
            None,
        )
        .await
        .expect("create parent folder")
        .folder;
        let child = create_workspace_session_folder_core(
            &workspaces,
            &storage_path,
            "ws-1".to_string(),
            "Regression".to_string(),
            Some(parent.id.clone()),
        )
        .await
        .expect("create child folder")
        .folder;

        let tree = list_workspace_session_folders_core(&workspaces, &storage_path, "ws-1".to_string())
            .await
            .expect("list populated tree");
        assert_eq!(tree.folders.len(), 2);
        assert!(tree.folders.iter().any(|folder| folder.id == parent.id));
        assert!(tree
            .folders
            .iter()
            .any(|folder| folder.id == child.id
                && folder.parent_id.as_deref() == Some(parent.id.as_str())));

        std::fs::remove_dir_all(base).ok();
    }

    #[tokio::test]
    async fn workspace_session_folder_crud_rejects_cycles_and_deletes_empty_subtree() {
        let base = std::env::temp_dir().join(format!("session-folder-crud-{}", Uuid::new_v4()));
        std::fs::create_dir_all(&base).expect("create temp dir");
        let storage_path = base.join("workspaces.json");
        std::fs::write(&storage_path, "[]").expect("seed storage path");
        let workspace = workspace_entry("ws-1", "Workspace", "/tmp/ws-1", WorkspaceKind::Main, None);
        let workspaces = Mutex::new(HashMap::from([(workspace.id.clone(), workspace)]));
        let engine_manager = engine::EngineManager::new();

        let parent = create_workspace_session_folder_core(
            &workspaces,
            &storage_path,
            "ws-1".to_string(),
            "Parent".to_string(),
            None,
        )
        .await
        .expect("create parent")
        .folder;
        let child = create_workspace_session_folder_core(
            &workspaces,
            &storage_path,
            "ws-1".to_string(),
            "Child".to_string(),
            Some(parent.id.clone()),
        )
        .await
        .expect("create child")
        .folder;

        let cycle_error = move_workspace_session_folder_core(
            &workspaces,
            &storage_path,
            "ws-1".to_string(),
            parent.id.clone(),
            Some(child.id.clone()),
        )
        .await
        .expect_err("cycle move must fail");
        assert_eq!(cycle_error, "folder tree cannot contain cycles");

        delete_workspace_session_folder_core(
            &workspaces,
            &engine_manager,
            &storage_path,
            "ws-1".to_string(),
            parent.id.clone(),
        )
        .await
        .expect("delete empty folder subtree");
        let metadata = read_catalog_metadata(&storage_path, "ws-1").expect("read metadata");
        assert!(!metadata.folders.iter().any(|folder| folder.id == parent.id));
        assert!(!metadata.folders.iter().any(|folder| folder.id == child.id));

        std::fs::remove_dir_all(base).ok();
    }

    #[tokio::test]
    async fn workspace_session_folder_delete_cleans_stale_subtree_assignments_when_visible_count_is_zero(
    ) {
        let base = std::env::temp_dir().join(format!("session-folder-stale-{}", Uuid::new_v4()));
        std::fs::create_dir_all(&base).expect("create temp dir");
        let storage_path = base.join("workspaces.json");
        std::fs::write(&storage_path, "[]").expect("seed storage path");
        let codex_home = base.join("codex-home");
        let workspace = workspace_with_codex_home("ws-1", "Workspace", "/tmp/ws-1", &codex_home);
        let workspaces = Mutex::new(HashMap::from([(workspace.id.clone(), workspace)]));
        let engine_manager = engine::EngineManager::new();

        let folder = create_workspace_session_folder_core(
            &workspaces,
            &storage_path,
            "ws-1".to_string(),
            "Stale folder".to_string(),
            None,
        )
        .await
        .expect("create folder")
        .folder;
        let child = create_workspace_session_folder_core(
            &workspaces,
            &storage_path,
            "ws-1".to_string(),
            "Stale child".to_string(),
            Some(folder.id.clone()),
        )
        .await
        .expect("create child folder")
        .folder;
        with_catalog_metadata_mutation(&storage_path, "ws-1", |metadata| {
            metadata
                .folder_id_by_session_id
                .insert("codex:ws-1:missing-session".to_string(), child.id.clone());
            Ok(())
        })
        .expect("write stale folder assignment");

        delete_workspace_session_folder_core(
            &workspaces,
            &engine_manager,
            &storage_path,
            "ws-1".to_string(),
            folder.id.clone(),
        )
        .await
        .expect("delete empty folder with stale metadata");

        let metadata = read_catalog_metadata(&storage_path, "ws-1").expect("read metadata");
        assert!(!metadata.folders.iter().any(|item| item.id == folder.id));
        assert!(!metadata.folders.iter().any(|item| item.id == child.id));
        assert!(metadata.folder_id_by_session_id.is_empty());

        std::fs::remove_dir_all(base).ok();
    }

    #[tokio::test]
    async fn workspace_session_folder_delete_promotes_existing_session_assignment_to_root() {
        let base = std::env::temp_dir().join(format!("session-folder-real-{}", Uuid::new_v4()));
        std::fs::create_dir_all(&base).expect("create temp dir");
        let storage_path = base.join("workspaces.json");
        std::fs::write(&storage_path, "[]").expect("seed storage path");
        let codex_home = base.join("codex-home");
        write_codex_session_fixture(&codex_home, "codex-real", "/tmp/ws-1");
        let workspace = workspace_with_codex_home("ws-1", "Workspace", "/tmp/ws-1", &codex_home);
        let workspaces = Mutex::new(HashMap::from([(workspace.id.clone(), workspace)]));
        let engine_manager = engine::EngineManager::new();

        let folder = create_workspace_session_folder_core(
            &workspaces,
            &storage_path,
            "ws-1".to_string(),
            "Real folder".to_string(),
            None,
        )
        .await
        .expect("create folder")
        .folder;
        assign_workspace_session_folder_core(
            &workspaces,
            &engine_manager,
            &storage_path,
            "ws-1".to_string(),
            "codex-real".to_string(),
            Some(folder.id.clone()),
        )
        .await
        .expect("assign real session");

        delete_workspace_session_folder_core(
            &workspaces,
            &engine_manager,
            &storage_path,
            "ws-1".to_string(),
            folder.id.clone(),
        )
        .await
        .expect("delete folder with real session");
        let metadata = read_catalog_metadata(&storage_path, "ws-1").expect("read metadata");
        assert!(!metadata.folders.iter().any(|item| item.id == folder.id));
        assert!(!metadata
            .folder_id_by_session_id
            .contains_key(&metadata_stable_key_for_session_id("ws-1", "codex-real")));

        std::fs::remove_dir_all(base).ok();
    }

    #[tokio::test]
    async fn workspace_session_folder_delete_promotes_child_session_assignment_to_parent_folder() {
        let base = std::env::temp_dir().join(format!("session-folder-child-real-{}", Uuid::new_v4()));
        std::fs::create_dir_all(&base).expect("create temp dir");
        let storage_path = base.join("workspaces.json");
        std::fs::write(&storage_path, "[]").expect("seed storage path");
        let codex_home = base.join("codex-home");
        write_codex_session_fixture(&codex_home, "codex-child-real", "/tmp/ws-1");
        let workspace = workspace_with_codex_home("ws-1", "Workspace", "/tmp/ws-1", &codex_home);
        let workspaces = Mutex::new(HashMap::from([(workspace.id.clone(), workspace)]));
        let engine_manager = engine::EngineManager::new();

        let parent = create_workspace_session_folder_core(
            &workspaces,
            &storage_path,
            "ws-1".to_string(),
            "Parent".to_string(),
            None,
        )
        .await
        .expect("create parent folder")
        .folder;
        let child = create_workspace_session_folder_core(
            &workspaces,
            &storage_path,
            "ws-1".to_string(),
            "Child".to_string(),
            Some(parent.id.clone()),
        )
        .await
        .expect("create child folder")
        .folder;
        assign_workspace_session_folder_core(
            &workspaces,
            &engine_manager,
            &storage_path,
            "ws-1".to_string(),
            "codex-child-real".to_string(),
            Some(child.id.clone()),
        )
        .await
        .expect("assign real session to child folder");

        delete_workspace_session_folder_core(
            &workspaces,
            &engine_manager,
            &storage_path,
            "ws-1".to_string(),
            child.id.clone(),
        )
        .await
        .expect("delete child folder with real session");
        let metadata = read_catalog_metadata(&storage_path, "ws-1").expect("read metadata");
        assert!(metadata.folders.iter().any(|item| item.id == parent.id));
        assert!(!metadata.folders.iter().any(|item| item.id == child.id));
        assert_eq!(
            metadata
                .folder_id_by_session_id
                .get(&metadata_stable_key_for_session_id(
                    "ws-1",
                    "codex-child-real"
                )),
            Some(&parent.id)
        );

        std::fs::remove_dir_all(base).ok();
    }

    #[tokio::test]
    async fn workspace_session_folder_delete_promotes_descendant_session_assignment_to_root() {
        let base = std::env::temp_dir().join(format!("session-folder-subtree-real-{}", Uuid::new_v4()));
        std::fs::create_dir_all(&base).expect("create temp dir");
        let storage_path = base.join("workspaces.json");
        std::fs::write(&storage_path, "[]").expect("seed storage path");
        let codex_home = base.join("codex-home");
        write_codex_session_fixture(&codex_home, "codex-descendant-real", "/tmp/ws-1");
        let workspace = workspace_with_codex_home("ws-1", "Workspace", "/tmp/ws-1", &codex_home);
        let workspaces = Mutex::new(HashMap::from([(workspace.id.clone(), workspace)]));
        let engine_manager = engine::EngineManager::new();

        let parent = create_workspace_session_folder_core(
            &workspaces,
            &storage_path,
            "ws-1".to_string(),
            "Parent".to_string(),
            None,
        )
        .await
        .expect("create parent folder")
        .folder;
        let child = create_workspace_session_folder_core(
            &workspaces,
            &storage_path,
            "ws-1".to_string(),
            "Child".to_string(),
            Some(parent.id.clone()),
        )
        .await
        .expect("create child folder")
        .folder;
        assign_workspace_session_folder_core(
            &workspaces,
            &engine_manager,
            &storage_path,
            "ws-1".to_string(),
            "codex-descendant-real".to_string(),
            Some(child.id.clone()),
        )
        .await
        .expect("assign real session to child folder");

        delete_workspace_session_folder_core(
            &workspaces,
            &engine_manager,
            &storage_path,
            "ws-1".to_string(),
            parent.id.clone(),
        )
        .await
        .expect("delete parent folder subtree with real session");
        let metadata = read_catalog_metadata(&storage_path, "ws-1").expect("read metadata");
        assert!(!metadata.folders.iter().any(|item| item.id == parent.id));
        assert!(!metadata.folders.iter().any(|item| item.id == child.id));
        assert!(!metadata
            .folder_id_by_session_id
            .contains_key(&metadata_stable_key_for_session_id(
                "ws-1",
                "codex-descendant-real"
            )));

        std::fs::remove_dir_all(base).ok();
    }

    #[tokio::test]
    async fn session_folder_assignment_supports_same_workspace_and_root_fallback() {
        let base = std::env::temp_dir().join(format!("session-folder-assign-{}", Uuid::new_v4()));
        std::fs::create_dir_all(&base).expect("create temp dir");
        let storage_path = base.join("workspaces.json");
        std::fs::write(&storage_path, "[]").expect("seed storage path");
        let codex_home = base.join("codex-home");
        write_codex_session_fixture(&codex_home, "codex-1", "/tmp/ws-1");
        let workspace = workspace_with_codex_home("ws-1", "Workspace", "/tmp/ws-1", &codex_home);
        let workspaces = Mutex::new(HashMap::from([(workspace.id.clone(), workspace)]));
        let engine_manager = engine::EngineManager::new();

        let folder = create_workspace_session_folder_core(
            &workspaces,
            &storage_path,
            "ws-1".to_string(),
            "Bugs".to_string(),
            None,
        )
        .await
        .expect("create folder")
        .folder;

        let assigned = assign_workspace_session_folder_core(
            &workspaces,
            &engine_manager,
            &storage_path,
            "ws-1".to_string(),
            "codex-1".to_string(),
            Some(folder.id.clone()),
        )
        .await
        .expect("assign session");
        assert_eq!(assigned.folder_id.as_deref(), Some(folder.id.as_str()));

        let metadata = read_catalog_metadata(&storage_path, "ws-1").expect("read metadata");
        assert_eq!(
            metadata
                .folder_id_by_session_id
                .get(&metadata_stable_key_for_session_id("ws-1", "codex-1")),
            Some(&folder.id)
        );

        let root = assign_workspace_session_folder_core(
            &workspaces,
            &engine_manager,
            &storage_path,
            "ws-1".to_string(),
            "codex-1".to_string(),
            Some(SESSION_FOLDER_ROOT_ID.to_string()),
        )
        .await
        .expect("move to root");
        assert_eq!(root.folder_id, None);
        let metadata = read_catalog_metadata(&storage_path, "ws-1").expect("read metadata");
        assert!(!metadata.folder_id_by_session_id.contains_key("codex-1"));

        std::fs::remove_dir_all(base).ok();
    }

    #[tokio::test]
    async fn session_folder_assignment_accepts_session_beyond_first_owner_lookup_page() {
        let base = std::env::temp_dir().join(format!("session-folder-deep-owner-{}", Uuid::new_v4()));
        std::fs::create_dir_all(&base).expect("create temp dir");
        let storage_path = base.join("workspaces.json");
        std::fs::write(&storage_path, "[]").expect("seed storage path");
        let codex_home = base.join("codex-home");
        for index in 0..=205 {
            let timestamp = codex_fixture_timestamp(index);
            write_codex_session_fixture_with_message(
                &codex_home,
                &format!("codex-{index:03}"),
                "/tmp/ws-1",
                &timestamp,
                &timestamp,
                "Fixture session",
            );
        }
        let workspace = workspace_with_codex_home("ws-1", "Workspace", "/tmp/ws-1", &codex_home);
        let workspaces = Mutex::new(HashMap::from([(workspace.id.clone(), workspace)]));
        let engine_manager = engine::EngineManager::new();
        let folder = create_workspace_session_folder_core(
            &workspaces,
            &storage_path,
            "ws-1".to_string(),
            "Deep".to_string(),
            None,
        )
        .await
        .expect("create folder")
        .folder;

        let assigned = assign_workspace_session_folder_core(
            &workspaces,
            &engine_manager,
            &storage_path,
            "ws-1".to_string(),
            "codex-205".to_string(),
            Some(folder.id.clone()),
        )
        .await
        .expect("deep session still belongs to workspace");

        assert_eq!(assigned.folder_id.as_deref(), Some(folder.id.as_str()));
        std::fs::remove_dir_all(base).ok();
    }

    #[test]
    fn folder_assignment_is_applied_to_catalog_entries_by_owner_workspace() {
        let mut entry = catalog_entry("claude:1", "ws-1", Some("Workspace"), None);
        let metadata_by_workspace_id = HashMap::from([(
            "ws-1".to_string(),
            WorkspaceSessionCatalogMetadata {
                folder_id_by_session_id: HashMap::from([(
                    "claude:1".to_string(),
                    "folder-1".to_string(),
                )]),
                ..Default::default()
            },
        )]);

        apply_folder_assignment(&mut entry, &metadata_by_workspace_id);

        assert_eq!(entry.folder_id.as_deref(), Some("folder-1"));
    }

    #[test]
    fn codex_folder_assignment_accepts_raw_and_prefixed_session_keys() {
        let mut raw_entry = catalog_entry("codex-1", "ws-1", Some("Workspace"), None);
        raw_entry.engine = "codex".to_string();
        let mut prefixed_entry = catalog_entry("codex:codex-2", "ws-1", Some("Workspace"), None);
        prefixed_entry.engine = "codex".to_string();
        let metadata_by_workspace_id = HashMap::from([(
            "ws-1".to_string(),
            WorkspaceSessionCatalogMetadata {
                folder_id_by_session_id: HashMap::from([
                    ("codex:codex-1".to_string(), "folder-1".to_string()),
                    ("codex-2".to_string(), "folder-2".to_string()),
                ]),
                ..Default::default()
            },
        )]);

        apply_folder_assignment(&mut raw_entry, &metadata_by_workspace_id);
        apply_folder_assignment(&mut prefixed_entry, &metadata_by_workspace_id);

        assert_eq!(raw_entry.folder_id.as_deref(), Some("folder-1"));
        assert_eq!(prefixed_entry.folder_id.as_deref(), Some("folder-2"));
    }

    #[test]
    fn codex_folder_assignment_cleanup_removes_raw_and_prefixed_keys() {
        let mut metadata = WorkspaceSessionCatalogMetadata {
            folder_id_by_session_id: HashMap::from([
                ("codex-1".to_string(), "folder-raw".to_string()),
                ("codex:codex-1".to_string(), "folder-prefixed".to_string()),
                ("claude:1".to_string(), "folder-claude".to_string()),
            ]),
            ..Default::default()
        };

        remove_folder_assignment_for_session(&mut metadata, "ws-1", "codex-1", "codex");

        assert!(!metadata.folder_id_by_session_id.contains_key("codex-1"));
        assert!(!metadata
            .folder_id_by_session_id
            .contains_key("codex:codex-1"));
        assert!(metadata.folder_id_by_session_id.contains_key("claude:1"));
    }

    #[tokio::test]
    async fn archive_evidence_reads_metadata_without_catalog_scan_and_expands_stable_keys() {
        let base = std::env::temp_dir().join(format!("archive-evidence-{}", Uuid::new_v4()));
        std::fs::create_dir_all(&base).expect("create temp dir");
        let storage_path = base.join("workspaces.json");
        std::fs::write(&storage_path, "[]").expect("seed storage path");
        let workspace = workspace_entry("ws-1", "Workspace", "/tmp/ws-1", WorkspaceKind::Main, None);
        let workspaces = Mutex::new(HashMap::from([(workspace.id.clone(), workspace)]));
        with_catalog_metadata_mutation(&storage_path, "ws-1", |metadata| {
            metadata
                .archived_at_by_session_id
                .insert("claude:ws-1:session-1".to_string(), 123);
            metadata
                .archived_at_by_session_id
                .insert("codex:ws-1:codex-1".to_string(), 456);
            Ok(())
        })
        .expect("seed archive metadata");

        let evidence = list_workspace_session_archive_evidence_core(
            &workspaces,
            &storage_path,
            "ws-1".to_string(),
        )
        .await
        .expect("read archive evidence");

        assert_eq!(
            evidence.archived_at_by_session_id.get("claude:session-1"),
            Some(&123)
        );
        assert_eq!(
            evidence
                .archived_at_by_session_id
                .get("claude:ws-1:session-1"),
            Some(&123)
        );
        assert_eq!(
            evidence.archived_at_by_session_id.get("codex-1"),
            Some(&456)
        );
        assert_eq!(
            evidence.archived_at_by_session_id.get("codex:codex-1"),
            Some(&456)
        );
        assert_eq!(evidence.partial_source, None);
        assert_eq!(
            evidence.source_statuses[0].completeness,
            WorkspaceSessionSourceCompleteness::Complete
        );
        std::fs::remove_dir_all(base).ok();
    }

    #[tokio::test]
    async fn archive_evidence_reports_partial_when_metadata_unavailable() {
        let base = std::env::temp_dir().join(format!("archive-evidence-bad-{}", Uuid::new_v4()));
        std::fs::create_dir_all(&base).expect("create temp dir");
        let storage_path = base.join("workspaces.json");
        std::fs::write(&storage_path, "[]").expect("seed storage path");
        let metadata_path = catalog_metadata_path(&storage_path, "ws-1").expect("metadata path");
        std::fs::create_dir_all(metadata_path.parent().expect("metadata parent"))
            .expect("create metadata parent");
        std::fs::write(&metadata_path, "{not-json").expect("write corrupt metadata");
        let workspace = workspace_entry("ws-1", "Workspace", "/tmp/ws-1", WorkspaceKind::Main, None);
        let workspaces = Mutex::new(HashMap::from([(workspace.id.clone(), workspace)]));

        let evidence = list_workspace_session_archive_evidence_core(
            &workspaces,
            &storage_path,
            "ws-1".to_string(),
        )
        .await
        .expect("read degraded archive evidence");

        assert!(evidence.archived_at_by_session_id.is_empty());
        assert_eq!(
            evidence.partial_source.as_deref(),
            Some(SESSION_CATALOG_PARTIAL_ARCHIVE_METADATA)
        );
        assert_eq!(evidence.source_statuses.len(), 1);
        assert_eq!(evidence.source_statuses[0].engine, "archive-metadata");
        assert_eq!(
            evidence.source_statuses[0].completeness,
            WorkspaceSessionSourceCompleteness::Degraded
        );
        assert_eq!(
            evidence.source_statuses[0].reason.as_deref(),
            Some(SESSION_CATALOG_PARTIAL_ARCHIVE_METADATA)
        );
        std::fs::remove_dir_all(base).ok();
    }

    #[test]
    fn folder_sorting_is_deterministic_by_name_created_at_and_id() {
        let mut folders = vec![
            WorkspaceSessionFolder {
                id: "b".to_string(),
                workspace_id: "ws-1".to_string(),
                parent_id: None,
                name: "Zeta".to_string(),
                created_at: 1,
                updated_at: 1,
            },
            WorkspaceSessionFolder {
                id: "c".to_string(),
                workspace_id: "ws-1".to_string(),
                parent_id: None,
                name: "Alpha".to_string(),
                created_at: 2,
                updated_at: 2,
            },
            WorkspaceSessionFolder {
                id: "a".to_string(),
                workspace_id: "ws-1".to_string(),
                parent_id: None,
                name: "Alpha".to_string(),
                created_at: 1,
                updated_at: 1,
            },
        ];

        sort_workspace_session_folders(&mut folders);

        let ids: Vec<_> = folders.into_iter().map(|folder| folder.id).collect();
        assert_eq!(ids, vec!["a", "c", "b"]);
    }
