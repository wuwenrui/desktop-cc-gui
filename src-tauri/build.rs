// Curated-skill lock validator. Runs at compile time and `compile_error!`s if any
// `kind: "curated"` entry in `skills-lock.json` has a stale `computedHash`,
// metadata.json with missing/invalid fields, asset path with `..` or absolute,
// icon with non-ASCII chars, or license outside the approved whitelist.
//
// Bundled entries (or entries without `kind`) are intentionally skipped — their
// on-disk assets are not present yet, that's a follow-up change.
//
// Reads `skills-lock.json` from the repo root (sibling of src-tauri/), and the
// curated skill bodies from src-tauri/resources/curated-skills/.

use std::fs;
use std::io::Read;
use std::path::Component;
use std::path::{Path, PathBuf};

use sha2::{Digest, Sha256};

const ALLOWED_LICENSES: &[&str] = &["MIT", "Apache-2.0", "BSD-2-Clause", "BSD-3-Clause", "ISC"];

fn main() {
    tauri_build::build();
    validate_curated_skills_lock();
    validate_curated_skills_bundled_in_conf();
}

/// Enforce that curated skills listed in `skills-lock.json` are bundled
/// without flattening their `<skill-id>/` directories. Tauri 2 flattens
/// `**/*` globs in map-style resources, so use either the generic directory
/// mapping (`"resources/curated-skills": "curated-skills"`) or explicit
/// per-skill directory mappings.
fn validate_curated_skills_bundled_in_conf() {
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let lock_path = manifest_dir
        .parent()
        .map(|p| p.join("skills-lock.json"))
        .unwrap_or_else(|| manifest_dir.join("skills-lock.json"));
    let conf_path = manifest_dir.join("tauri.conf.json");
    println!("cargo:rerun-if-changed={}", conf_path.display());

    let lock_raw = fs::read_to_string(&lock_path).unwrap_or_else(|e| {
        panic!(
            "could not read skills-lock.json at {}: {}",
            lock_path.display(),
            e
        )
    });
    let lock: serde_json::Value = match serde_json::from_str(&lock_raw) {
        Ok(v) => v,
        Err(e) => panic!("skills-lock.json is not valid JSON: {}", e),
    };
    let skills = match lock.get("skills").and_then(|v| v.as_object()) {
        Some(m) => m,
        None => return,
    };
    let mut curated_ids: Vec<String> = Vec::new();
    for (name, entry) in skills {
        let kind = entry
            .get("kind")
            .and_then(|v| v.as_str())
            .unwrap_or("bundled");
        if kind == "curated" {
            curated_ids.push(name.clone());
        }
    }
    if curated_ids.is_empty() {
        return;
    }

    let conf_raw = fs::read_to_string(&conf_path).unwrap_or_else(|e| {
        panic!(
            "could not read tauri.conf.json at {}: {}",
            conf_path.display(),
            e
        )
    });
    let conf: serde_json::Value = match serde_json::from_str(&conf_raw) {
        Ok(v) => v,
        Err(e) => panic!("tauri.conf.json is not valid JSON: {}", e),
    };
    let resources = match conf
        .get("bundle")
        .and_then(|b| b.get("resources"))
        .and_then(|r| r.as_object())
    {
        Some(m) => m,
        None => panic!("tauri.conf.json bundle.resources must be an object"),
    };

    let has_flattening_glob = resources.contains_key("resources/curated-skills/**/*");
    if has_flattening_glob {
        panic!(
            "tauri.conf.json must not map `resources/curated-skills/**/*`; Tauri flattens glob \
             map resources and packaged clients lose `curated-skills/<skill-id>/` directories"
        );
    }

    let has_directory_key = resources
        .get("resources/curated-skills")
        .and_then(|v| v.as_str())
        .map(|t| t == "curated-skills")
        .unwrap_or(false);

    for name in &curated_ids {
        let want_key = format!("resources/curated-skills/{name}");
        let want_target = format!("curated-skills/{name}");
        let has_explicit_key = resources
            .get(&want_key)
            .and_then(|v| v.as_str())
            .map(|target| target == want_target)
            .unwrap_or(false);
        if !has_directory_key && !has_explicit_key {
            panic!(
                "curated skill `{}` is missing from tauri.conf.json bundle.resources; expected \
                 `\"resources/curated-skills\": \"curated-skills\"` or \
                 `\"resources/curated-skills/{}\": \"curated-skills/{}\"`",
                name, name, name
            );
        }
    }
}

