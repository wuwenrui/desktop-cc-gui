use std::collections::{BTreeMap, BTreeSet};

use serde_json::{json, Value};
use sha2::{Digest, Sha256};

use crate::project_map_relations::ScannedFile;

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

#[derive(Debug, Clone)]
struct ApiRouteAnnotation {
    method: Option<String>,
    path: Option<String>,
    framework: String,
    confidence: String,
    parser_source: String,
}

#[derive(Debug, Clone)]
struct ApiRouteCandidate {
    protocol: String,
    language: String,
    framework: Option<String>,
    method: Option<String>,
    path: Option<String>,
    operation_name: Option<String>,
    handler_symbol: Option<String>,
    source_file: String,
    line: usize,
    excerpt: String,
    confidence: String,
    parser_source: String,
    module_label: String,
    controller_label: String,
}

#[derive(Debug, Clone, Default)]
struct ApiGroupBuild {
    id: String,
    label: String,
    level: String,
    parent_id: Option<String>,
    endpoint_ids: BTreeSet<String>,
    child_group_ids: BTreeSet<String>,
    protocol_counts: BTreeMap<String, usize>,
    language_counts: BTreeMap<String, usize>,
    confidence_counts: BTreeMap<String, usize>,
}

fn api_trimmed_excerpt(line: &str) -> String {
    line.trim().chars().take(220).collect()
}

fn redact_api_evidence_excerpt(line: &str) -> (String, bool) {
    let excerpt = api_trimmed_excerpt(line);
    let lowered = excerpt.to_ascii_lowercase();
    let contains_sensitive_marker = [
        "authorization",
        "set-cookie",
        "cookie",
        "bearer ",
        "token",
        "password",
        "passwd",
        "secret",
        "api_key",
        "api-key",
        "api key",
        "apikey",
        "private_key",
        "private-key",
        "private key",
        "credential",
    ]
    .iter()
    .any(|marker| lowered.contains(marker));
    if contains_sensitive_marker {
        ("[redacted sensitive API evidence]".to_string(), true)
    } else {
        (excerpt, false)
    }
}

fn api_evidence_payload(
    source_file: &str,
    line: usize,
    excerpt: &str,
    parser_source: &str,
    generated_at: &str,
) -> Value {
    let (safe_excerpt, redacted) = redact_api_evidence_excerpt(excerpt);
    json!({
        "path": source_file,
        "line": line,
        "excerpt": safe_excerpt,
        "redacted": redacted,
        "parserSource": parser_source,
        "extractorVersion": "project-map-api-contract-v1",
        "observedAt": generated_at
    })
}

fn normalize_api_path(value: Option<String>) -> Option<String> {
    let raw = value?.trim().to_string();
    if raw.is_empty() {
        return Some("/".to_string());
    }
    if raw.starts_with('/') {
        Some(raw)
    } else {
        Some(format!("/{raw}"))
    }
}

fn join_api_paths(prefix: &str, path: Option<String>) -> Option<String> {
    let path = normalize_api_path(path)?;
    let prefix = normalize_api_path(Some(prefix.to_string())).unwrap_or_else(|| "/".to_string());
    if prefix == "/" {
        return Some(path);
    }
    if path == "/" {
        return Some(prefix);
    }
    Some(format!(
        "{}/{}",
        prefix.trim_end_matches('/'),
        path.trim_start_matches('/')
    ))
}

fn parse_api_methods_from_line(line: &str) -> Vec<String> {
    let upper = line.to_ascii_uppercase();
    ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"]
        .iter()
        .filter(|method| upper.contains(**method))
        .map(|method| method.to_string())
        .collect()
}

fn handler_after_first_comma(line: &str) -> Option<String> {
    let (_, tail) = line.split_once(',')?;
    let raw = tail
        .split([',', ')', ']'])
        .next()
        .unwrap_or(tail)
        .trim()
        .trim_start_matches('&')
        .trim_start_matches('*')
        .trim();
    if raw.is_empty() {
        None
    } else {
        Some(raw.to_string())
    }
}

