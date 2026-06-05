use std::collections::{BTreeMap, HashMap, HashSet};
use std::fs;
use std::io;
use std::path::{Component, Path, PathBuf};

use serde_json::json;
use sha2::{Digest, Sha256};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::State;
use uuid::Uuid;

use crate::app_paths;
use crate::state::AppState;
use crate::storage::{with_storage_lock, write_string_atomically};
use crate::types::WorkspaceEntry;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ProjectMapRelationshipReadResponse {
    storage_key: String,
    storage_dir: String,
    exists: bool,
    manifest: Option<Value>,
    profile: Option<Value>,
    run: Option<Value>,
    scan: Option<Value>,
    files_manifest: Option<Value>,
    files: Option<Value>,
    relations: Option<Value>,
    relations_by_file: Option<Value>,
    relations_by_type: Option<Value>,
    modules: Option<Value>,
    impact: Option<Value>,
    context_pack: Option<Value>,
    stale: Option<Value>,
    repair: Option<Value>,
    read_errors: Vec<ProjectMapRelationshipReadError>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ProjectMapRelationshipReadError {
    path: String,
    message: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ProjectMapRelationshipWriteFile {
    relative_path: String,
    content: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ProjectMapRelationshipScanOptions {
    max_files: Option<usize>,
    include_ignored_hints: Option<bool>,
    paths: Option<Vec<String>>,
    changed_files: Option<Vec<String>>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ProjectMapRelationshipScanResponse {
    storage_key: String,
    storage_dir: String,
    scan_run_id: String,
    generated_at: String,
    scanned_root: String,
    file_count: usize,
    relation_count: usize,
    ignored_count: usize,
    repair_issue_count: usize,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct ScannedFile {
    id: String,
    path: String,
    basename: String,
    extension: String,
    language: String,
    layer: String,
    role: String,
    size_bytes: u64,
    line_count: usize,
    content_hash: String,
    parse_status: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct RelationEvidence {
    path: String,
    line: usize,
    excerpt: String,
    extractor_version: String,
    observed_at: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct FileRelation {
    id: String,
    source_file_id: String,
    target_file_id: String,
    relation_type: String,
    #[serde(rename = "type")]
    type_alias: String,
    direction: String,
    confidence: String,
    source_kind: String,
    evidence: Vec<RelationEvidence>,
    fingerprint: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct RepairIssue {
    id: String,
    kind: String,
    severity: String,
    message: String,
    file_id: Option<String>,
    relation_id: Option<String>,
    path: Option<String>,
    action: String,
}

#[derive(Debug, Default, Serialize)]
#[serde(rename_all = "camelCase")]
struct FileRelationIndex {
    incoming: Vec<String>,
    outgoing: Vec<String>,
    tests: Vec<String>,
    specs: Vec<String>,
    styles: Vec<String>,
    bridge_targets: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ModuleSummary {
    id: String,
    label: String,
    file_ids: Vec<String>,
    file_count: usize,
    relation_count: usize,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct RelationshipSymbol {
    id: String,
    file_id: String,
    name: String,
    kind: String,
    language: String,
    line: usize,
}

fn sanitize_project_name(value: &str) -> String {
    let mut slug = String::new();
    for character in value.trim().chars() {
        if character.is_alphanumeric() || matches!(character, '.' | '_' | '-') {
            slug.push(character);
        } else if !slug.ends_with('-') {
            slug.push('-');
        }
        if slug.len() >= 60 {
            break;
        }
    }
    let trimmed = slug.trim_matches('-').to_string();
    if trimmed.is_empty() {
        "project".to_string()
    } else {
        trimmed
    }
}

fn hash_workspace_identity(value: &str) -> String {
    let mut hash: u32 = 0x811c9dc5;
    for byte in value.replace('\\', "/").to_lowercase().bytes() {
        hash ^= byte as u32;
        hash = hash.wrapping_mul(0x01000193);
    }
    format!("{hash:08x}")
}

fn relationship_storage_key(entry: &WorkspaceEntry) -> String {
    let slug = sanitize_project_name(&entry.name);
    let hash = hash_workspace_identity(&format!("{}#{}", entry.path, entry.id));
    format!("{slug}-{hash}")
}

async fn workspace_entry(state: &AppState, workspace_id: &str) -> Result<WorkspaceEntry, String> {
    let workspaces = state.workspaces.lock().await;
    workspaces
        .get(workspace_id)
        .cloned()
        .ok_or_else(|| format!("Workspace not found: {workspace_id}"))
}

fn relationship_root_for_mode(
    entry: &WorkspaceEntry,
    storage_mode: Option<&str>,
) -> Result<(String, PathBuf), String> {
    let key = relationship_storage_key(entry);
    let root = match storage_mode {
        Some(mode) if mode.eq_ignore_ascii_case("project") => PathBuf::from(&entry.path)
            .join(".ccgui")
            .join("project-map-relations"),
        Some(mode) if mode.eq_ignore_ascii_case("global") => {
            app_paths::app_home_dir()?.join("project-map-relations")
        }
        Some(mode) => {
            return Err(format!(
                "Invalid project map relationship storage mode: {mode}"
            ));
        }
        None => app_paths::app_home_dir()?.join("project-map-relations"),
    };

    Ok((key.clone(), root.join(key)))
}

fn is_windows_reserved_path_segment(value: &str) -> bool {
    let lower = value.to_ascii_lowercase();
    let stem = lower.split('.').next().unwrap_or(&lower);
    matches!(
        stem,
        "con"
            | "prn"
            | "aux"
            | "nul"
            | "com1"
            | "com2"
            | "com3"
            | "com4"
            | "com5"
            | "com6"
            | "com7"
            | "com8"
            | "com9"
            | "lpt1"
            | "lpt2"
            | "lpt3"
            | "lpt4"
            | "lpt5"
            | "lpt6"
            | "lpt7"
            | "lpt8"
            | "lpt9"
    )
}

fn is_safe_relationship_segment(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 64
        && value == value.to_ascii_lowercase()
        && !is_windows_reserved_path_segment(value)
        && !value.starts_with('.')
        && !value.starts_with('_')
        && !value.starts_with('-')
        && !value.ends_with('.')
        && !value.ends_with('_')
        && !value.ends_with('-')
        && value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'.' | b'_' | b'-'))
}

fn is_safe_json_file(value: &str) -> bool {
    let Some(stem) = value.strip_suffix(".json") else {
        return false;
    };
    is_safe_relationship_segment(stem)
}

fn is_chunk_json_file(value: &str) -> bool {
    let Some(stem) = value.strip_suffix(".json") else {
        return false;
    };
    stem.starts_with("chunks-") && is_safe_relationship_segment(stem)
}

fn validate_relative_relationship_path(path: &str) -> Result<PathBuf, String> {
    let normalized = path.trim().replace('\\', "/");
    if normalized.is_empty() {
        return Err("Project map relationship relative path cannot be empty.".to_string());
    }

    let candidate = Path::new(&normalized);
    let mut relative = PathBuf::new();
    let mut segments = Vec::new();
    for component in candidate.components() {
        match component {
            Component::Normal(segment) => {
                let Some(segment_text) = segment.to_str() else {
                    return Err("Invalid project map relationship relative path.".to_string());
                };
                segments.push(segment_text.to_string());
                relative.push(segment);
            }
            Component::ParentDir
            | Component::RootDir
            | Component::Prefix(_)
            | Component::CurDir => {
                return Err("Invalid project map relationship relative path.".to_string());
            }
        }
    }

    let allowed = match segments.as_slice() {
        [file] => matches!(file.as_str(), "manifest.json" | "profile.json"),
        [dir, file] if matches!(dir.as_str(), "runs" | "scans" | "modules" | "impact" | "repair") => {
            file == "latest.json"
        }
        [dir, file] if matches!(dir.as_str(), "files" | "symbols") => {
            file == "manifest.json" || is_chunk_json_file(file)
        }
        [dir, file] if dir == "relations" => {
            matches!(file.as_str(), "latest.json" | "by-file.json" | "by-type.json")
        }
        [dir, file] if dir == "context-packs" => file == "latest.json",
        [dir, file] if dir == "repair" => file == "latest.json",
        [dir, file] => is_safe_relationship_segment(dir) && is_safe_json_file(file),
        _ => false,
    };

    if !allowed {
        return Err("Project map relationship write path is outside the allowed contract.".to_string());
    }
    Ok(relative)
}

fn validate_relationship_snapshot_ownership(
    storage_key: &str,
    files: &[ProjectMapRelationshipWriteFile],
) -> Result<(), String> {
    let mut found_manifest = false;
    for file in files {
        let relative = validate_relative_relationship_path(&file.relative_path)?;
        if relative != PathBuf::from("manifest.json") {
            continue;
        }
        found_manifest = true;
        let manifest: Value = serde_json::from_str(&file.content)
            .map_err(|err| format!("Failed to parse project map relationship manifest: {err}"))?;
        let manifest_storage_key = manifest
            .get("storageKey")
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .ok_or_else(|| "Project map relationship manifest is missing storageKey.".to_string())?;
        if manifest_storage_key != storage_key {
            return Err(format!(
                "Project map relationship manifest ownership mismatch: expected {storage_key}, received {manifest_storage_key}."
            ));
        }
    }
    if !found_manifest {
        return Err("Project map relationship snapshot is missing manifest.json.".to_string());
    }
    Ok(())
}

fn atomic_write(path: &Path, content: &str) -> Result<(), String> {
    with_storage_lock(path, || {
        write_string_atomically(path, content)
            .map_err(|err| format!("Failed to commit project map relationship file: {err}"))
    })
}

fn backup_relationship_files(root: &Path) -> Result<(), String> {
    if !root.exists() {
        return Ok(());
    }

    let backup_root = root.join("backups").join(format!(
        "backup-{}",
        chrono::Utc::now().format("%Y%m%dT%H%M%SZ")
    ));
    for relative in [
        "manifest.json",
        "profile.json",
        "runs/latest.json",
        "scans/latest.json",
        "files/manifest.json",
        "symbols/manifest.json",
        "relations/latest.json",
        "relations/by-file.json",
        "relations/by-type.json",
        "modules/latest.json",
        "impact/latest.json",
        "context-packs/latest.json",
        "repair/latest.json",
    ] {
        let source = root.join(relative);
        if !source.is_file() {
            continue;
        }
        let target = backup_root.join(relative);
        if let Some(parent) = target.parent() {
            fs::create_dir_all(parent)
                .map_err(|err| format!("Failed to create relationship backup directory: {err}"))?;
        }
        fs::copy(&source, &target)
            .map_err(|err| format!("Failed to copy relationship backup file: {err}"))?;
    }
    Ok(())
}

fn write_relationship_snapshot_files(
    root: &Path,
    storage_key: &str,
    mut files: Vec<ProjectMapRelationshipWriteFile>,
    create_backup_snapshot: bool,
) -> Result<(), String> {
    validate_relationship_snapshot_ownership(storage_key, &files)?;
    files.sort_by_key(|file| file.relative_path == "manifest.json");

    with_storage_lock(root, || {
        fs::create_dir_all(root)
            .map_err(|err| format!("Failed to create project map relationship root: {err}"))?;

        if create_backup_snapshot {
            backup_relationship_files(root)?;
        }

        for file in files {
            let relative = validate_relative_relationship_path(&file.relative_path)?;
            let target = root.join(relative);
            if !target.starts_with(root) {
                return Err("Project map relationship write escaped the storage root.".to_string());
            }
            atomic_write(&target, &file.content)?;
        }

        Ok(())
    })
}

fn normalize_path(path: &Path) -> String {
    path.to_string_lossy().replace('\\', "/")
}

fn relative_path(root: &Path, path: &Path) -> Option<String> {
    path.strip_prefix(root).ok().map(normalize_path)
}

fn stable_hash(value: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(value.as_bytes());
    let digest = hasher.finalize();
    digest
        .iter()
        .take(8)
        .map(|byte| format!("{byte:02x}"))
        .collect()
}

fn content_hash(value: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(value.as_bytes());
    let digest = hasher.finalize();
    digest.iter().map(|byte| format!("{byte:02x}")).collect()
}

fn stable_file_id(path: &str) -> String {
    format!("file-{}", stable_hash(&path.to_ascii_lowercase()))
}

fn relation_id(source_file_id: &str, target_file_id: &str, relation_type: &str) -> String {
    let fingerprint = format!("{source_file_id}>{relation_type}>{target_file_id}");
    format!("rel-{}", stable_hash(&fingerprint))
}

fn is_builtin_ignored_path(path: &Path) -> bool {
    path.components().any(|component| {
        let Component::Normal(segment) = component else {
            return false;
        };
        let Some(segment) = segment.to_str() else {
            return false;
        };
        matches!(
            segment,
            ".git"
                | ".hg"
                | ".svn"
                | "node_modules"
                | "target"
                | "dist"
                | "build"
                | "out"
                | ".next"
                | ".turbo"
                | ".vite"
                | ".cache"
                | ".ccgui"
                | ".mossx"
                | ".codemoss"
        )
    })
}

fn is_manifest_path(path: &str) -> bool {
    let normalized = path.to_ascii_lowercase();
    let basename = normalized.rsplit('/').next().unwrap_or(&normalized);
    matches!(
        basename,
        "package.json"
            | "cargo.toml"
            | "pom.xml"
            | "build.gradle"
            | "build.gradle.kts"
            | "settings.gradle"
            | "settings.gradle.kts"
            | "go.mod"
            | "pyproject.toml"
            | "requirements.txt"
            | "composer.json"
            | "gemfile"
            | "package.swift"
            | "pubspec.yaml"
            | "pubspec.yml"
            | "dockerfile"
            | "docker-compose.yml"
            | "docker-compose.yaml"
            | "makefile"
            | "cmakelists.txt"
    ) || basename.starts_with("dockerfile")
        || basename.starts_with("makefile")
        || (basename.starts_with("requirements") && basename.ends_with(".txt"))
        || basename.ends_with(".csproj")
        || basename.ends_with(".sln")
        || basename.ends_with(".tf")
}

fn language_for_project_file(path: &str, extension: &str) -> &'static str {
    let normalized = path.to_ascii_lowercase();
    let basename = normalized.rsplit('/').next().unwrap_or(&normalized);
    if basename.starts_with("dockerfile") {
        return "dockerfile";
    }
    if basename.starts_with("makefile") {
        return "makefile";
    }
    if basename == "cmakelists.txt" {
        return "cmake";
    }
    match extension {
        "ts" | "tsx" => "typescript",
        "js" | "jsx" | "mjs" | "cjs" => "javascript",
        "rs" => "rust",
        "java" => "java",
        "kt" | "kts" => "kotlin",
        "py" => "python",
        "go" => "go",
        "cs" => "csharp",
        "php" => "php",
        "rb" => "ruby",
        "c" => "c",
        "cc" | "cpp" | "cxx" | "h" | "hpp" | "hh" => "cpp",
        "swift" => "swift",
        "dart" => "dart",
        "vue" => "vue",
        "svelte" => "svelte",
        "json" => "json",
        "toml" => "toml",
        "xml" => "xml",
        "yaml" | "yml" => "yaml",
        "properties" => "properties",
        "gradle" => "gradle",
        "tf" | "hcl" => "terraform",
        "sql" => "sql",
        "html" | "htm" => "html",
        "md" | "mdx" => "markdown",
        "css" | "scss" | "sass" | "less" => "css",
        "sh" | "bash" | "zsh" => "shell",
        "txt" => "text",
        _ => "unknown",
    }
}

fn should_read_project_text_file(path: &str, extension: &str) -> bool {
    !matches!(language_for_project_file(path, extension), "unknown")
}

fn classify_layer(path: &str, extension: &str) -> &'static str {
    let normalized = path.to_ascii_lowercase();
    if normalized.contains("/tests/")
        || normalized.contains("/test/")
        || normalized.ends_with(".test.ts")
        || normalized.ends_with(".test.tsx")
        || normalized.ends_with(".spec.ts")
        || normalized.ends_with(".spec.tsx")
        || normalized.ends_with("test.java")
        || normalized.ends_with("tests.java")
        || normalized.ends_with("_test.rs")
    {
        "test"
    } else if matches!(extension, "css" | "scss" | "sass" | "less") {
        "style"
    } else if normalized.starts_with("openspec/") || normalized.contains("/openspec/") {
        "spec"
    } else if normalized.starts_with("docs/") || matches!(extension, "md" | "mdx") {
        "docs"
    } else if normalized.starts_with("src-tauri/")
        || normalized.starts_with("src/main/java/")
        || normalized.contains("/server/")
        || normalized.contains("/api/")
        || matches!(extension, "rs" | "java" | "kt" | "kts" | "py" | "go" | "cs" | "php" | "rb")
    {
        "backend"
    } else if normalized.starts_with("src/")
        || matches!(extension, "ts" | "tsx" | "js" | "jsx" | "vue" | "svelte" | "html" | "htm")
    {
        "frontend"
    } else if is_manifest_path(&normalized)
        || matches!(
            extension,
            "json" | "toml" | "xml" | "yaml" | "yml" | "properties" | "gradle" | "tf" | "hcl" | "sql"
        )
    {
        "config"
    } else {
        "unknown"
    }
}

fn classify_role(path: &str, extension: &str) -> &'static str {
    let normalized = path.to_ascii_lowercase();
    if is_manifest_path(&normalized) {
        "manifest"
    } else if normalized.contains("/migrations/") || matches!(extension, "sql") {
        "migration"
    } else if matches!(extension, "tf" | "hcl") || normalized.rsplit('/').next().unwrap_or(&normalized).starts_with("dockerfile") {
        "infra"
    } else if normalized.ends_with(".test.ts")
        || normalized.ends_with(".test.tsx")
        || normalized.ends_with(".spec.ts")
        || normalized.ends_with(".spec.tsx")
        || normalized.ends_with("test.java")
        || normalized.ends_with("tests.java")
        || normalized.ends_with("_test.rs")
    {
        "test"
    } else if normalized.contains("/components/") || normalized.ends_with(".tsx") {
        "component"
    } else if normalized.contains("/hooks/") || normalized.contains("/use") {
        "hook"
    } else if normalized.contains("/services/") || normalized.contains("/service/") {
        "service"
    } else if normalized.contains("/controller/") || normalized.contains("/controllers/") {
        "controller"
    } else if normalized.contains("/repository/") || normalized.contains("/repositories/") {
        "repository"
    } else if normalized.contains("/entity/") || normalized.contains("/entities/") || normalized.contains("/model/") {
        "entity"
    } else if normalized.ends_with("types.ts") || normalized.ends_with("/types.rs") {
        "type"
    } else if matches!(extension, "css" | "scss" | "sass" | "less") {
        "style"
    } else if normalized.contains("commands.rs") || normalized.contains("command_registry.rs") {
        "command"
    } else if normalized.starts_with("openspec/") {
        "spec"
    } else if normalized.contains("/routes/") || normalized.contains("/router/") {
        "route"
    } else if matches!(
        extension,
        "json" | "toml" | "xml" | "yaml" | "yml" | "properties" | "gradle" | "tf" | "hcl"
    ) {
        "config"
    } else if matches!(extension, "md" | "mdx") {
        "document"
    } else if matches!(extension, "rs") {
        "module"
    } else {
        "unknown"
    }
}

fn module_label(path: &str) -> String {
    let segments = path.split('/').collect::<Vec<_>>();
    if segments.len() >= 3 && segments[0] == "src" && segments[1] == "features" {
        return format!("frontend:{}", segments[2]);
    }
    if segments.len() >= 3 && segments[0] == "src-tauri" && segments[1] == "src" {
        return format!("backend:{}", segments[2].trim_end_matches(".rs"));
    }
    segments.first().copied().unwrap_or("root").to_string()
}

fn first_quoted_value(text: &str) -> Option<String> {
    let mut chars = text.char_indices();
    while let Some((index, character)) = chars.next() {
        if character != '\'' && character != '"' {
            continue;
        }
        let quote = character;
        let start = index + quote.len_utf8();
        let end = text[start..].find(quote)?;
        return Some(text[start..start + end].to_string());
    }
    None
}

fn import_specifiers(line: &str) -> Vec<String> {
    let trimmed = line.trim();
    let mut specifiers = Vec::new();
    if (trimmed.starts_with("import ") || trimmed.starts_with("export "))
        && trimmed.contains(" from ")
    {
        if let Some(specifier) = first_quoted_value(trimmed.rsplit_once(" from ").map(|(_, tail)| tail).unwrap_or(trimmed)) {
            specifiers.push(specifier);
        }
    } else if trimmed.starts_with("import ") {
        if let Some(specifier) = first_quoted_value(trimmed.trim_start_matches("import").trim()) {
            specifiers.push(specifier);
        }
    }
    if let Some((_, tail)) = trimmed.split_once("import(") {
        if let Some(specifier) = first_quoted_value(tail) {
            specifiers.push(specifier);
        }
    }
    specifiers
}

fn java_import_specifier(line: &str) -> Option<String> {
    let trimmed = line.trim();
    let import_body = trimmed.strip_prefix("import ")?;
    let import_body = import_body
        .trim_start_matches("static ")
        .trim()
        .trim_end_matches(';')
        .trim();
    if import_body.is_empty() || import_body.ends_with(".*") {
        return None;
    }
    Some(import_body.to_string())
}

fn java_package_name(content: &str) -> Option<String> {
    content.lines().find_map(|line| {
        let trimmed = line.trim();
        trimmed
            .strip_prefix("package ")
            .map(str::trim)
            .map(|value| value.trim_end_matches(';').trim().to_string())
            .filter(|value| !value.is_empty())
    })
}

fn java_declared_type(content: &str) -> Option<String> {
    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("//") {
            continue;
        }
        let tokens = trimmed
            .split(|character: char| !character.is_ascii_alphanumeric() && character != '_')
            .filter(|token| !token.is_empty())
            .collect::<Vec<_>>();
        for (index, token) in tokens.iter().enumerate() {
            if matches!(*token, "class" | "interface" | "enum" | "record") {
                return tokens.get(index + 1).map(|value| (*value).to_string());
            }
        }
    }
    None
}

fn project_file_stem(basename: &str) -> String {
    basename
        .split('.')
        .next()
        .unwrap_or(basename)
        .to_ascii_lowercase()
}

fn parent_dir_text(path: &str) -> String {
    path.rsplit_once('/')
        .map(|(parent, _)| parent.to_string())
        .unwrap_or_default()
}

fn path_is_inside_dir(path: &str, directory: &str) -> bool {
    if directory.is_empty() {
        return true;
    }
    match path.strip_prefix(directory) {
        Some(tail) => tail.starts_with('/'),
        None => false,
    }
}

fn document_path_mentions(line: &str) -> Vec<String> {
    line.split(|character: char| {
        !(character.is_ascii_alphanumeric()
            || matches!(character, '.' | '_' | '-' | '/' | '\\'))
    })
    .map(|token| token.trim_matches(|character| matches!(character, '.' | ',' | ';' | ':' | ')' | ']' | '}')))
    .map(|token| token.replace('\\', "/"))
    .filter(|token| token.contains('.') || token.contains('/'))
    .filter(|token| token.len() >= 4)
    .collect()
}

fn rust_fn_name(line: &str) -> Option<String> {
    let mut trimmed = line.trim();
    trimmed = trimmed.strip_prefix("pub(crate) ").unwrap_or(trimmed);
    trimmed = trimmed.strip_prefix("pub(super) ").unwrap_or(trimmed);
    trimmed = trimmed.strip_prefix("pub ").unwrap_or(trimmed);
    trimmed = trimmed.strip_prefix("async ").unwrap_or(trimmed);
    let fn_tail = trimmed.strip_prefix("fn ")?;
    let name = fn_tail
        .chars()
        .take_while(|character| character.is_ascii_alphanumeric() || *character == '_')
        .collect::<String>();
    if name.is_empty() {
        None
    } else {
        Some(name)
    }
}

fn tauri_command_names(content: &str) -> Vec<String> {
    let mut names = Vec::new();
    let mut waiting_for_fn = false;
    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("#[tauri::command") {
            waiting_for_fn = true;
            continue;
        }
        if !waiting_for_fn {
            continue;
        }
        if let Some(name) = rust_fn_name(trimmed) {
            names.push(name);
            waiting_for_fn = false;
            continue;
        }
        if !trimmed.is_empty() && !trimmed.starts_with("#[") {
            waiting_for_fn = false;
        }
    }
    names
}

fn rust_use_roots(line: &str) -> Vec<String> {
    let trimmed = line.trim();
    let Some(use_body) = trimmed.strip_prefix("use ") else {
        return Vec::new();
    };
    let use_body = use_body.trim_end_matches(';').trim();
    let mut roots = Vec::new();
    for prefix in ["crate::", "super::", "self::"] {
        if let Some(rest) = use_body.strip_prefix(prefix) {
            let module_root = rest
                .split(|character: char| {
                    matches!(character, ':' | '{' | ',' | ';' | ' ' | '\t' | '\n' | '\r')
                })
                .next()
                .unwrap_or("")
                .trim();
            if !module_root.is_empty()
                && module_root
                    .chars()
                    .all(|character| character.is_ascii_alphanumeric() || character == '_')
            {
                roots.push(format!("{prefix}{module_root}"));
            }
        }
    }
    roots
}

fn rust_mod_specifier(line: &str) -> Option<String> {
    let trimmed = line.trim();
    let trimmed = trimmed.strip_prefix("pub ").unwrap_or(trimmed);
    let trimmed = trimmed.strip_prefix("mod ")?;
    let name = trimmed.trim_end_matches(';').trim();
    if name
        .chars()
        .all(|character| character.is_ascii_alphanumeric() || character == '_')
    {
        Some(name.to_string())
    } else {
        None
    }
}

fn normalized_candidate(root: &Path, candidate: PathBuf) -> Option<String> {
    let absolute = if candidate.is_absolute() {
        candidate
    } else {
        root.join(candidate)
    };
    let mut normalized = PathBuf::new();
    for component in absolute.components() {
        match component {
            Component::Prefix(prefix) => normalized.push(prefix.as_os_str()),
            Component::RootDir => normalized.push(component.as_os_str()),
            Component::CurDir => {}
            Component::Normal(segment) => normalized.push(segment),
            Component::ParentDir => {
                if !normalized.pop() {
                    return None;
                }
            }
        }
    }
    relative_path(root, &normalized)
}

fn resolve_relative_import(
    root: &Path,
    source_path: &str,
    specifier: &str,
    path_to_file_id: &HashMap<String, String>,
) -> Option<String> {
    if !specifier.starts_with('.') {
        return None;
    }
    let base = Path::new(source_path)
        .parent()
        .map(Path::to_path_buf)
        .unwrap_or_default();
    let raw = base.join(specifier);
    let mut candidates = Vec::new();
    candidates.push(raw.clone());
    for extension in [
        "ts", "tsx", "js", "jsx", "mjs", "cjs", "json", "css", "rs", "vue",
        "svelte", "py", "go", "java", "kt", "c", "cc", "cpp", "cxx", "h", "hpp",
    ] {
        candidates.push(raw.with_extension(extension));
    }
    for index_file in [
        "index.ts",
        "index.tsx",
        "index.js",
        "index.jsx",
        "index.vue",
        "index.svelte",
        "__init__.py",
        "mod.rs",
    ] {
        candidates.push(raw.join(index_file));
    }
    candidates
        .into_iter()
        .filter_map(|candidate| normalized_candidate(root, root.join(candidate)))
        .find(|candidate| path_to_file_id.contains_key(candidate))
}

fn resolve_rust_mod(
    root: &Path,
    source_path: &str,
    module_name: &str,
    path_to_file_id: &HashMap<String, String>,
) -> Option<String> {
    let base = Path::new(source_path)
        .parent()
        .map(Path::to_path_buf)
        .unwrap_or_default();
    [base.join(format!("{module_name}.rs")), base.join(module_name).join("mod.rs")]
        .into_iter()
        .filter_map(|candidate| normalized_candidate(root, root.join(candidate)))
        .find(|candidate| path_to_file_id.contains_key(candidate))
}

fn rust_crate_root(source_path: &str) -> PathBuf {
    if source_path.starts_with("src-tauri/src/") {
        PathBuf::from("src-tauri/src")
    } else {
        Path::new(source_path)
            .parent()
            .map(Path::to_path_buf)
            .unwrap_or_default()
    }
}

fn rust_super_root(source_path: &str) -> PathBuf {
    let parent = Path::new(source_path)
        .parent()
        .map(Path::to_path_buf)
        .unwrap_or_default();
    if source_path.ends_with("/mod.rs") {
        parent.parent().map(Path::to_path_buf).unwrap_or(parent)
    } else {
        parent
            .parent()
            .map(Path::to_path_buf)
            .unwrap_or_else(|| rust_crate_root(source_path))
    }
}

fn resolve_rust_use(
    root: &Path,
    source_path: &str,
    specifier: &str,
    path_to_file_id: &HashMap<String, String>,
) -> Option<String> {
    let (base, module_name) = if let Some(module_name) = specifier.strip_prefix("crate::") {
        (rust_crate_root(source_path), module_name)
    } else if let Some(module_name) = specifier.strip_prefix("super::") {
        (rust_super_root(source_path), module_name)
    } else if let Some(module_name) = specifier.strip_prefix("self::") {
        (
            Path::new(source_path)
                .parent()
                .map(Path::to_path_buf)
                .unwrap_or_default(),
            module_name,
        )
    } else {
        return None;
    };

    [
        base.join(format!("{module_name}.rs")),
        base.join(module_name).join("mod.rs"),
    ]
    .into_iter()
    .filter_map(|candidate| normalized_candidate(root, root.join(candidate)))
    .find(|candidate| path_to_file_id.contains_key(candidate))
}

fn resolve_java_import(
    import_name: &str,
    java_file_by_type: &HashMap<String, String>,
) -> Option<String> {
    java_file_by_type.get(import_name).cloned()
}

fn canonical_symbol_key(value: &str) -> String {
    value
        .chars()
        .filter(|character| character.is_ascii_alphanumeric() || *character == '_')
        .flat_map(|character| character.to_lowercase())
        .collect()
}

fn symbol_name_after_keyword(line: &str, keyword: &str) -> Option<String> {
    let (_, tail) = line.split_once(keyword)?;
    let candidate = tail.trim_start_matches(|character: char| {
        character.is_whitespace() || matches!(character, '*' | '&' | '<')
    });
    let name = candidate
        .chars()
        .take_while(|character| character.is_ascii_alphanumeric() || *character == '_')
        .collect::<String>();
    if name.is_empty() { None } else { Some(name) }
}

fn declaration_name_before_paren(line: &str) -> Option<String> {
    let paren_index = line.find('(')?;
    let before = line[..paren_index].trim_end();
    let name = before
        .chars()
        .rev()
        .take_while(|character| character.is_ascii_alphanumeric() || *character == '_')
        .collect::<String>()
        .chars()
        .rev()
        .collect::<String>();
    if name.is_empty() || is_call_keyword(&name) {
        None
    } else {
        Some(name)
    }
}

fn declared_symbol_name_for_line(line: &str, language: &str) -> Option<(String, &'static str)> {
    let trimmed = line.trim();
    if trimmed.is_empty()
        || trimmed.starts_with("//")
        || trimmed.starts_with('#')
        || trimmed.starts_with('*')
        || trimmed.starts_with("/*")
    {
        return None;
    }
    for keyword in ["class ", "interface ", "enum ", "record ", "struct ", "trait "] {
        if let Some(name) = symbol_name_after_keyword(trimmed, keyword) {
            return Some((name, "type"));
        }
    }
    if matches!(language, "typescript" | "javascript" | "vue" | "svelte") {
        if let Some(name) = symbol_name_after_keyword(trimmed, "function ") {
            return Some((name, "function"));
        }
        for keyword in ["const ", "let ", "var "] {
            if let Some(name) = symbol_name_after_keyword(trimmed, keyword) {
                if trimmed.contains("=>") || trimmed.contains("function") || trimmed.contains('(') {
                    return Some((name, "function"));
                }
            }
        }
    }
    if language == "python" {
        if let Some(name) = symbol_name_after_keyword(trimmed, "def ") {
            return Some((name, "function"));
        }
    }
    if language == "go" {
        if let Some(after_func) = trimmed.strip_prefix("func ") {
            let function_tail = if after_func.trim_start().starts_with('(') {
                after_func.split_once(')').map(|(_, tail)| tail.trim_start()).unwrap_or(after_func)
            } else {
                after_func
            };
            let name = function_tail
                .chars()
                .take_while(|character| character.is_ascii_alphanumeric() || *character == '_')
                .collect::<String>();
            if !name.is_empty() {
                return Some((name, "function"));
            }
        }
    }
    if language == "rust" {
        if let Some(name) = rust_fn_name(trimmed) {
            return Some((name, "function"));
        }
    }
    if matches!(language, "c" | "cpp" | "csharp" | "java" | "kotlin" | "swift" | "php" | "ruby") {
        if let Some(name) = declaration_name_before_paren(trimmed) {
            if trimmed.ends_with('{') || trimmed.ends_with(';') || trimmed.contains(" throws ") {
                return Some((name, "function"));
            }
        }
    }
    None
}

fn relationship_symbols_for_file(file: &ScannedFile, content: &str) -> Vec<RelationshipSymbol> {
    let mut symbols = Vec::new();
    let mut seen = HashSet::new();
    for (line_index, line) in content.lines().enumerate() {
        let Some((name, kind)) = declared_symbol_name_for_line(line, &file.language) else {
            continue;
        };
        let key = format!("{}:{name}:{kind}", file.id);
        if !seen.insert(key.clone()) {
            continue;
        }
        symbols.push(RelationshipSymbol {
            id: format!("sym-{}", stable_hash(&key)),
            file_id: file.id.clone(),
            name,
            kind: kind.to_string(),
            language: file.language.clone(),
            line: line_index + 1,
        });
    }
    symbols
}

fn insert_symbol_alias(index: &mut HashMap<String, String>, alias: &str, file_id: &str) {
    let key = canonical_symbol_key(alias);
    if !key.is_empty() {
        index.entry(key).or_insert_with(|| file_id.to_string());
    }
}

fn build_symbol_file_index(files: &[ScannedFile], symbols: &[RelationshipSymbol]) -> HashMap<String, String> {
    let mut index = HashMap::new();
    for file in files {
        let stem = project_file_stem(&file.basename);
        insert_symbol_alias(&mut index, &stem, &file.id);
        insert_symbol_alias(&mut index, &file.basename, &file.id);
        if stem.ends_with("serviceimpl") {
            insert_symbol_alias(&mut index, stem.trim_end_matches("impl"), &file.id);
        }
    }
    for symbol in symbols {
        insert_symbol_alias(&mut index, &symbol.name, &symbol.file_id);
    }
    index
}

fn is_call_keyword(value: &str) -> bool {
    matches!(
        value,
        "if" | "for" | "while" | "switch" | "catch" | "return" | "throw" | "new" |
        "sizeof" | "typeof" | "await" | "async" | "function" | "fn" | "def" | "func" |
        "class" | "interface" | "struct" | "enum" | "record" | "match" | "loop" | "select"
    )
}

fn call_candidates_for_line(line: &str) -> Vec<String> {
    let code = line
        .split("//")
        .next()
        .unwrap_or(line)
        .split('#')
        .next()
        .unwrap_or(line);
    let characters = code.char_indices().collect::<Vec<_>>();
    let mut candidates = Vec::new();
    for (index, character) in &characters {
        if *character != '(' {
            continue;
        }
        let before = code[..*index].trim_end();
        let token = before
            .chars()
            .rev()
            .take_while(|character| {
                character.is_ascii_alphanumeric()
                    || matches!(*character, '_' | '.' | ':' | '-' | '>')
            })
            .collect::<String>()
            .chars()
            .rev()
            .collect::<String>();
        let token = token.trim_matches(|character| matches!(character, '.' | ':' | '-' | '>'));
        if token.is_empty() || token.len() < 3 || is_call_keyword(token) {
            continue;
        }
        if token.contains('.') || token.contains("::") || token.contains("->") || token.contains('_') {
            candidates.push(token.to_string());
            continue;
        }
        if token.chars().next().is_some_and(|character| character.is_ascii_uppercase()) {
            candidates.push(token.to_string());
        }
    }
    candidates.sort();
    candidates.dedup();
    candidates
}

fn call_candidate_keys(candidate: &str) -> Vec<String> {
    let normalized = candidate.replace("->", ".").replace("::", ".");
    let mut keys = Vec::new();
    keys.push(canonical_symbol_key(&normalized));
    for part in normalized.split('.') {
        if part.len() >= 3 {
            keys.push(canonical_symbol_key(part));
        }
    }
    if let Some((prefix, _)) = normalized.split_once('_') {
        if prefix.len() >= 3 {
            keys.push(canonical_symbol_key(prefix));
        }
    }
    keys.retain(|key| !key.is_empty());
    keys.dedup();
    keys
}

fn resolve_call_target(
    candidate: &str,
    source_file_id: &str,
    symbol_file_by_key: &HashMap<String, String>,
) -> Option<String> {
    for key in call_candidate_keys(candidate) {
        let Some(target_file_id) = symbol_file_by_key.get(&key) else {
            continue;
        };
        if target_file_id != source_file_id {
            return Some(target_file_id.clone());
        }
    }
    None
}

fn c_include_specifier(line: &str) -> Option<String> {
    let trimmed = line.trim();
    if !trimmed.starts_with("#include") {
        return None;
    }
    first_quoted_value(trimmed)
}

fn python_import_specifiers(line: &str) -> Vec<String> {
    let trimmed = line.trim();
    if let Some(rest) = trimmed.strip_prefix("from ") {
        return rest
            .split_whitespace()
            .next()
            .filter(|value| !value.is_empty())
            .map(|value| vec![value.to_string()])
            .unwrap_or_default();
    }
    if let Some(rest) = trimmed.strip_prefix("import ") {
        return rest
            .split(',')
            .filter_map(|value| value.trim().split_whitespace().next())
            .filter(|value| !value.is_empty())
            .map(str::to_string)
            .collect();
    }
    Vec::new()
}

fn resolve_python_import(
    root: &Path,
    source_path: &str,
    specifier: &str,
    path_to_file_id: &HashMap<String, String>,
) -> Option<String> {
    let mut base = Path::new(source_path)
        .parent()
        .map(Path::to_path_buf)
        .unwrap_or_default();
    let mut rest = specifier.trim();
    while let Some(next) = rest.strip_prefix('.') {
        rest = next;
        base = base.parent().map(Path::to_path_buf).unwrap_or_default();
    }
    if rest.is_empty() {
        return None;
    }
    let module_path = rest.replace('.', "/");
    [
        base.join(&module_path).with_extension("py"),
        base.join(&module_path).join("__init__.py"),
    ]
    .into_iter()
    .filter_map(|candidate| normalized_candidate(root, root.join(candidate)))
    .find(|candidate| path_to_file_id.contains_key(candidate))
}

fn evidence(path: &str, line: usize, excerpt: &str, observed_at: &str) -> RelationEvidence {
    RelationEvidence {
        path: path.to_string(),
        line,
        excerpt: excerpt.trim().chars().take(180).collect(),
        extractor_version: "project-map-relations-v1".to_string(),
        observed_at: observed_at.to_string(),
    }
}

fn push_relation(
    relations: &mut Vec<FileRelation>,
    relation_type: &str,
    source_file_id: &str,
    target_file_id: &str,
    confidence: &str,
    evidence: RelationEvidence,
) {
    let fingerprint = format!("{source_file_id}>{relation_type}>{target_file_id}");
    relations.push(FileRelation {
        id: relation_id(source_file_id, target_file_id, relation_type),
        source_file_id: source_file_id.to_string(),
        target_file_id: target_file_id.to_string(),
        relation_type: relation_type.to_string(),
        type_alias: relation_type.to_string(),
        direction: "forward".to_string(),
        confidence: confidence.to_string(),
        source_kind: "deterministic".to_string(),
        evidence: vec![evidence],
        fingerprint,
    });
}

fn dedupe_relations(relations: Vec<FileRelation>) -> (Vec<FileRelation>, Vec<RepairIssue>) {
    let mut seen = HashSet::new();
    let mut deduped = Vec::new();
    let mut issues = Vec::new();
    for relation in relations {
        if seen.insert(relation.fingerprint.clone()) {
            deduped.push(relation);
            continue;
        }
        issues.push(RepairIssue {
            id: format!("repair-{}", stable_hash(&relation.fingerprint)),
            kind: "duplicate-relation".to_string(),
            severity: "info".to_string(),
            message: "Duplicate deterministic relationship was quarantined.".to_string(),
            file_id: Some(relation.source_file_id.clone()),
            relation_id: Some(relation.id.clone()),
            path: relation.evidence.first().map(|item| item.path.clone()),
            action: "quarantined".to_string(),
        });
    }
    (deduped, issues)
}

fn build_indexes(
    files: &[ScannedFile],
    relations: &[FileRelation],
) -> (BTreeMap<String, FileRelationIndex>, BTreeMap<String, Vec<String>>, Vec<Value>, Vec<ModuleSummary>) {
    let mut by_file = BTreeMap::new();
    for file in files {
        by_file.insert(file.id.clone(), FileRelationIndex::default());
    }

    let mut by_type: BTreeMap<String, Vec<String>> = BTreeMap::new();
    let mut relation_count_by_file: HashMap<String, usize> = HashMap::new();
    for relation in relations {
        by_type
            .entry(relation.relation_type.clone())
            .or_default()
            .push(relation.id.clone());
        if let Some(source) = by_file.get_mut(&relation.source_file_id) {
            source.outgoing.push(relation.id.clone());
            match relation.relation_type.as_str() {
                "tested_by" => source.tests.push(relation.target_file_id.clone()),
                "styled_by" => source.styles.push(relation.target_file_id.clone()),
                "specified_by" => source.specs.push(relation.target_file_id.clone()),
                "bridges_to" => source.bridge_targets.push(relation.target_file_id.clone()),
                _ => {}
            }
        }
        if let Some(target) = by_file.get_mut(&relation.target_file_id) {
            target.incoming.push(relation.id.clone());
        }
        *relation_count_by_file
            .entry(relation.source_file_id.clone())
            .or_default() += 1;
        *relation_count_by_file
            .entry(relation.target_file_id.clone())
            .or_default() += 1;
    }

    let mut hotspot_entries = relation_count_by_file
        .iter()
        .filter(|(_, count)| **count >= 6)
        .collect::<Vec<_>>();
    hotspot_entries.sort_by(|(left_file_id, left_count), (right_file_id, right_count)| {
        right_count
            .cmp(left_count)
            .then_with(|| left_file_id.cmp(right_file_id))
    });
    let hotspots = hotspot_entries
        .into_iter()
        .map(|(file_id, count)| {
            json!({
                "fileId": file_id,
                "reason": "many-dependents",
                "score": count,
                "rationale": "File participates in many deterministic relationships."
            })
        })
        .collect::<Vec<_>>();

    let mut modules: BTreeMap<String, Vec<String>> = BTreeMap::new();
    for file in files {
        modules
            .entry(module_label(&file.path))
            .or_default()
            .push(file.id.clone());
    }
    let module_summaries = modules
        .into_iter()
        .map(|(label, file_ids)| {
            let relation_count = relations
                .iter()
                .filter(|relation| {
                    file_ids.contains(&relation.source_file_id)
                        || file_ids.contains(&relation.target_file_id)
                })
                .count();
            ModuleSummary {
                id: format!("module-{}", stable_hash(&label)),
                label,
                file_count: file_ids.len(),
                file_ids,
                relation_count,
            }
        })
        .collect::<Vec<_>>();

    (by_file, by_type, hotspots, module_summaries)
}

fn git_metadata(root: &Path) -> (Option<String>, Option<String>) {
    let Ok(repository) = git2::Repository::discover(root) else {
        return (None, None);
    };
    let git_common_root = repository
        .path()
        .parent()
        .map(|path| path.to_string_lossy().to_string());
    let git_commit_hash = repository
        .head()
        .ok()
        .and_then(|head| head.target())
        .map(|oid| oid.to_string());
    (git_common_root, git_commit_hash)
}

fn git_status_changed_paths(root: &Path) -> Vec<String> {
    let Ok(repository) = git2::Repository::discover(root) else {
        return Vec::new();
    };
    let Some(workdir) = repository.workdir() else {
        return Vec::new();
    };
    let mut options = git2::StatusOptions::new();
    options.include_untracked(true).recurse_untracked_dirs(true);
    let Ok(statuses) = repository.statuses(Some(&mut options)) else {
        return Vec::new();
    };

    let mut changed_paths = Vec::new();
    for status in statuses.iter() {
        if status.status().contains(git2::Status::IGNORED) {
            continue;
        }
        let Some(relative_to_workdir) = status.path() else {
            continue;
        };
        let absolute_path = workdir.join(relative_to_workdir);
        if let Some(relative_to_scan_root) = relative_path(root, &absolute_path) {
            changed_paths.push(relative_to_scan_root);
        }
    }
    changed_paths.sort();
    changed_paths.dedup();
    changed_paths
}

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

fn file_has_test_relation(file_id: &str, relations: &[FileRelation], file_by_id: &HashMap<String, &ScannedFile>) -> bool {
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

fn build_relationship_impact_and_context(
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
        if !changed_file_id_set.contains(adjacent) && directly_affected_set.insert(adjacent.clone()) {
            directly_affected_ids.push(adjacent.clone());
        }
    }

    let direct_set = directly_affected_ids.iter().cloned().collect::<HashSet<_>>();
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
                .map(|file| format!("Hotspot participates in current change scope: {}", file.path))
                .unwrap_or_else(|| format!("Hotspot participates in current change scope: {file_id}"));
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
        if matches!(file.role.as_str(), "test" | "document" | "manifest" | "config" | "style") {
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
        for file in files.iter().filter(|file| matches!(file.role.as_str(), "controller" | "route" | "service" | "hook" | "component")).take(10) {
            push_unique_id(&mut must_read_ids, &file.id);
        }
    }

    let mut related_ids = Vec::new();
    for file_id in directly_affected_ids.iter().chain(transitive_affected_ids.iter()) {
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
        if !(read_scope.contains(&relation.source_file_id) || read_scope.contains(&relation.target_file_id)) {
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
        if matches!(relation.relation_type.as_str(), "specified_by" | "documents" | "configures") {
            push_unique_id(&mut contract_ids, &relation.source_file_id);
            push_unique_id(&mut contract_ids, &relation.target_file_id);
        }
    }
    for file in files.iter().filter(|file| matches!(file.role.as_str(), "manifest" | "config" | "document")).take(12) {
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

const IGNORED_HINT_LIMIT: usize = 500;

fn push_ignored_hint(ignored_paths: &mut Vec<Value>, hint: Value) {
    if ignored_paths.len() < IGNORED_HINT_LIMIT {
        ignored_paths.push(hint);
    }
}

fn normalize_requested_scan_path(value: &str) -> Option<String> {
    let trimmed = value.trim().replace('\\', "/");
    if trimmed.is_empty() || trimmed.starts_with('/') {
        return None;
    }
    let mut segments = Vec::new();
    for segment in trimmed.split('/') {
        if segment.is_empty() || segment == "." {
            continue;
        }
        if segment == ".." {
            segments.pop()?;
            continue;
        }
        segments.push(segment);
    }
    if segments.is_empty() {
        None
    } else {
        Some(segments.join("/"))
    }
}

fn relative_matches_requested_path(relative: &str, requested: &str) -> bool {
    if relative == requested {
        return true;
    }
    match relative.strip_prefix(requested) {
        Some(tail) => tail.starts_with('/'),
        None => false,
    }
}

fn read_json_with_errors(
    root: &Path,
    relative_path: &str,
    read_errors: &mut Vec<ProjectMapRelationshipReadError>,
) -> Option<Value> {
    let target = root.join(relative_path);
    match fs::read_to_string(&target) {
        Ok(raw) => match serde_json::from_str(&raw) {
            Ok(value) => Some(value),
            Err(error) => {
                read_errors.push(ProjectMapRelationshipReadError {
                    path: relative_path.to_string(),
                    message: format!("Failed to parse project map relationship artifact: {error}"),
                });
                None
            }
        },
        Err(error) if error.kind() == io::ErrorKind::NotFound => None,
        Err(error) => {
            read_errors.push(ProjectMapRelationshipReadError {
                path: relative_path.to_string(),
                message: format!("Failed to read project map relationship artifact: {error}"),
            });
            None
        }
    }
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

fn summarize_relationship_stale_state(
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
    let all_reasons = reasons.into_iter().chain(scope_warnings).collect::<Vec<_>>();

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

fn enrich_context_pack_with_stale_state(
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
    object.insert("staleReason".to_string(), Value::String(stale_reason.to_string()));
    object.insert(
        "staleReasons".to_string(),
        stale
            .get("reasons")
            .cloned()
            .unwrap_or_else(|| Value::Array(Vec::new())),
    );
    Some(context_pack)
}

fn scan_workspace(
    entry: &WorkspaceEntry,
    storage_key: &str,
    storage_root: &Path,
    options: ProjectMapRelationshipScanOptions,
) -> Result<ProjectMapRelationshipScanResponse, String> {
    let scan_root = PathBuf::from(&entry.path);
    if !scan_root.is_dir() {
        return Err(format!(
            "Project map relationship scan root is not a directory: {}",
            scan_root.display()
        ));
    }

    let generated_at = chrono::Utc::now().to_rfc3339();
    let scan_run_id = format!("relationship-scan-{}", Uuid::new_v4());
    let max_files = options.max_files.unwrap_or(10_000);
    let include_ignored_hints = options.include_ignored_hints.unwrap_or(true);
    let requested_paths = options
        .paths
        .unwrap_or_default()
        .into_iter()
        .filter_map(|path| normalize_requested_scan_path(&path))
        .collect::<Vec<_>>();
    let explicit_changed_paths = options
        .changed_files
        .as_ref()
        .map(|paths| {
            paths
                .iter()
                .filter_map(|path| normalize_requested_scan_path(path))
                .collect::<Vec<_>>()
        });

    let mut files = Vec::new();
    let mut file_contents = Vec::new();
    let mut ignored_paths = Vec::new();
    let mut repair_issues = Vec::new();
    let mut walker_builder = ignore::WalkBuilder::new(&scan_root);
    walker_builder.hidden(false).git_ignore(true).git_global(true).git_exclude(true);
    let walker = walker_builder
        .filter_entry(|entry| !is_builtin_ignored_path(entry.path()))
        .build();

    for entry_result in walker {
        let entry = match entry_result {
            Ok(entry) => entry,
            Err(error) => {
                if include_ignored_hints {
                    push_ignored_hint(&mut ignored_paths, json!({
                        "path": null,
                        "reason": error.to_string(),
                        "source": "walker-error"
                    }));
                }
                continue;
            }
        };
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let Some(relative) = relative_path(&scan_root, path) else {
            continue;
        };
        if !requested_paths.is_empty()
            && !requested_paths
                .iter()
                .any(|requested| relative_matches_requested_path(&relative, requested))
        {
            continue;
        }
        let extension = path
            .extension()
            .and_then(|value| value.to_str())
            .unwrap_or("")
            .to_ascii_lowercase();
        if files.len() >= max_files {
            if include_ignored_hints {
                push_ignored_hint(&mut ignored_paths, json!({
                    "path": relative,
                    "reason": format!("maxFiles limit reached: {max_files}"),
                    "source": "scanner-limit"
                }));
            }
            break;
        }

        let metadata = fs::metadata(path)
            .map_err(|err| format!("Failed to read metadata for {}: {err}", path.display()))?;
        let basename = path
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or("")
            .to_string();
        let language = language_for_project_file(&relative, &extension).to_string();
        if !should_read_project_text_file(&relative, &extension) {
            files.push(ScannedFile {
                id: stable_file_id(&relative),
                path: relative.clone(),
                basename,
                extension: extension.clone(),
                language,
                layer: classify_layer(&relative, &extension).to_string(),
                role: classify_role(&relative, &extension).to_string(),
                size_bytes: metadata.len(),
                line_count: 0,
                content_hash: stable_hash(&format!("{}:{}", relative, metadata.len())),
                parse_status: "skipped".to_string(),
            });
            continue;
        }
        let content = match fs::read_to_string(path) {
            Ok(content) => content,
            Err(error) => {
                let file = ScannedFile {
                    id: stable_file_id(&relative),
                    path: relative.clone(),
                    basename,
                    extension: extension.clone(),
                    language,
                    layer: classify_layer(&relative, &extension).to_string(),
                    role: classify_role(&relative, &extension).to_string(),
                    size_bytes: metadata.len(),
                    line_count: 0,
                    content_hash: String::new(),
                    parse_status: "parse-failed".to_string(),
                };
                repair_issues.push(RepairIssue {
                    id: format!("repair-{}", stable_hash(&format!("parse-failed:{}", file.path))),
                    kind: "parse-failed".to_string(),
                    severity: "warning".to_string(),
                    message: format!("Failed to read scan file: {error}"),
                    file_id: Some(file.id.clone()),
                    relation_id: None,
                    path: Some(file.path.clone()),
                    action: "quarantined".to_string(),
                });
                files.push(file);
                continue;
            }
        };
        let file = ScannedFile {
            id: stable_file_id(&relative),
            path: relative.clone(),
            basename,
            extension: extension.clone(),
            language,
            layer: classify_layer(&relative, &extension).to_string(),
            role: classify_role(&relative, &extension).to_string(),
            size_bytes: metadata.len(),
            line_count: content.lines().count(),
            content_hash: content_hash(&content),
            parse_status: "parsed".to_string(),
        };
        file_contents.push((file.clone(), content));
        files.push(file);
    }

    let path_to_file_id = files
        .iter()
        .map(|file| (file.path.clone(), file.id.clone()))
        .collect::<HashMap<_, _>>();
    let file_by_basename = files
        .iter()
        .map(|file| (file.basename.to_ascii_lowercase(), file.id.clone()))
        .collect::<HashMap<_, _>>();
    let mut java_file_by_type = HashMap::new();
    let mut command_file_by_name = HashMap::new();
    let mut relationship_symbols = Vec::new();
    for (file, content) in &file_contents {
        if file.language == "java" {
            if let Some(type_name) = java_declared_type(content) {
                java_file_by_type.insert(type_name.clone(), file.id.clone());
                if let Some(package_name) = java_package_name(content) {
                    java_file_by_type.insert(format!("{package_name}.{type_name}"), file.id.clone());
                }
            }
        }
        if file.language == "rust" {
            for command_name in tauri_command_names(content) {
                command_file_by_name.insert(command_name, file.id.clone());
            }
        }
        relationship_symbols.extend(relationship_symbols_for_file(file, content));
    }
    let symbol_file_by_key = build_symbol_file_index(&files, &relationship_symbols);

    let mut relations = Vec::new();
    for (file, content) in &file_contents {
        for (line_index, line) in content.lines().enumerate() {
            let line_number = line_index + 1;
            if matches!(file.language.as_str(), "typescript" | "javascript" | "vue" | "svelte") {
                for specifier in import_specifiers(line) {
                    if let Some(target_path) =
                        resolve_relative_import(&scan_root, &file.path, &specifier, &path_to_file_id)
                    {
                        if let Some(target_file_id) = path_to_file_id.get(&target_path) {
                            push_relation(
                                &mut relations,
                                "imports",
                                &file.id,
                                target_file_id,
                                "high",
                                evidence(&file.path, line_number, line, &generated_at),
                            );
                        }
                    }
                }
                if line.trim_start().starts_with("export ") {
                    push_relation(
                        &mut relations,
                        "exports",
                        &file.id,
                        &file.id,
                        "medium",
                        evidence(&file.path, line_number, line, &generated_at),
                    );
                }
                if let Some(command_name) = line
                    .split("invoke(")
                    .nth(1)
                    .and_then(first_quoted_value)
                {
                    if let Some(target_file_id) = command_file_by_name.get(&command_name) {
                        push_relation(
                            &mut relations,
                            "bridges_to",
                            &file.id,
                            target_file_id,
                            "medium",
                            evidence(&file.path, line_number, line, &generated_at),
                        );
                    }
                }
            }
            if matches!(file.language.as_str(), "c" | "cpp") {
                if let Some(specifier) = c_include_specifier(line) {
                    if let Some(target_path) =
                        resolve_relative_import(&scan_root, &file.path, &specifier, &path_to_file_id)
                    {
                        if let Some(target_file_id) = path_to_file_id.get(&target_path) {
                            push_relation(
                                &mut relations,
                                "imports",
                                &file.id,
                                target_file_id,
                                "high",
                                evidence(&file.path, line_number, line, &generated_at),
                            );
                        }
                    }
                }
            }
            if file.language == "python" {
                for specifier in python_import_specifiers(line) {
                    if let Some(target_path) =
                        resolve_python_import(&scan_root, &file.path, &specifier, &path_to_file_id)
                    {
                        if let Some(target_file_id) = path_to_file_id.get(&target_path) {
                            push_relation(
                                &mut relations,
                                "imports",
                                &file.id,
                                target_file_id,
                                "medium",
                                evidence(&file.path, line_number, line, &generated_at),
                            );
                        }
                    }
                }
            }
            if file.language == "rust" {
                for specifier in rust_use_roots(line) {
                    if let Some(target_path) =
                        resolve_rust_use(&scan_root, &file.path, &specifier, &path_to_file_id)
                    {
                        if let Some(target_file_id) = path_to_file_id.get(&target_path) {
                            push_relation(
                                &mut relations,
                                "imports",
                                &file.id,
                                target_file_id,
                                "medium",
                                evidence(&file.path, line_number, line, &generated_at),
                            );
                        }
                    }
                }
                if let Some(module_name) = rust_mod_specifier(line) {
                    if let Some(target_path) =
                        resolve_rust_mod(&scan_root, &file.path, &module_name, &path_to_file_id)
                    {
                        if let Some(target_file_id) = path_to_file_id.get(&target_path) {
                            push_relation(
                                &mut relations,
                                "imports",
                                &file.id,
                                target_file_id,
                                "high",
                                evidence(&file.path, line_number, line, &generated_at),
                            );
                        }
                    }
                }
            }
            if file.language == "java" {
                if let Some(import_name) = java_import_specifier(line) {
                    if let Some(target_file_id) =
                        resolve_java_import(&import_name, &java_file_by_type)
                    {
                        push_relation(
                            &mut relations,
                            "imports",
                            &file.id,
                            &target_file_id,
                            "high",
                            evidence(&file.path, line_number, line, &generated_at),
                        );
                    }
                }
            }
            if !matches!(file.language.as_str(), "markdown" | "json" | "toml" | "yaml" | "xml" | "properties" | "text") {
                for call_candidate in call_candidates_for_line(line) {
                    if let Some(target_file_id) = resolve_call_target(
                        &call_candidate,
                        &file.id,
                        &symbol_file_by_key,
                    ) {
                        push_relation(
                            &mut relations,
                            "calls",
                            &file.id,
                            &target_file_id,
                            "medium",
                            evidence(&file.path, line_number, &format!("calls {call_candidate}"), &generated_at),
                        );
                    }
                }
            }
            if file.language == "markdown" {
                for mention in document_path_mentions(line) {
                    let target_file_id = path_to_file_id
                        .get(&mention)
                        .or_else(|| file_by_basename.get(&mention.to_ascii_lowercase()));
                    if let Some(target_file_id) = target_file_id {
                        if target_file_id != &file.id {
                            push_relation(
                                &mut relations,
                                "documents",
                                &file.id,
                                target_file_id,
                                "medium",
                                evidence(&file.path, line_number, line, &generated_at),
                            );
                        }
                    }
                }
            }
        }
    }

    for file in &files {
        if file.role == "test" {
            continue;
        }
        let stem = project_file_stem(&file.basename);
        for test_name in [
            format!("{stem}.test.ts"),
            format!("{stem}.test.tsx"),
            format!("{stem}.spec.ts"),
            format!("{stem}.spec.tsx"),
            format!("{stem}test.java"),
            format!("{stem}tests.java"),
            format!("{stem}_test.rs"),
        ] {
            if let Some(test_file_id) = file_by_basename.get(&test_name) {
                push_relation(
                    &mut relations,
                    "tested_by",
                    &file.id,
                    test_file_id,
                    "medium",
                    evidence(&file.path, 1, "matched by test filename convention", &generated_at),
                );
            }
        }
        for style_name in [format!("{stem}.css"), format!("{stem}.scss")] {
            if let Some(style_file_id) = file_by_basename.get(&style_name) {
                push_relation(
                    &mut relations,
                    "styled_by",
                    &file.id,
                    style_file_id,
                    "medium",
                    evidence(&file.path, 1, "matched by style filename convention", &generated_at),
                );
            }
        }
    }

    let manifest_files = files
        .iter()
        .filter(|file| file.role == "manifest")
        .collect::<Vec<_>>();
    for manifest in &manifest_files {
        let manifest_dir = parent_dir_text(&manifest.path);
        let mut configured_count = 0usize;
        for target in &files {
            if target.id == manifest.id {
                continue;
            }
            if target.role == "manifest" && path_is_inside_dir(&target.path, &manifest_dir) {
                push_relation(
                    &mut relations,
                    "contains",
                    &manifest.id,
                    &target.id,
                    "medium",
                    evidence(&manifest.path, 1, "nested manifest discovered by project layout", &generated_at),
                );
            }
            if configured_count >= 120 || !path_is_inside_dir(&target.path, &manifest_dir) {
                continue;
            }
            push_relation(
                &mut relations,
                "configures",
                &manifest.id,
                &target.id,
                "medium",
                evidence(&manifest.path, 1, "manifest configures files in the same module", &generated_at),
            );
            configured_count += 1;
        }
    }

    let mut files_by_stem: BTreeMap<String, Vec<&ScannedFile>> = BTreeMap::new();
    for file in &files {
        let stem = project_file_stem(&file.basename);
        if stem.len() >= 3 {
            files_by_stem.entry(stem).or_default().push(file);
        }
    }
    for related_files in files_by_stem.values() {
        if related_files.len() < 2 || related_files.len() > 8 {
            continue;
        }
        for source_index in 0..related_files.len() {
            for target in related_files.iter().skip(source_index + 1).copied() {
                let source = related_files[source_index];
                if source.id == target.id {
                    continue;
                }
                push_relation(
                    &mut relations,
                    "related",
                    &source.id,
                    &target.id,
                    "low",
                    evidence(&source.path, 1, "same-stem project convention", &generated_at),
                );
            }
        }
    }

    let (relations, duplicate_issues) = dedupe_relations(relations);
    repair_issues.extend(duplicate_issues);
    let (by_file, by_type, hotspots, modules) = build_indexes(&files, &relations);
    let (git_common_root, git_commit_hash) = git_metadata(&scan_root);
    let (impact_artifact, context_pack_artifact) = build_relationship_impact_and_context(
        &files,
        &relations,
        &hotspots,
        &scan_root,
        explicit_changed_paths.as_deref(),
        &scan_run_id,
        &generated_at,
    );
    let manifest = json!({
        "schemaVersion": 1,
        "storageKey": storage_key,
        "workspaceId": entry.id,
        "workspacePath": entry.path,
        "projectName": entry.name,
        "scannedRoot": normalize_path(&scan_root),
        "gitCommonRoot": git_common_root,
        "gitCommitHash": git_commit_hash,
        "generatedAt": generated_at,
        "scanRunId": scan_run_id,
        "fileCount": files.len(),
        "relationCount": relations.len(),
        "ignoredCount": ignored_paths.len(),
        "repairIssueCount": repair_issues.len(),
        "source": "deterministic-scan"
    });
    let snapshot_files = vec![
        ProjectMapRelationshipWriteFile {
            relative_path: "manifest.json".to_string(),
            content: serde_json::to_string_pretty(&manifest)
                .map_err(|err| format!("Failed to serialize relationship manifest: {err}"))?,
        },
        ProjectMapRelationshipWriteFile {
            relative_path: "profile.json".to_string(),
            content: serde_json::to_string_pretty(&json!({
                "schemaVersion": 1,
                "primaryLanguages": files.iter().map(|file| file.language.clone()).collect::<Vec<_>>(),
                "layers": files.iter().map(|file| file.layer.clone()).collect::<Vec<_>>()
            }))
            .map_err(|err| format!("Failed to serialize relationship profile: {err}"))?,
        },
        ProjectMapRelationshipWriteFile {
            relative_path: "runs/latest.json".to_string(),
            content: serde_json::to_string_pretty(&json!({
                "schemaVersion": 1,
                "scanRunId": scan_run_id,
                "startedAt": generated_at,
                "completedAt": generated_at,
                "fileCount": files.len(),
                "relationCount": relations.len(),
                "ignoredCount": ignored_paths.len()
            }))
            .map_err(|err| format!("Failed to serialize relationship run: {err}"))?,
        },
        ProjectMapRelationshipWriteFile {
            relative_path: "scans/latest.json".to_string(),
            content: serde_json::to_string_pretty(&json!({
                "schemaVersion": 1,
                "scanRunId": scan_run_id,
                "options": {
                    "maxFiles": max_files,
                    "requestedPaths": requested_paths,
                    "changedFiles": explicit_changed_paths.clone().unwrap_or_default()
                },
                "ignored": ignored_paths
            }))
            .map_err(|err| format!("Failed to serialize relationship scan: {err}"))?,
        },
        ProjectMapRelationshipWriteFile {
            relative_path: "files/manifest.json".to_string(),
            content: serde_json::to_string_pretty(&json!({
                "schemaVersion": 1,
                "chunkCount": 1,
                "fileCount": files.len()
            }))
            .map_err(|err| format!("Failed to serialize relationship files manifest: {err}"))?,
        },
        ProjectMapRelationshipWriteFile {
            relative_path: "files/chunks-000.json".to_string(),
            content: serde_json::to_string_pretty(&files)
                .map_err(|err| format!("Failed to serialize relationship files chunk: {err}"))?,
        },
        ProjectMapRelationshipWriteFile {
            relative_path: "symbols/manifest.json".to_string(),
            content: serde_json::to_string_pretty(&json!({
                "schemaVersion": 1,
                "chunkCount": 1,
                "symbolCount": relationship_symbols.len()
            }))
            .map_err(|err| format!("Failed to serialize relationship symbols manifest: {err}"))?,
        },
        ProjectMapRelationshipWriteFile {
            relative_path: "symbols/chunks-000.json".to_string(),
            content: serde_json::to_string_pretty(&relationship_symbols)
                .map_err(|err| format!("Failed to serialize relationship symbols chunk: {err}"))?,
        },
        ProjectMapRelationshipWriteFile {
            relative_path: "relations/latest.json".to_string(),
            content: serde_json::to_string_pretty(&relations)
                .map_err(|err| format!("Failed to serialize relationship relations: {err}"))?,
        },
        ProjectMapRelationshipWriteFile {
            relative_path: "relations/by-file.json".to_string(),
            content: serde_json::to_string_pretty(&by_file)
                .map_err(|err| format!("Failed to serialize relationship by-file index: {err}"))?,
        },
        ProjectMapRelationshipWriteFile {
            relative_path: "relations/by-type.json".to_string(),
            content: serde_json::to_string_pretty(&by_type)
                .map_err(|err| format!("Failed to serialize relationship by-type index: {err}"))?,
        },
        ProjectMapRelationshipWriteFile {
            relative_path: "modules/latest.json".to_string(),
            content: serde_json::to_string_pretty(&json!({
                "schemaVersion": 1,
                "generatedAt": generated_at,
                "modules": modules,
                "hotspots": hotspots
            }))
                .map_err(|err| format!("Failed to serialize relationship modules: {err}"))?,
        },
        ProjectMapRelationshipWriteFile {
            relative_path: "impact/latest.json".to_string(),
            content: serde_json::to_string_pretty(&impact_artifact)
            .map_err(|err| format!("Failed to serialize relationship impact: {err}"))?,
        },
        ProjectMapRelationshipWriteFile {
            relative_path: "context-packs/latest.json".to_string(),
            content: serde_json::to_string_pretty(&context_pack_artifact)
            .map_err(|err| format!("Failed to serialize relationship context pack: {err}"))?,
        },
        ProjectMapRelationshipWriteFile {
            relative_path: "repair/latest.json".to_string(),
            content: serde_json::to_string_pretty(&json!({
                "schemaVersion": 1,
                "generatedAt": generated_at,
                "issues": repair_issues
            }))
            .map_err(|err| format!("Failed to serialize relationship repair summary: {err}"))?,
        },
    ];
    write_relationship_snapshot_files(storage_root, storage_key, snapshot_files, true)?;

    Ok(ProjectMapRelationshipScanResponse {
        storage_key: storage_key.to_string(),
        storage_dir: storage_root.to_string_lossy().to_string(),
        scan_run_id,
        generated_at,
        scanned_root: normalize_path(&scan_root),
        file_count: files.len(),
        relation_count: relations.len(),
        ignored_count: ignored_paths.len(),
        repair_issue_count: repair_issues.len(),
    })
}

#[tauri::command]
pub(crate) async fn project_map_relationship_scan(
    workspace_id: String,
    options: Option<ProjectMapRelationshipScanOptions>,
    storage_mode: Option<String>,
    state: State<'_, AppState>,
) -> Result<ProjectMapRelationshipScanResponse, String> {
    let entry = workspace_entry(&state, &workspace_id).await?;
    let (key, root) = relationship_root_for_mode(&entry, storage_mode.as_deref())?;
    let options = options.unwrap_or(ProjectMapRelationshipScanOptions {
        max_files: None,
        include_ignored_hints: None,
        paths: None,
        changed_files: None,
    });

    tokio::task::spawn_blocking(move || scan_workspace(&entry, &key, &root, options))
        .await
        .map_err(|err| format!("Project map relationship scan task failed: {err}"))?
}

#[tauri::command]
pub(crate) async fn project_map_relationship_read(
    workspace_id: String,
    storage_mode: Option<String>,
    state: State<'_, AppState>,
) -> Result<ProjectMapRelationshipReadResponse, String> {
    let entry = workspace_entry(&state, &workspace_id).await?;
    let (key, root) = relationship_root_for_mode(&entry, storage_mode.as_deref())?;
    let exists = root.join("manifest.json").is_file();
    let mut read_errors = Vec::new();
    let manifest = read_json_with_errors(&root, "manifest.json", &mut read_errors);
    let profile = read_json_with_errors(&root, "profile.json", &mut read_errors);
    let run = read_json_with_errors(&root, "runs/latest.json", &mut read_errors);
    let scan = read_json_with_errors(&root, "scans/latest.json", &mut read_errors);
    let files_manifest = read_json_with_errors(&root, "files/manifest.json", &mut read_errors);
    let files = read_json_with_errors(&root, "files/chunks-000.json", &mut read_errors);
    let relations = read_json_with_errors(&root, "relations/latest.json", &mut read_errors);
    let relations_by_file = read_json_with_errors(&root, "relations/by-file.json", &mut read_errors);
    let relations_by_type = read_json_with_errors(&root, "relations/by-type.json", &mut read_errors);
    let modules = read_json_with_errors(&root, "modules/latest.json", &mut read_errors);
    let impact = read_json_with_errors(&root, "impact/latest.json", &mut read_errors);
    let context_pack = read_json_with_errors(&root, "context-packs/latest.json", &mut read_errors);
    let stale = exists.then(|| {
        summarize_relationship_stale_state(Path::new(&entry.path), &manifest, &files)
    });
    let context_pack = enrich_context_pack_with_stale_state(context_pack, &stale);
    let repair = read_json_with_errors(&root, "repair/latest.json", &mut read_errors);

    Ok(ProjectMapRelationshipReadResponse {
        storage_key: key,
        storage_dir: root.to_string_lossy().to_string(),
        exists,
        manifest,
        profile,
        run,
        scan,
        files_manifest,
        files,
        relations,
        relations_by_file,
        relations_by_type,
        modules,
        impact,
        context_pack,
        stale,
        repair,
        read_errors,
    })
}

#[tauri::command]
pub(crate) async fn project_map_relationship_write_snapshot(
    workspace_id: String,
    files: Vec<ProjectMapRelationshipWriteFile>,
    create_backup: Option<bool>,
    storage_mode: Option<String>,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let entry = workspace_entry(&state, &workspace_id).await?;
    let (key, root) = relationship_root_for_mode(&entry, storage_mode.as_deref())?;
    write_relationship_snapshot_files(&root, &key, files, create_backup.unwrap_or(false))
}

#[tauri::command]
pub(crate) async fn project_map_relationship_clear(
    workspace_id: String,
    storage_mode: Option<String>,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let entry = workspace_entry(&state, &workspace_id).await?;
    let (_, root) = relationship_root_for_mode(&entry, storage_mode.as_deref())?;
    with_storage_lock(&root, || {
        if root.exists() {
            fs::remove_dir_all(&root)
                .map_err(|err| format!("Failed to clear project map relationship data: {err}"))?;
        }
        Ok(())
    })
}

#[cfg(test)]
mod tests {
    use super::{
        validate_relative_relationship_path, validate_relationship_snapshot_ownership,
        ProjectMapRelationshipWriteFile,
    };

    #[test]
    fn relationship_write_paths_are_constrained() {
        assert!(validate_relative_relationship_path("manifest.json").is_ok());
        assert!(validate_relative_relationship_path("profile.json").is_ok());
        assert!(validate_relative_relationship_path("runs/latest.json").is_ok());
        assert!(validate_relative_relationship_path("scans/latest.json").is_ok());
        assert!(validate_relative_relationship_path("files/manifest.json").is_ok());
        assert!(validate_relative_relationship_path("files/chunks-000.json").is_ok());
        assert!(validate_relative_relationship_path("symbols/chunks-001.json").is_ok());
        assert!(validate_relative_relationship_path("relations/latest.json").is_ok());
        assert!(validate_relative_relationship_path("relations/by-file.json").is_ok());
        assert!(validate_relative_relationship_path("relations/by-type.json").is_ok());
        assert!(validate_relative_relationship_path("modules/latest.json").is_ok());
        assert!(validate_relative_relationship_path("impact/latest.json").is_ok());
        assert!(validate_relative_relationship_path("context-packs/latest.json").is_ok());
        assert!(validate_relative_relationship_path("repair/latest.json").is_ok());
        assert!(validate_relative_relationship_path("../manifest.json").is_err());
        assert!(validate_relative_relationship_path("files/../../manifest.json").is_err());
        assert!(validate_relative_relationship_path("files/Chunks-000.json").is_err());
        assert!(validate_relative_relationship_path("relations/archive/latest.json").is_err());
        assert!(validate_relative_relationship_path("relations/con.json").is_err());
        assert!(validate_relative_relationship_path("random.json").is_err());
    }

    #[test]
    fn relationship_snapshot_ownership_requires_matching_manifest() {
        let files = vec![ProjectMapRelationshipWriteFile {
            relative_path: "manifest.json".to_string(),
            content: r#"{"schemaVersion":1,"storageKey":"mossx-12345678"}"#.to_string(),
        }];

        assert!(validate_relationship_snapshot_ownership("mossx-12345678", &files).is_ok());
        assert!(validate_relationship_snapshot_ownership("other-12345678", &files).is_err());
        assert!(validate_relationship_snapshot_ownership("mossx-12345678", &[]).is_err());
    }
}
