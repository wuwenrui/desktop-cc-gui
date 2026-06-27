use std::fs;
use std::path::PathBuf;

use serde_json::Value;

fn read_tauri_config() -> Value {
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let config_path = manifest_dir.join("tauri.conf.json");
    let config_contents = fs::read_to_string(&config_path)
        .unwrap_or_else(|error| panic!("Failed to read {config_path:?}: {error}"));
    serde_json::from_str(&config_contents)
        .unwrap_or_else(|error| panic!("Failed to parse tauri.conf.json: {error}"))
}

#[test]
fn macos_private_api_feature_matches_config() {
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let config = read_tauri_config();
    let macos_private_api = config
        .get("app")
        .and_then(|app| app.get("macOSPrivateApi"))
        .and_then(|value| value.as_bool())
        .unwrap_or(false);

    if macos_private_api {
        let cargo_path = manifest_dir.join("Cargo.toml");
        let cargo_contents = fs::read_to_string(&cargo_path)
            .unwrap_or_else(|error| panic!("Failed to read {cargo_path:?}: {error}"));
        let mut in_dependencies = false;
        let mut has_feature = false;

        for line in cargo_contents.lines() {
            let trimmed = line.trim();
            if trimmed.starts_with('[') {
                in_dependencies = trimmed == "[dependencies]";
                continue;
            }
            if !in_dependencies {
                continue;
            }
            if trimmed.starts_with("tauri") && trimmed.contains("macos-private-api") {
                has_feature = true;
                break;
            }
        }

        assert!(
            has_feature,
            "Cargo.toml [dependencies] must enable macos-private-api when app.macOSPrivateApi is true"
        );
    }
}

#[test]
fn curated_skill_resources_preserve_skill_directory_layout() {
    let config = read_tauri_config();
    let resources = config
        .pointer("/bundle/resources")
        .and_then(Value::as_object)
        .expect("bundle.resources must use object schema");

    assert_eq!(
        resources
            .get("resources/curated-skills")
            .and_then(Value::as_str),
        Some("curated-skills"),
        "curated skill resources must be mapped as a directory so Tauri preserves <skill-id>/ files",
    );
    assert!(
        !resources.contains_key("resources/curated-skills/**/*"),
        "glob map resources/curated-skills/**/* flattens skill directories in packaged clients",
    );
}