fn handler_name_before_parenthesis(line: &str) -> Option<String> {
    let trimmed = line.trim();
    if trimmed.starts_with('@') || trimmed.starts_with('#') || trimmed.starts_with('[') {
        return None;
    }
    let before_parenthesis = trimmed.split_once('(')?.0.trim();
    let token = before_parenthesis
        .split_whitespace()
        .last()?
        .trim_matches(|character: char| !character.is_alphanumeric() && character != '_' && character != '$');
    if token.is_empty()
        || matches!(
            token,
            "if" | "for" | "while" | "switch" | "catch" | "return" | "new" | "class"
        )
    {
        None
    } else {
        Some(token.to_string())
    }
}

fn file_stem_label(path: &str) -> String {
    path.rsplit('/')
        .next()
        .unwrap_or(path)
        .split('.')
        .next()
        .unwrap_or(path)
        .to_string()
}

fn api_module_label(file: &ScannedFile) -> String {
    let path = file.path.replace('\\', "/");
    if let Some(package_path) = path
        .strip_prefix("src/main/java/")
        .or_else(|| path.strip_prefix("src/main/kotlin/"))
        .and_then(|tail| tail.rsplit_once('/').map(|(directory, _)| directory.replace('/', ".")))
    {
        if !package_path.is_empty() {
            return package_path;
        }
    }
    module_label(&file.path)
}

fn push_api_route_candidate(
    candidates: &mut Vec<ApiRouteCandidate>,
    file: &ScannedFile,
    annotation: ApiRouteAnnotation,
    line: usize,
    excerpt: &str,
    handler_symbol: Option<String>,
    controller_label: Option<String>,
) {
    let method = annotation.method.map(|value| value.to_ascii_uppercase());
    let path = normalize_api_path(annotation.path);
    let handler_symbol = handler_symbol.filter(|value| !value.trim().is_empty());
    let controller_label = controller_label
        .filter(|value| !value.trim().is_empty())
        .or_else(|| handler_symbol.clone())
        .unwrap_or_else(|| file_stem_label(&file.path));
    candidates.push(ApiRouteCandidate {
        protocol: "http".to_string(),
        language: file.language.clone(),
        framework: Some(annotation.framework),
        method,
        path,
        operation_name: None,
        handler_symbol,
        source_file: file.path.clone(),
        line,
        excerpt: api_trimmed_excerpt(excerpt),
        confidence: annotation.confidence,
        parser_source: annotation.parser_source,
        module_label: api_module_label(file),
        controller_label,
    });
}

fn spring_route_annotation(line: &str) -> Option<ApiRouteAnnotation> {
    let trimmed = line.trim();
    let route = if trimmed.contains("@GetMapping") {
        Some(("GET", "Spring MVC"))
    } else if trimmed.contains("@PostMapping") {
        Some(("POST", "Spring MVC"))
    } else if trimmed.contains("@PutMapping") {
        Some(("PUT", "Spring MVC"))
    } else if trimmed.contains("@DeleteMapping") {
        Some(("DELETE", "Spring MVC"))
    } else if trimmed.contains("@PatchMapping") {
        Some(("PATCH", "Spring MVC"))
    } else if trimmed.contains("@RequestMapping") {
        None
    } else {
        return None;
    };
    let method = route
        .map(|(method, _)| method.to_string())
        .or_else(|| parse_api_methods_from_line(trimmed).first().cloned());
    Some(ApiRouteAnnotation {
        method,
        path: first_quoted_value(trimmed),
        framework: route.map(|(_, framework)| framework).unwrap_or("Spring MVC").to_string(),
        confidence: if trimmed.contains("@RequestMapping") { "medium" } else { "high" }.to_string(),
        parser_source: "fallback-pattern".to_string(),
    })
}

