    #[tokio::test]
    async fn session_folder_assignment_rejects_missing_target_without_rewriting_previous_assignment() {
        let base = std::env::temp_dir().join(format!("session-folder-missing-{}", Uuid::new_v4()));
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
        assign_workspace_session_folder_core(
            &workspaces,
            &engine_manager,
            &storage_path,
            "ws-1".to_string(),
            "codex-1".to_string(),
            Some(folder.id.clone()),
        )
        .await
        .expect("assign session");

        let error = assign_workspace_session_folder_core(
            &workspaces,
            &engine_manager,
            &storage_path,
            "ws-1".to_string(),
            "codex-1".to_string(),
            Some("missing-folder".to_string()),
        )
        .await
        .expect_err("missing folder must fail");
        assert_eq!(error, "target folder not found");

        let metadata = read_catalog_metadata(&storage_path, "ws-1").expect("read metadata");
        assert_eq!(
            metadata
                .folder_id_by_session_id
                .get(&metadata_stable_key_for_session_id("ws-1", "codex-1")),
            Some(&folder.id)
        );

        std::fs::remove_dir_all(base).ok();
    }

    #[tokio::test]
    async fn session_folder_assignment_rejects_folder_from_other_workspace() {
        let base = std::env::temp_dir().join(format!("session-folder-cross-{}", Uuid::new_v4()));
        std::fs::create_dir_all(&base).expect("create temp dir");
        let storage_path = base.join("workspaces.json");
        std::fs::write(&storage_path, "[]").expect("seed storage path");
        let codex_home_1 = base.join("codex-home-1");
        let codex_home_2 = base.join("codex-home-2");
        write_codex_session_fixture(&codex_home_1, "codex-1", "/tmp/ws-1");
        let ws_1 = workspace_with_codex_home("ws-1", "Workspace 1", "/tmp/ws-1", &codex_home_1);
        let ws_2 = workspace_with_codex_home("ws-2", "Workspace 2", "/tmp/ws-2", &codex_home_2);
        let workspaces = Mutex::new(HashMap::from([
            (ws_1.id.clone(), ws_1),
            (ws_2.id.clone(), ws_2),
        ]));
        let engine_manager = engine::EngineManager::new();
        let other_folder = create_workspace_session_folder_core(
            &workspaces,
            &storage_path,
            "ws-2".to_string(),
            "Other".to_string(),
            None,
        )
        .await
        .expect("create other workspace folder")
        .folder;

        let error = assign_workspace_session_folder_core(
            &workspaces,
            &engine_manager,
            &storage_path,
            "ws-1".to_string(),
            "codex-1".to_string(),
            Some(other_folder.id),
        )
        .await
        .expect_err("cross-workspace folder assignment must fail");

        assert_eq!(error, "target folder not found");
        std::fs::remove_dir_all(base).ok();
    }

    #[tokio::test]
    async fn session_folder_assignment_rejects_wrong_project_and_preserves_metadata() {
        let base = std::env::temp_dir().join(format!("session-folder-owner-{}", Uuid::new_v4()));
        std::fs::create_dir_all(&base).expect("create temp dir");
        let storage_path = base.join("workspaces.json");
        std::fs::write(&storage_path, "[]").expect("seed storage path");
        let codex_home_1 = base.join("codex-home-1");
        let codex_home_2 = base.join("codex-home-2");
        write_codex_session_fixture(&codex_home_2, "codex-other", "/tmp/ws-2");
        let ws_1 = workspace_with_codex_home("ws-1", "Workspace 1", "/tmp/ws-1", &codex_home_1);
        let ws_2 = workspace_with_codex_home("ws-2", "Workspace 2", "/tmp/ws-2", &codex_home_2);
        let workspaces = Mutex::new(HashMap::from([
            (ws_1.id.clone(), ws_1),
            (ws_2.id.clone(), ws_2),
        ]));
        let engine_manager = engine::EngineManager::new();
        let folder = create_workspace_session_folder_core(
            &workspaces,
            &storage_path,
            "ws-1".to_string(),
            "Target".to_string(),
            None,
        )
        .await
        .expect("create target folder")
        .folder;
        let preserved = WorkspaceSessionCatalogMetadata {
            archived_at_by_session_id: HashMap::from([("codex-keep".to_string(), 42)]),
            ..Default::default()
        };
        with_catalog_metadata_mutation(&storage_path, "ws-1", |metadata| {
            *metadata = preserved;
            Ok(())
        })
        .expect("seed metadata");

        let error = assign_workspace_session_folder_core(
            &workspaces,
            &engine_manager,
            &storage_path,
            "ws-1".to_string(),
            "codex-other".to_string(),
            Some(folder.id),
        )
        .await
        .expect_err("wrong-project session must fail");

        assert!(error.contains("Codex session target could not be resolved safely"));
        assert!(error.contains("provider-home source"));
        let metadata = read_catalog_metadata(&storage_path, "ws-1").expect("read metadata");
        assert_eq!(
            metadata
                .archived_at_by_session_id
                .get("codex-keep")
                .copied(),
            Some(42)
        );
        assert!(!metadata.folder_id_by_session_id.contains_key("codex-other"));

        std::fs::remove_dir_all(base).ok();
    }

    #[tokio::test]
    async fn session_folder_assignment_rejects_unresolved_session_owner_without_writing() {
        let base = std::env::temp_dir().join(format!("session-folder-unresolved-{}", Uuid::new_v4()));
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
            "Target".to_string(),
            None,
        )
        .await
        .expect("create target folder")
        .folder;

        let error = assign_workspace_session_folder_core(
            &workspaces,
            &engine_manager,
            &storage_path,
            "ws-1".to_string(),
            "codex-missing".to_string(),
            Some(folder.id),
        )
        .await
        .expect_err("unresolved session must fail");

        assert!(error.contains("Codex session target could not be resolved safely"));
        assert!(error.contains("provider-home source"));
        let metadata = read_catalog_metadata(&storage_path, "ws-1").expect("read metadata");
        assert!(!metadata
            .folder_id_by_session_id
            .contains_key("codex-missing"));

        std::fs::remove_dir_all(base).ok();
    }