fn validate_curated_skills_lock() {
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let lock_path = manifest_dir
        .parent()
        .map(|p| p.join("skills-lock.json"))
        .unwrap_or_else(|| manifest_dir.join("skills-lock.json"));

    println!("cargo:rerun-if-changed={}", lock_path.display());
    println!(
        "cargo:rerun-if-changed={}",
        manifest_dir
            .join("resources")
            .join("curated-skills")
            .display()
    );

    let raw = match fs::read_to_string(&lock_path) {
        Ok(s) => s,
        Err(e) => panic!(
            "could not read skills-lock.json at {}: {}",
            lock_path.display(),
            e
        ),
    };

    let parsed: serde_json::Value = match serde_json::from_str(&raw) {
        Ok(v) => v,
        Err(e) => panic!("skills-lock.json is not valid JSON: {}", e),
    };

    if parsed.get("version").and_then(|v| v.as_u64()) != Some(2) {
        panic!("skills-lock.json schema version must be 2 for curated skill validation");
    }

    let skills = match parsed.get("skills").and_then(|v| v.as_object()) {
        Some(m) => m,
        None => panic!("skills-lock.json must have a top-level `skills` object"),
    };

    // Naming collision: all entry ids must be unique. (They naturally are, by
    // object-key uniqueness, but we assert anyway for clarity in case the file
    // is hand-edited.)
    let mut seen_ids: std::collections::HashSet<String> = std::collections::HashSet::new();
    for key in skills.keys() {
        if !seen_ids.insert(key.clone()) {
            panic!("duplicate skill id in skills-lock.json: {}", key);
        }
    }

    for (name, entry) in skills {
        let kind = entry
            .get("kind")
            .and_then(|v| v.as_str())
            .unwrap_or("bundled");

        if kind != "curated" {
            // bundled (or unknown) entries are skipped — their assets are not
            // on disk yet, that's a follow-up.
            continue;
        }

        validate_curated_entry(&manifest_dir, name, entry);
    }
}

fn validate_curated_entry(manifest_dir: &Path, name: &str, entry: &serde_json::Value) {
    validate_curated_skill_id(name);

    let asset_path_rel = entry
        .get("assetPath")
        .and_then(|v| v.as_str())
        .unwrap_or_else(|| panic!("curated skill `{}` missing `assetPath`", name));
    validate_lock_relative_path(name, "assetPath", asset_path_rel);

    let metadata_path_rel = entry
        .get("metadataPath")
        .and_then(|v| v.as_str())
        .unwrap_or_else(|| panic!("curated skill `{}` missing `metadataPath`", name));
    validate_lock_relative_path(name, "metadataPath", metadata_path_rel);

    let computed_hash = entry
        .get("computedHash")
        .and_then(|v| v.as_str())
        .unwrap_or_else(|| panic!("curated skill `{}` missing `computedHash`", name));

    let full_asset = manifest_dir.join(asset_path_rel);
    let full_meta = manifest_dir.join(metadata_path_rel);

    let actual_hash = sha256_file(&full_asset).unwrap_or_else(|e| {
        panic!(
            "could not read curated skill asset {}: {}",
            full_asset.display(),
            e
        )
    });

    if !actual_hash.eq_ignore_ascii_case(computed_hash) {
        panic!(
            "curated skill lock hash mismatch for {}: expected {}, got {}",
            name, computed_hash, actual_hash
        );
    }

    let meta_raw = fs::read_to_string(&full_meta).unwrap_or_else(|e| {
        panic!(
            "could not read curated skill metadata {}: {}",
            full_meta.display(),
            e
        )
    });
    let meta: serde_json::Value = serde_json::from_str(&meta_raw).unwrap_or_else(|e| {
        panic!(
            "metadata.json for curated skill `{}` is not valid JSON: {}",
            name, e
        )
    });

    for field in &[
        "name",
        "displayName",
        "version",
        "description",
        "icon",
        "category",
        "source",
        "license",
    ] {
        let val = meta.get(*field).and_then(|v| v.as_str());
        if val.is_none() || val.unwrap().trim().is_empty() {
            panic!(
                "curated skill `{}` metadata.json is missing or empty field: {}",
                name, field
            );
        }
    }
    // tokenEstimate is an integer
    if !meta
        .get("tokenEstimate")
        .map(|v| v.is_number())
        .unwrap_or(false)
    {
        panic!(
            "curated skill `{}` metadata.json `tokenEstimate` must be a positive integer",
            name
        );
    }

    let license = meta.get("license").and_then(|v| v.as_str()).unwrap();
    if !ALLOWED_LICENSES.contains(&license) {
        panic!(
            "curated skill `{}` license `{}` not in approved whitelist: {:?} (MPL-2.0 is excluded in v0.5.14)",
            name, license, ALLOWED_LICENSES
        );
    }

    let icon = meta.get("icon").and_then(|v| v.as_str()).unwrap();
    if icon.is_empty()
        || !icon
            .chars()
            .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-')
    {
        panic!(
            "curated skill `{}` icon `{}` must be kebab-case ASCII (e.g. 'sparkles', 'file-text')",
            name, icon
        );
    }

    let category = meta.get("category").and_then(|v| v.as_str()).unwrap();
    if !matches!(category, "code-style" | "ui-design" | "review" | "debug") {
        panic!(
            "curated skill `{}` category `{}` not in MVP-4 enum (code-style | ui-design | review | debug)",
            name, category
        );
    }

    if let Some(source_url) = meta.get("sourceUrl").and_then(|v| v.as_str()) {
        if !is_safe_http_url(source_url) {
            panic!(
                "curated skill `{}` sourceUrl must be an absolute http(s) URL with a host: {}",
                name, source_url
            );
        }
    }

    let token_estimate = meta
        .get("tokenEstimate")
        .and_then(|v| v.as_u64())
        .unwrap_or(0);
    if token_estimate == 0 || token_estimate > 3000 {
        panic!(
            "curated skill `{}` tokenEstimate {} is outside (0, 3000]",
            name, token_estimate
        );
    }

    let meta_name = meta.get("name").and_then(|v| v.as_str()).unwrap();
    validate_curated_skill_id(meta_name);
    if meta_name != name {
        panic!(
            "curated skill entry id `{}` does not match metadata.json name `{}`",
            name, meta_name
        );
    }
}