fn extract_java_api_candidates(file: &ScannedFile, content: &str) -> Vec<ApiRouteCandidate> {
    let mut candidates = Vec::new();
    let class_name = java_declared_type(content).unwrap_or_else(|| file_stem_label(&file.path));
    let mut class_prefix = "/".to_string();
    let mut pending_annotations = Vec::<ApiRouteAnnotation>::new();

    for (line_index, line) in content.lines().enumerate() {
        let line_number = line_index + 1;
        if let Some(annotation) = spring_route_annotation(line) {
            if let Some(method_name) = handler_name_before_parenthesis(line) {
                let mut route = annotation;
                route.path = join_api_paths(&class_prefix, route.path);
                push_api_route_candidate(
                    &mut candidates,
                    file,
                    route,
                    line_number,
                    line,
                    Some(format!("{class_name}.{method_name}")),
                    Some(class_name.clone()),
                );
            } else {
                pending_annotations.push(annotation);
            }
            continue;
        }

        let trimmed = line.trim();
        if !pending_annotations.is_empty()
            && (trimmed.contains(" class ") || trimmed.starts_with("class ") || trimmed.contains(" interface "))
        {
            if let Some(prefix) = pending_annotations
                .iter()
                .rev()
                .find_map(|annotation| annotation.path.clone())
                .and_then(|path| normalize_api_path(Some(path)))
            {
                class_prefix = prefix;
            }
            pending_annotations.clear();
            continue;
        }

        if pending_annotations.is_empty() {
            continue;
        }
        let Some(method_name) = handler_name_before_parenthesis(line) else {
            continue;
        };
        for mut annotation in pending_annotations.drain(..) {
            annotation.path = join_api_paths(&class_prefix, annotation.path);
            push_api_route_candidate(
                &mut candidates,
                file,
                annotation,
                line_number,
                line,
                Some(format!("{class_name}.{method_name}")),
                Some(class_name.clone()),
            );
        }
    }

    candidates
}

fn python_route_annotation(line: &str) -> Option<ApiRouteAnnotation> {
    let trimmed = line.trim();
    if !trimmed.starts_with('@') {
        return None;
    }
    let lower = trimmed.to_ascii_lowercase();
    for (needle, method, framework) in [
        (".get(", "GET", "FastAPI"),
        (".post(", "POST", "FastAPI"),
        (".put(", "PUT", "FastAPI"),
        (".delete(", "DELETE", "FastAPI"),
        (".patch(", "PATCH", "FastAPI"),
    ] {
        if lower.contains(needle) {
            return Some(ApiRouteAnnotation {
                method: Some(method.to_string()),
                path: first_quoted_value(trimmed),
                framework: framework.to_string(),
                confidence: "high".to_string(),
                parser_source: "fallback-pattern".to_string(),
            });
        }
    }
    if lower.contains(".route(") {
        return Some(ApiRouteAnnotation {
            method: parse_api_methods_from_line(trimmed).first().cloned(),
            path: first_quoted_value(trimmed),
            framework: "Flask".to_string(),
            confidence: "medium".to_string(),
            parser_source: "fallback-pattern".to_string(),
        });
    }
    None
}

fn extract_python_api_candidates(file: &ScannedFile, content: &str) -> Vec<ApiRouteCandidate> {
    let mut candidates = Vec::new();
    let mut pending_annotations = Vec::<ApiRouteAnnotation>::new();
    for (line_index, line) in content.lines().enumerate() {
        let line_number = line_index + 1;
        let trimmed = line.trim();
        if let Some(annotation) = python_route_annotation(line) {
            pending_annotations.push(annotation);
            continue;
        }
        if !pending_annotations.is_empty() && trimmed.starts_with("def ") {
            let handler = trimmed
                .strip_prefix("def ")
                .and_then(|tail| tail.split_once('(').map(|(name, _)| name.trim().to_string()));
            for annotation in pending_annotations.drain(..) {
                push_api_route_candidate(
                    &mut candidates,
                    file,
                    annotation,
                    line_number,
                    line,
                    handler.clone(),
                    Some(file_stem_label(&file.path)),
                );
            }
            continue;
        }
        if trimmed.starts_with("path(") || trimmed.contains(" path(") || trimmed.starts_with("re_path(") {
            push_api_route_candidate(
                &mut candidates,
                file,
                ApiRouteAnnotation {
                    method: None,
                    path: first_quoted_value(trimmed),
                    framework: "Django".to_string(),
                    confidence: "medium".to_string(),
                    parser_source: "fallback-pattern".to_string(),
                },
                line_number,
                line,
                handler_after_first_comma(line),
                Some(file_stem_label(&file.path)),
            );
        }
    }
    candidates
}

