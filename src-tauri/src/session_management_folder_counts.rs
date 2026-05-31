use std::collections::{HashMap, HashSet};

use super::{
    AutoSessionVisibility, WorkspaceSessionCatalogEntry, WorkspaceSessionCatalogQuery,
    SESSION_FOLDER_ROOT_ID, SESSION_FOLDER_SYSTEM_AUTO_ID,
};

#[derive(Debug, Clone, PartialEq, Eq)]
pub(super) struct SessionCatalogFolderCountSummary {
    pub(super) folder_counts_by_id: HashMap<String, usize>,
    pub(super) unassigned_folder_count: usize,
}

pub(super) fn build_catalog_folder_count_summary(
    entries: &[&WorkspaceSessionCatalogEntry],
) -> SessionCatalogFolderCountSummary {
    let resolved_folder_by_session_id = build_catalog_effective_folder_id_by_session_id(entries);
    let mut folder_counts_by_id = HashMap::<String, usize>::new();
    let mut unassigned_folder_count = 0usize;

    for entry in entries {
        if entry
            .auto_session
            .as_ref()
            .is_some_and(|metadata| metadata.visibility == AutoSessionVisibility::Hidden)
        {
            continue;
        }
        match resolved_folder_by_session_id
            .get(&entry.session_id)
            .cloned()
            .flatten()
        {
            Some(folder_id) => {
                *folder_counts_by_id.entry(folder_id).or_insert(0) += 1;
            }
            None => {
                unassigned_folder_count += 1;
            }
        }
    }

    SessionCatalogFolderCountSummary {
        folder_counts_by_id,
        unassigned_folder_count,
    }
}

pub(super) fn build_catalog_effective_folder_id_by_session_id(
    entries: &[&WorkspaceSessionCatalogEntry],
) -> HashMap<String, Option<String>> {
    let entry_by_session_id = entries
        .iter()
        .map(|entry| (entry.session_id.as_str(), *entry))
        .collect::<HashMap<_, _>>();
    let mut resolved_folder_by_session_id = HashMap::<String, Option<String>>::new();

    for entry in entries {
        resolve_effective_folder_id_for_entry(
            entry,
            &entry_by_session_id,
            &mut resolved_folder_by_session_id,
            &mut HashSet::new(),
        );
    }

    resolved_folder_by_session_id
}

pub(super) fn normalize_query_folder_filter(
    query: &WorkspaceSessionCatalogQuery,
) -> Option<String> {
    query
        .folder_id
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .filter(|value| *value != "__all__")
        .map(ToString::to_string)
}

pub(super) fn filter_catalog_entries_by_folder(
    entries: Vec<WorkspaceSessionCatalogEntry>,
    folder_filter: Option<&str>,
) -> Vec<WorkspaceSessionCatalogEntry> {
    let Some(folder_filter) = folder_filter else {
        return entries;
    };
    let entry_refs = entries.iter().collect::<Vec<_>>();
    let effective_folder_by_session_id =
        build_catalog_effective_folder_id_by_session_id(&entry_refs);

    entries
        .into_iter()
        .filter(|entry| {
            let effective_folder_id = effective_folder_by_session_id
                .get(&entry.session_id)
                .cloned()
                .flatten();
            if folder_filter == SESSION_FOLDER_ROOT_ID {
                return effective_folder_id.is_none();
            }
            effective_folder_id.as_deref() == Some(folder_filter)
        })
        .collect()
}

fn resolve_effective_folder_id_for_entry(
    entry: &WorkspaceSessionCatalogEntry,
    entry_by_session_id: &HashMap<&str, &WorkspaceSessionCatalogEntry>,
    resolved_folder_by_session_id: &mut HashMap<String, Option<String>>,
    visiting: &mut HashSet<String>,
) -> Option<String> {
    if let Some(resolved) = resolved_folder_by_session_id.get(&entry.session_id) {
        return resolved.clone();
    }

    if entry
        .auto_session
        .as_ref()
        .is_some_and(|metadata| metadata.visibility == AutoSessionVisibility::SystemAuto)
    {
        let resolved = Some(SESSION_FOLDER_SYSTEM_AUTO_ID.to_string());
        resolved_folder_by_session_id.insert(entry.session_id.clone(), resolved.clone());
        return resolved;
    }

    if let Some(folder_id) = entry
        .folder_id
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        let resolved = Some(folder_id.to_string());
        resolved_folder_by_session_id.insert(entry.session_id.clone(), resolved.clone());
        return resolved;
    }

    if !visiting.insert(entry.session_id.clone()) {
        resolved_folder_by_session_id.insert(entry.session_id.clone(), None);
        return None;
    }

    let resolved = entry
        .parent_session_id
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .and_then(|parent_session_id| entry_by_session_id.get(parent_session_id).copied())
        .and_then(|parent| {
            resolve_effective_folder_id_for_entry(
                parent,
                entry_by_session_id,
                resolved_folder_by_session_id,
                visiting,
            )
        });

    visiting.remove(&entry.session_id);
    resolved_folder_by_session_id.insert(entry.session_id.clone(), resolved.clone());
    resolved
}