fn validate_curated_skill_id(value: &str) {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        panic!("curated skill id cannot be empty");
    }
    if trimmed != value {
        panic!(
            "curated skill id `{}` must not contain leading/trailing whitespace",
            value
        );
    }
    if trimmed.starts_with('-') || trimmed.ends_with('-') {
        panic!(
            "curated skill id `{}` must not start or end with '-'",
            value
        );
    }
    if !trimmed
        .chars()
        .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-')
    {
        panic!("curated skill id `{}` must be kebab-case ASCII", value);
    }
}

fn validate_lock_relative_path(name: &str, field: &str, value: &str) {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        panic!("curated skill `{}` has empty `{}`", name, field);
    }
    if trimmed != value {
        panic!(
            "curated skill `{}` `{}` must not contain leading/trailing whitespace: {}",
            name, field, value
        );
    }
    if trimmed.contains('\\') || trimmed.contains(':') {
        panic!(
            "curated skill `{}` `{}` must use repo-relative POSIX separators only: {}",
            name, field, value
        );
    }
    let path = Path::new(trimmed);
    if path.is_absolute() {
        panic!(
            "curated skill `{}` has absolute `{}`: {}",
            name, field, value
        );
    }
    for component in path.components() {
        if matches!(
            component,
            Component::ParentDir | Component::RootDir | Component::Prefix(_)
        ) {
            panic!(
                "curated skill `{}` has unsafe `{}` component in {}",
                name, field, value
            );
        }
    }
}

fn is_safe_http_url(value: &str) -> bool {
    let trimmed = value.trim();
    if trimmed != value || trimmed.is_empty() {
        return false;
    }
    if trimmed.chars().any(|c| c.is_control() || c.is_whitespace()) {
        return false;
    }
    let Some(rest) = trimmed
        .strip_prefix("https://")
        .or_else(|| trimmed.strip_prefix("http://"))
    else {
        return false;
    };
    let host = rest
        .split(['/', '?', '#'])
        .next()
        .unwrap_or("")
        .split('@')
        .next_back()
        .unwrap_or("");
    !host.is_empty() && !host.starts_with(':') && !host.contains('\\')
}

fn sha256_file(path: &Path) -> Result<String, String> {
    let mut file =
        fs::File::open(path).map_err(|e| format!("failed to open {}: {}", path.display(), e))?;
    let mut hasher = Sha256::new();
    let mut buffer = [0u8; 8192];
    loop {
        let read = file
            .read(&mut buffer)
            .map_err(|e| format!("failed to read {}: {}", path.display(), e))?;
        if read == 0 {
            break;
        }
        hasher.update(&buffer[..read]);
    }
    Ok(format!("{:x}", hasher.finalize()))
}