fn extract_line_call_api_candidates(
    file: &ScannedFile,
    content: &str,
    framework: &str,
    methods: &[(&str, &str)],
) -> Vec<ApiRouteCandidate> {
    let mut candidates = Vec::new();
    for (line_index, line) in content.lines().enumerate() {
        let lower = line.to_ascii_lowercase();
        for &(needle, method) in methods {
            if !lower.contains(needle) {
                continue;
            }
            let quoted_path = first_quoted_value(line);
            let route_like_path = quoted_path
                .as_deref()
                .map(|path| path.starts_with('/') || path.starts_with(':') || path.contains('{'))
                .unwrap_or(false);
            let route_like_context = lower.contains("router")
                || lower.contains("route")
                || lower.contains("app.")
                || lower.contains("server")
                || lower.contains("http")
                || lower.trim_start().starts_with('@')
                || lower.trim_start().starts_with('[')
                || lower.contains("mapget")
                || lower.contains("mappost")
                || lower.contains("mapput")
                || lower.contains("mapdelete")
                || lower.contains("mappatch")
                || lower.contains("crow_route")
                || lower.contains("mg_http_match_uri");
            if !route_like_path && !route_like_context {
                continue;
            }
            push_api_route_candidate(
                &mut candidates,
                file,
                ApiRouteAnnotation {
                    method: Some((*method).to_string()),
                    path: quoted_path,
                    framework: framework.to_string(),
                    confidence: "medium".to_string(),
                    parser_source: "fallback-pattern".to_string(),
                },
                line_index + 1,
                line,
                handler_after_first_comma(line),
                Some(file_stem_label(&file.path)),
            );
        }
    }
    candidates
}

fn extract_go_api_candidates(file: &ScannedFile, content: &str) -> Vec<ApiRouteCandidate> {
    let mut candidates = extract_line_call_api_candidates(
        file,
        content,
        "Go router",
        &[
            (".get(", "GET"),
            (".post(", "POST"),
            (".put(", "PUT"),
            (".delete(", "DELETE"),
            (".patch(", "PATCH"),
            (".handlefunc(", ""),
        ],
    );
    for candidate in &mut candidates {
        if candidate.method.as_deref() == Some("") {
            candidate.method = None;
            candidate.framework = Some("net/http".to_string());
        }
    }
    candidates
}

fn extract_typescript_api_candidates(file: &ScannedFile, content: &str) -> Vec<ApiRouteCandidate> {
    let mut candidates = extract_line_call_api_candidates(
        file,
        content,
        "Node router",
        &[
            (".get(", "GET"),
            (".post(", "POST"),
            (".put(", "PUT"),
            (".delete(", "DELETE"),
            (".patch(", "PATCH"),
            ("@get(", "GET"),
            ("@post(", "POST"),
            ("@put(", "PUT"),
            ("@delete(", "DELETE"),
            ("@patch(", "PATCH"),
        ],
    );
    for candidate in &mut candidates {
        if candidate.excerpt.trim_start().starts_with('@') {
            candidate.framework = Some("NestJS".to_string());
        }
    }
    candidates
}

