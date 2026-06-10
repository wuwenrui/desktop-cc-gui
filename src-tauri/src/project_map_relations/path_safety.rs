use std::path::{Component, Path, PathBuf};

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

pub(super) fn validate_relative_relationship_path(path: &str) -> Result<PathBuf, String> {
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
        [dir, file]
            if matches!(
                dir.as_str(),
                "runs" | "scans" | "modules" | "impact" | "repair"
            ) =>
        {
            file == "latest.json"
        }
        [dir, file] if matches!(dir.as_str(), "files" | "symbols") => {
            file == "manifest.json" || is_chunk_json_file(file)
        }
        [dir, file] if dir == "relations" => {
            matches!(
                file.as_str(),
                "latest.json" | "by-file.json" | "by-type.json"
            )
        }
        [dir, file] if dir == "context-packs" => file == "latest.json",
        [dir, file] if dir == "repair" => file == "latest.json",
        [dir, file] if dir == "api-contracts" => matches!(
            file.as_str(),
            "latest.json"
                | "manifest.json"
                | "endpoints.json"
                | "groups.json"
                | "schemas.json"
                | "chains.json"
        ),
        [dir, file] => is_safe_relationship_segment(dir) && is_safe_json_file(file),
        _ => false,
    };

    if !allowed {
        return Err(
            "Project map relationship write path is outside the allowed contract.".to_string(),
        );
    }
    Ok(relative)
}
