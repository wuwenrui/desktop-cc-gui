use crate::types::WorkspaceEntry;

pub(crate) fn sanitize_project_name(value: &str) -> String {
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

pub(crate) fn hash_workspace_identity(value: &str) -> String {
    let mut hash: u32 = 0x811c9dc5;
    for byte in value.replace('\\', "/").to_lowercase().bytes() {
        hash ^= byte as u32;
        hash = hash.wrapping_mul(0x01000193);
    }
    format!("{hash:08x}")
}

pub(crate) fn project_storage_key(entry: &WorkspaceEntry) -> String {
    let slug = sanitize_project_name(&entry.name);
    let hash = hash_workspace_identity(&format!("{}#{}", entry.path, entry.id));
    format!("{slug}-{hash}")
}