fn extract_csharp_api_candidates(file: &ScannedFile, content: &str) -> Vec<ApiRouteCandidate> {
    let mut candidates = extract_line_call_api_candidates(
        file,
        content,
        "ASP.NET Core",
        &[
            ("mapget(", "GET"),
            ("mappost(", "POST"),
            ("mapput(", "PUT"),
            ("mapdelete(", "DELETE"),
            ("mappatch(", "PATCH"),
            ("[httpget", "GET"),
            ("[httppost", "POST"),
            ("[httpput", "PUT"),
            ("[httpdelete", "DELETE"),
            ("[httppatch", "PATCH"),
        ],
    );
    for candidate in &mut candidates {
        if candidate.path.is_none() && candidate.excerpt.contains('(') {
            candidate.path = Some("/".to_string());
        }
    }
    candidates
}

fn extract_rust_api_candidates(file: &ScannedFile, content: &str) -> Vec<ApiRouteCandidate> {
    extract_line_call_api_candidates(
        file,
        content,
        "Rust web",
        &[
            (".route(", ""),
            ("#[get(", "GET"),
            ("#[post(", "POST"),
            ("#[put(", "PUT"),
            ("#[delete(", "DELETE"),
            ("#[patch(", "PATCH"),
        ],
    )
    .into_iter()
    .map(|mut candidate| {
        if candidate.method.as_deref() == Some("") {
            candidate.method = parse_api_methods_from_line(&candidate.excerpt).first().cloned();
            candidate.framework = Some("Axum/Rocket".to_string());
        }
        candidate
    })
    .collect()
}

fn extract_c_family_api_candidates(file: &ScannedFile, content: &str) -> Vec<ApiRouteCandidate> {
    let framework = if file.language == "c" { "C HTTP handler" } else { "C++ HTTP framework" };
    let mut candidates = extract_line_call_api_candidates(
        file,
        content,
        framework,
        &[
            ("crow_route(", ""),
            (".get(", "GET"),
            (".post(", "POST"),
            (".put(", "PUT"),
            (".delete(", "DELETE"),
            ("mg_http_match_uri(", ""),
        ],
    );
    for candidate in &mut candidates {
        if candidate.method.as_deref() == Some("") {
            candidate.method = None;
            candidate.confidence = "low".to_string();
        }
    }
    candidates
}

fn extract_project_api_candidates(file: &ScannedFile, content: &str) -> Vec<ApiRouteCandidate> {
    match file.language.as_str() {
        "java" | "kotlin" => extract_java_api_candidates(file, content),
        "python" => extract_python_api_candidates(file, content),
        "go" => extract_go_api_candidates(file, content),
        "typescript" | "javascript" | "vue" | "svelte" => extract_typescript_api_candidates(file, content),
        "csharp" => extract_csharp_api_candidates(file, content),
        "rust" => extract_rust_api_candidates(file, content),
        "c" | "cpp" => extract_c_family_api_candidates(file, content),
        _ => Vec::new(),
    }
}

fn api_path_parameters(path: Option<&str>, candidate: &ApiRouteCandidate, generated_at: &str) -> Vec<Value> {
    let Some(path) = path else {
        return Vec::new();
    };
    let mut parameters = Vec::new();
    let mut seen = BTreeSet::new();
    for segment in path.split('/') {
        let name = if segment.starts_with('{') && segment.ends_with('}') {
            segment.trim_start_matches('{').trim_end_matches('}').to_string()
        } else if let Some(name) = segment.strip_prefix(':') {
            name.to_string()
        } else if segment.starts_with('<') && segment.ends_with('>') {
            segment.trim_start_matches('<').trim_end_matches('>').to_string()
        } else {
            continue;
        };
        if name.is_empty() || !seen.insert(name.clone()) {
            continue;
        }
        parameters.push(json!({
            "name": name,
            "location": "path",
            "required": true,
            "evidence": [api_evidence_json(candidate, generated_at)]
        }));
    }
    parameters
}

fn api_evidence_json(candidate: &ApiRouteCandidate, generated_at: &str) -> Value {
    api_evidence_payload(
        &candidate.source_file,
        candidate.line,
        &candidate.excerpt,
        &candidate.parser_source,
        generated_at,
    )
}

