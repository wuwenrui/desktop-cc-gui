use std::collections::{BTreeMap, HashMap, HashSet};
use std::path::{Component, Path, PathBuf};

use serde_json::{json, Value};

use super::file_classification::module_label;
use super::{
    relation_id, relative_path, stable_hash, FileRelation, FileRelationIndex, ModuleSummary,
    RelationEvidence, RelationshipSymbol, RepairIssue, ScannedFile,
};

pub(super) fn first_quoted_value(text: &str) -> Option<String> {
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

pub(super) fn import_specifiers(line: &str) -> Vec<String> {
    let trimmed = line.trim();
    let mut specifiers = Vec::new();
    if (trimmed.starts_with("import ") || trimmed.starts_with("export "))
        && trimmed.contains(" from ")
    {
        if let Some(specifier) = first_quoted_value(
            trimmed
                .rsplit_once(" from ")
                .map(|(_, tail)| tail)
                .unwrap_or(trimmed),
        ) {
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

pub(super) fn java_import_specifier(line: &str) -> Option<String> {
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

pub(super) fn java_package_name(content: &str) -> Option<String> {
    content.lines().find_map(|line| {
        let trimmed = line.trim();
        trimmed
            .strip_prefix("package ")
            .map(str::trim)
            .map(|value| value.trim_end_matches(';').trim().to_string())
            .filter(|value| !value.is_empty())
    })
}

pub(super) fn java_declared_type(content: &str) -> Option<String> {
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

pub(super) fn project_file_stem(basename: &str) -> String {
    basename
        .split('.')
        .next()
        .unwrap_or(basename)
        .to_ascii_lowercase()
}

pub(super) fn parent_dir_text(path: &str) -> String {
    path.rsplit_once('/')
        .map(|(parent, _)| parent.to_string())
        .unwrap_or_default()
}

pub(super) fn path_is_inside_dir(path: &str, directory: &str) -> bool {
    if directory.is_empty() {
        return true;
    }
    match path.strip_prefix(directory) {
        Some(tail) => tail.starts_with('/'),
        None => false,
    }
}

pub(super) fn document_path_mentions(line: &str) -> Vec<String> {
    line.split(|character: char| {
        !(character.is_ascii_alphanumeric() || matches!(character, '.' | '_' | '-' | '/' | '\\'))
    })
    .map(|token| {
        token.trim_matches(|character| matches!(character, '.' | ',' | ';' | ':' | ')' | ']' | '}'))
    })
    .map(|token| token.replace('\\', "/"))
    .filter(|token| token.contains('.') || token.contains('/'))
    .filter(|token| token.len() >= 4)
    .collect()
}

pub(super) fn rust_fn_name(line: &str) -> Option<String> {
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

pub(super) fn tauri_command_names(content: &str) -> Vec<String> {
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

pub(super) fn rust_use_roots(line: &str) -> Vec<String> {
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

pub(super) fn rust_mod_specifier(line: &str) -> Option<String> {
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

pub(super) fn resolve_relative_import(
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
        "ts", "tsx", "js", "jsx", "mjs", "cjs", "json", "css", "rs", "vue", "svelte", "py", "go",
        "java", "kt", "c", "cc", "cpp", "cxx", "h", "hpp",
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

pub(super) fn resolve_rust_mod(
    root: &Path,
    source_path: &str,
    module_name: &str,
    path_to_file_id: &HashMap<String, String>,
) -> Option<String> {
    let base = Path::new(source_path)
        .parent()
        .map(Path::to_path_buf)
        .unwrap_or_default();
    [
        base.join(format!("{module_name}.rs")),
        base.join(module_name).join("mod.rs"),
    ]
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

pub(super) fn resolve_rust_use(
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

pub(super) fn resolve_java_import(
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
    if name.is_empty() {
        None
    } else {
        Some(name)
    }
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
    for keyword in [
        "class ",
        "interface ",
        "enum ",
        "record ",
        "struct ",
        "trait ",
    ] {
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
                after_func
                    .split_once(')')
                    .map(|(_, tail)| tail.trim_start())
                    .unwrap_or(after_func)
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
    if matches!(
        language,
        "c" | "cpp" | "csharp" | "java" | "kotlin" | "swift" | "php" | "ruby"
    ) {
        if let Some(name) = declaration_name_before_paren(trimmed) {
            if trimmed.ends_with('{') || trimmed.ends_with(';') || trimmed.contains(" throws ") {
                return Some((name, "function"));
            }
        }
    }
    None
}

pub(super) fn relationship_symbols_for_file(
    file: &ScannedFile,
    content: &str,
) -> Vec<RelationshipSymbol> {
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

pub(super) fn build_symbol_file_index(
    files: &[ScannedFile],
    symbols: &[RelationshipSymbol],
) -> HashMap<String, String> {
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
        "if" | "for"
            | "while"
            | "switch"
            | "catch"
            | "return"
            | "throw"
            | "new"
            | "sizeof"
            | "typeof"
            | "await"
            | "async"
            | "function"
            | "fn"
            | "def"
            | "func"
            | "class"
            | "interface"
            | "struct"
            | "enum"
            | "record"
            | "match"
            | "loop"
            | "select"
    )
}

pub(super) fn call_candidates_for_line(line: &str) -> Vec<String> {
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
        if token.contains('.')
            || token.contains("::")
            || token.contains("->")
            || token.contains('_')
        {
            candidates.push(token.to_string());
            continue;
        }
        if token
            .chars()
            .next()
            .is_some_and(|character| character.is_ascii_uppercase())
        {
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

pub(super) fn resolve_call_target(
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

pub(super) fn c_include_specifier(line: &str) -> Option<String> {
    let trimmed = line.trim();
    if !trimmed.starts_with("#include") {
        return None;
    }
    first_quoted_value(trimmed)
}

pub(super) fn python_import_specifiers(line: &str) -> Vec<String> {
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

pub(super) fn resolve_python_import(
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

pub(super) fn evidence(
    path: &str,
    line: usize,
    excerpt: &str,
    observed_at: &str,
) -> RelationEvidence {
    RelationEvidence {
        path: path.to_string(),
        line,
        excerpt: excerpt.trim().chars().take(180).collect(),
        extractor_version: "project-map-relations-v1".to_string(),
        observed_at: observed_at.to_string(),
    }
}

pub(super) fn push_relation(
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

pub(super) fn dedupe_relations(
    relations: Vec<FileRelation>,
) -> (Vec<FileRelation>, Vec<RepairIssue>) {
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

pub(super) fn build_indexes(
    files: &[ScannedFile],
    relations: &[FileRelation],
) -> (
    BTreeMap<String, FileRelationIndex>,
    BTreeMap<String, Vec<String>>,
    Vec<Value>,
    Vec<ModuleSummary>,
) {
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