fn api_schema_ref_json(type_name: &str, candidate: &ApiRouteCandidate, generated_at: &str) -> Option<Value> {
    let normalized = type_name
        .trim()
        .trim_start_matches("final ")
        .trim_start_matches("const ")
        .trim()
        .trim_end_matches("...")
        .trim();
    if normalized.is_empty() || matches!(normalized, "void" | "Void" | "Unit") {
        return None;
    }
    Some(json!({
        "id": format!("api-schema-{}", stable_hash(&format!("{}|{}", candidate.source_file, normalized))),
        "name": normalized,
        "language": candidate.language.clone(),
        "sourceFile": candidate.source_file.clone(),
        "evidence": [api_evidence_json(candidate, generated_at)]
    }))
}

fn api_signature_parameter_text(signature: &str) -> Option<String> {
    let start = signature.find('(')?;
    let end = signature.rfind(')')?;
    if end <= start {
        return None;
    }
    Some(signature[start + 1..end].to_string())
}

fn split_api_signature_parameters(value: &str) -> Vec<String> {
    let mut parameters = Vec::new();
    let mut current = String::new();
    let mut angle_depth = 0usize;
    let mut paren_depth = 0usize;
    for character in value.chars() {
        match character {
            '<' => {
                angle_depth += 1;
                current.push(character);
            }
            '>' => {
                angle_depth = angle_depth.saturating_sub(1);
                current.push(character);
            }
            '(' => {
                paren_depth += 1;
                current.push(character);
            }
            ')' => {
                paren_depth = paren_depth.saturating_sub(1);
                current.push(character);
            }
            ',' if angle_depth == 0 && paren_depth == 0 => {
                let trimmed = current.trim();
                if !trimmed.is_empty() {
                    parameters.push(trimmed.to_string());
                }
                current.clear();
            }
            _ => current.push(character),
        }
    }
    let trimmed = current.trim();
    if !trimmed.is_empty() {
        parameters.push(trimmed.to_string());
    }
    parameters
}

fn api_parameter_location_from_signature(parameter: &str) -> Option<&'static str> {
    if parameter.contains("@PathVariable") {
        Some("path")
    } else if parameter.contains("@RequestParam") {
        Some("query")
    } else if parameter.contains("@RequestHeader") {
        Some("header")
    } else if parameter.contains("@CookieValue") {
        Some("cookie")
    } else {
        None
    }
}

fn strip_java_annotations(value: &str) -> String {
    let mut output = String::new();
    let mut chars = value.chars().peekable();
    while let Some(character) = chars.next() {
        if character != '@' {
            output.push(character);
            continue;
        }
        while let Some(next) = chars.peek().copied() {
            if next.is_whitespace() || next == '(' {
                break;
            }
            chars.next();
        }
        if chars.peek() == Some(&'(') {
            let mut depth = 0usize;
            for next in chars.by_ref() {
                if next == '(' {
                    depth += 1;
                } else if next == ')' {
                    depth = depth.saturating_sub(1);
                    if depth == 0 {
                        break;
                    }
                }
            }
        }
        output.push(' ');
    }
    output
}

fn api_parameter_name_and_type(parameter: &str) -> Option<(String, String)> {
    let explicit_name = first_quoted_value(parameter);
    let cleaned = strip_java_annotations(parameter)
        .replace("final ", " ")
        .replace("const ", " ")
        .replace("...", " ");
    let tokens = cleaned
        .split_whitespace()
        .filter(|token| !matches!(*token, "public" | "private" | "protected" | "static" | "final"))
        .collect::<Vec<_>>();
    let fallback_name = tokens.last()?.trim_matches(|character: char| {
        !character.is_alphanumeric() && character != '_'
    });
    let name = explicit_name.unwrap_or_else(|| fallback_name.to_string());
    if name.is_empty() {
        return None;
    }
    let type_name = tokens
        .iter()
        .rev()
        .skip(1)
        .next()
        .copied()
        .unwrap_or("unknown")
        .trim()
        .to_string();
    Some((name, type_name))
}

fn api_signature_parameters(candidate: &ApiRouteCandidate, generated_at: &str) -> Vec<Value> {
    let Some(parameters_text) = api_signature_parameter_text(&candidate.excerpt) else {
        return Vec::new();
    };
    split_api_signature_parameters(&parameters_text)
        .into_iter()
        .flat_map(|parameter| {
            let Some(location) = api_parameter_location_from_signature(&parameter) else {
                return Vec::new();
            };
            let Some((name, type_name)) = api_parameter_name_and_type(&parameter) else {
                return Vec::new();
            };
            vec![json!({
                "name": name,
                "location": location,
                "required": location == "path",
                "schema": api_schema_ref_json(&type_name, candidate, generated_at),
                "evidence": [api_evidence_json(candidate, generated_at)]
            })]
        })
        .collect()
}

fn api_request_body(candidate: &ApiRouteCandidate, generated_at: &str) -> Option<Value> {
    let parameters_text = api_signature_parameter_text(&candidate.excerpt)?;
    split_api_signature_parameters(&parameters_text)
        .into_iter()
        .find(|parameter| parameter.contains("@RequestBody"))
        .and_then(|parameter| api_parameter_name_and_type(&parameter))
        .map(|(_, type_name)| json!({
            "contentType": "application/json",
            "required": true,
            "schema": api_schema_ref_json(&type_name, candidate, generated_at),
            "evidence": [api_evidence_json(candidate, generated_at)]
        }))
}

fn api_signature_response(candidate: &ApiRouteCandidate, generated_at: &str) -> Vec<Value> {
    let Some(handler_symbol) = candidate.handler_symbol.as_deref() else {
        return Vec::new();
    };
    let Some(method_name) = handler_symbol.rsplit('.').next() else {
        return Vec::new();
    };
    let Some((prefix, _)) = candidate.excerpt.split_once(&format!("{method_name}(")) else {
        return Vec::new();
    };
    let return_type = prefix
        .split_whitespace()
        .rev()
        .find(|token| !matches!(*token, "public" | "private" | "protected" | "static" | "final" | "async"));
    let Some(return_type) = return_type else {
        return Vec::new();
    };
    if matches!(return_type, "void" | "Void") {
        return Vec::new();
    }
    vec![json!({
        "statusCode": "200",
        "contentType": "application/json",
        "schema": api_schema_ref_json(return_type, candidate, generated_at),
        "isError": false,
        "evidence": [api_evidence_json(candidate, generated_at)]
    })]
}

fn api_endpoint_id(candidate: &ApiRouteCandidate) -> String {
    let fingerprint = format!(
        "{}|{}|{}|{}|{}",
        candidate.protocol,
        candidate.method.as_deref().unwrap_or("*").to_ascii_uppercase(),
        candidate.path.as_deref().unwrap_or("").to_ascii_lowercase(),
        candidate.source_file.to_ascii_lowercase(),
        candidate.handler_symbol.as_deref().unwrap_or("")
    );
    format!("api-endpoint-{}", stable_hash(&fingerprint))
}

fn api_group_id(level: &str, label: &str, parent_id: Option<&str>) -> String {
    format!(
        "api-group-{}",
        stable_hash(&format!(
            "{}|{}|{}",
            level,
            label.to_ascii_lowercase(),
            parent_id.unwrap_or("")
        ))
    )
}

fn increment_api_group_counts(group: &mut ApiGroupBuild, candidate: &ApiRouteCandidate) {
    *group.protocol_counts.entry(candidate.protocol.clone()).or_insert(0) += 1;
    *group.language_counts.entry(candidate.language.clone()).or_insert(0) += 1;
    *group.confidence_counts.entry(candidate.confidence.clone()).or_insert(0) += 1;
}

pub(crate) fn build_api_contract_artifact(
    file_contents: &[(ScannedFile, String)],
    storage_key: &str,
    scan_run_id: &str,
    generated_at: &str,
    ignored_paths: &[Value],
) -> Value {
    let mut candidates = file_contents
        .iter()
        .flat_map(|(file, content)| extract_project_api_candidates(file, content))
        .collect::<Vec<_>>();
    candidates.sort_by(|left, right| {
        left.source_file
            .cmp(&right.source_file)
            .then(left.line.cmp(&right.line))
            .then(left.path.cmp(&right.path))
    });

    let mut endpoints = Vec::new();
    let mut groups = BTreeMap::<String, ApiGroupBuild>::new();
    let mut seen_endpoints = BTreeSet::new();

    for candidate in candidates {
        let endpoint_id = api_endpoint_id(&candidate);
        if !seen_endpoints.insert(endpoint_id.clone()) {
            continue;
        }
        let group_layers = [
            ("protocol", candidate.protocol.to_ascii_uppercase()),
            ("module", candidate.module_label.clone()),
            ("controller", candidate.controller_label.clone()),
        ];
        let mut parent_id: Option<String> = None;
        let mut group_ids = Vec::new();
        for (level, label) in group_layers {
            let group_id = api_group_id(level, &label, parent_id.as_deref());
            {
                let group = groups.entry(group_id.clone()).or_insert_with(|| ApiGroupBuild {
                    id: group_id.clone(),
                    label: label.clone(),
                    level: level.to_string(),
                    parent_id: parent_id.clone(),
                    ..ApiGroupBuild::default()
                });
                group.endpoint_ids.insert(endpoint_id.clone());
                increment_api_group_counts(group, &candidate);
            }
            if let Some(parent) = parent_id.as_ref().and_then(|id| groups.get_mut(id)) {
                parent.child_group_ids.insert(group_id.clone());
            }
            parent_id = Some(group_id.clone());
            group_ids.push(group_id);
        }
        let mut parameters = api_path_parameters(candidate.path.as_deref(), &candidate, generated_at);
        parameters.extend(api_signature_parameters(&candidate, generated_at));
        let request_body = api_request_body(&candidate, generated_at);
        let responses = api_signature_response(&candidate, generated_at);
        let evidence = api_evidence_json(&candidate, generated_at);
        endpoints.push(json!({
            "id": endpoint_id,
            "protocol": candidate.protocol,
            "language": candidate.language,
            "framework": candidate.framework,
            "method": candidate.method,
            "path": candidate.path,
            "operationName": candidate.operation_name,
            "handlerSymbol": candidate.handler_symbol,
            "sourceFile": candidate.source_file,
            "parameters": parameters,
            "requestBody": request_body,
            "responses": responses,
            "groupIds": group_ids,
            "callChainIds": [],
            "confidence": candidate.confidence,
            "evidence": [evidence]
        }));
    }

    let groups = groups
        .into_values()
        .map(|group| json!({
            "id": group.id,
            "label": group.label,
            "level": group.level,
            "parentId": group.parent_id,
            "endpointIds": group.endpoint_ids.into_iter().collect::<Vec<_>>(),
            "childGroupIds": group.child_group_ids.into_iter().collect::<Vec<_>>(),
            "protocolCounts": group.protocol_counts,
            "languageCounts": group.language_counts,
            "confidenceCounts": group.confidence_counts
        }))
        .collect::<Vec<_>>();

    let mut skipped_by_reason = BTreeMap::<String, usize>::new();
    for item in ignored_paths {
        let reason = item
            .get("source")
            .and_then(Value::as_str)
            .or_else(|| item.get("reason").and_then(Value::as_str))
            .unwrap_or("ignored");
        *skipped_by_reason.entry(reason.to_string()).or_insert(0) += 1;
    }

    json!({
        "schemaVersion": 1,
        "generatedAt": generated_at,
        "storageKey": storage_key,
        "scanRunId": scan_run_id,
        "endpoints": endpoints,
        "groups": groups,
        "schemas": [],
        "callChains": [],
        "skipped": skipped_by_reason
            .into_iter()
            .map(|(reason, count)| json!({ "reason": reason, "count": count }))
            .collect::<Vec<_>>()
    })
}
