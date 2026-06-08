use super::*;

pub(super) fn is_openapi_contract_file(file: &ScannedFile) -> bool {
    let extension = file.extension.to_ascii_lowercase();
    let name = format!("{} {}", file.basename, file.path).to_ascii_lowercase();
    matches!(extension.as_str(), "json" | "yaml" | "yml")
        && (name.contains("openapi") || name.contains("swagger"))
}

fn parse_openapi_document(file: &ScannedFile, content: &str) -> Result<Value, String> {
    match file.extension.to_ascii_lowercase().as_str() {
        "json" => serde_json::from_str(content)
            .map_err(|error| format!("failed to parse OpenAPI JSON {}: {error}", file.path)),
        "yaml" | "yml" => serde_yaml::from_str(content)
            .map_err(|error| format!("failed to parse OpenAPI YAML {}: {error}", file.path)),
        extension => Err(format!(
            "unsupported OpenAPI extension {extension} for {}",
            file.path
        )),
    }
}

fn openapi_document_title(document: &Value, file: &ScannedFile) -> String {
    if let Some(title) = document
        .get("info")
        .and_then(|info| info.get("title"))
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        title.to_string()
    } else {
        file_stem_label(&file.path)
    }
}

fn openapi_line_number(content: &str, path: &str, method: &str) -> usize {
    let method_lower = method.to_ascii_lowercase();
    let mut path_line = None;
    for (index, line) in content.lines().enumerate() {
        let line_number = index + 1;
        if path_line.is_none() && line.contains(path) {
            path_line = Some(line_number);
        }
        let trimmed = line.trim().to_ascii_lowercase();
        if path_line.is_some()
            && (trimmed.starts_with(&format!("{method_lower}:"))
                || trimmed.contains(&format!("\"{method_lower}\""))
                || trimmed.contains(&format!("'{method_lower}'")))
        {
            return line_number;
        }
    }
    path_line.unwrap_or(1)
}

fn openapi_excerpt(content: &str, line: usize, fallback: &str) -> String {
    content
        .lines()
        .nth(line.saturating_sub(1))
        .map(api_trimmed_excerpt)
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| fallback.to_string())
}

fn openapi_schema_ref_name(schema: &Value, fallback_name: &str) -> String {
    schema
        .get("$ref")
        .and_then(Value::as_str)
        .and_then(|reference| reference.rsplit('/').next())
        .or_else(|| schema.get("title").and_then(Value::as_str))
        .or_else(|| schema.get("type").and_then(Value::as_str))
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or(fallback_name)
        .to_string()
}

fn openapi_schema_ref(
    schema: &Value,
    file: &ScannedFile,
    line: usize,
    excerpt: &str,
    generated_at: &str,
    fallback_name: &str,
) -> Option<ApiSchemaRef> {
    if !schema.is_object() {
        return None;
    }
    let name = openapi_schema_ref_name(schema, fallback_name);
    Some(ApiSchemaRef {
        id: format!(
            "api-schema-{}",
            stable_hash(&format!("{}|{}|{}", file.path, line, name))
        ),
        name,
        language: "unknown".to_string(),
        source_file: file.path.clone(),
        evidence: vec![api_evidence_payload(
            &file.path,
            line,
            excerpt,
            "schema-parser",
            generated_at,
        )],
    })
}

fn openapi_first_content_schema(value: &Value) -> (Option<String>, Option<&Value>) {
    let Some(content) = value.get("content").and_then(Value::as_object) else {
        return (None, None);
    };
    content
        .iter()
        .find_map(|(content_type, media)| {
            media
                .get("schema")
                .map(|schema| (Some(content_type.clone()), Some(schema)))
        })
        .unwrap_or((None, None))
}

fn openapi_parameter(
    parameter: &Value,
    file: &ScannedFile,
    line: usize,
    excerpt: &str,
    generated_at: &str,
) -> Option<ApiParameter> {
    let name = parameter.get("name").and_then(Value::as_str)?.trim();
    if name.is_empty() {
        return None;
    }
    let location = parameter
        .get("in")
        .and_then(Value::as_str)
        .unwrap_or("query")
        .trim()
        .to_string();
    let schema = parameter
        .get("schema")
        .or_else(|| parameter.get("type").map(|_| parameter))
        .and_then(|schema| openapi_schema_ref(schema, file, line, excerpt, generated_at, name));
    let example = parameter
        .get("example")
        .and_then(Value::as_str)
        .map(|value| redact_api_evidence_excerpt(value).0);
    Some(ApiParameter {
        name: name.to_string(),
        location,
        required: parameter
            .get("required")
            .and_then(Value::as_bool)
            .unwrap_or(false),
        schema,
        description: parameter
            .get("description")
            .and_then(Value::as_str)
            .map(str::to_string),
        default_value: None,
        example,
        structured_fields: Vec::new(),
        evidence: vec![api_evidence_payload(
            &file.path,
            line,
            excerpt,
            "schema-parser",
            generated_at,
        )],
    })
}

fn openapi_parameters(
    path_item: &Value,
    operation: &Value,
    file: &ScannedFile,
    line: usize,
    excerpt: &str,
    generated_at: &str,
) -> Vec<ApiParameter> {
    let mut parameters = Vec::new();
    for source in [path_item.get("parameters"), operation.get("parameters")] {
        let Some(items) = source.and_then(Value::as_array) else {
            continue;
        };
        for item in items {
            if let Some(parameter) = openapi_parameter(item, file, line, excerpt, generated_at) {
                parameters.push(parameter);
            }
        }
    }
    parameters
}

fn openapi_request_body(
    operation: &Value,
    parameters: &[ApiParameter],
    file: &ScannedFile,
    line: usize,
    excerpt: &str,
    generated_at: &str,
) -> Option<ApiRequestBody> {
    if let Some(body) = operation.get("requestBody") {
        let (content_type, schema) = openapi_first_content_schema(body);
        return Some(ApiRequestBody {
            content_type,
            required: body
                .get("required")
                .and_then(Value::as_bool)
                .unwrap_or(false),
            schema: schema.and_then(|schema| {
                openapi_schema_ref(schema, file, line, excerpt, generated_at, "requestBody")
            }),
            structured_fields: Vec::new(),
            examples: Vec::new(),
            evidence: vec![api_evidence_payload(
                &file.path,
                line,
                excerpt,
                "schema-parser",
                generated_at,
            )],
        });
    }
    parameters
        .iter()
        .find(|parameter| parameter.location == "body")
        .map(|parameter| ApiRequestBody {
            content_type: Some("application/json".to_string()),
            required: parameter.required,
            schema: parameter.schema.clone(),
            structured_fields: Vec::new(),
            examples: Vec::new(),
            evidence: parameter.evidence.clone(),
        })
}

fn openapi_response(
    status_code: &str,
    response: &Value,
    file: &ScannedFile,
    line: usize,
    excerpt: &str,
    generated_at: &str,
) -> ApiResponse {
    let (content_type, schema) = openapi_first_content_schema(response);
    let swagger_schema = response.get("schema");
    let schema = schema.or(swagger_schema).and_then(|schema| {
        openapi_schema_ref(schema, file, line, excerpt, generated_at, status_code)
    });
    let is_error = status_code == "default"
        || status_code
            .parse::<u16>()
            .map(|code| code >= 400)
            .unwrap_or(false);
    ApiResponse {
        status_code: Some(status_code.to_string()),
        content_type,
        schema,
        structured_fields: Vec::new(),
        examples: Vec::new(),
        is_error,
        evidence: vec![api_evidence_payload(
            &file.path,
            line,
            excerpt,
            "schema-parser",
            generated_at,
        )],
    }
}

fn openapi_responses(
    operation: &Value,
    file: &ScannedFile,
    line: usize,
    excerpt: &str,
    generated_at: &str,
) -> Vec<ApiResponse> {
    let Some(responses) = operation.get("responses").and_then(Value::as_object) else {
        return Vec::new();
    };
    responses
        .iter()
        .map(|(status_code, response)| {
            openapi_response(status_code, response, file, line, excerpt, generated_at)
        })
        .collect()
}

pub(super) fn extract_openapi_contract_candidates(
    file: &ScannedFile,
    content: &str,
    generated_at: &str,
) -> Result<Vec<ApiRouteCandidate>, String> {
    let document = parse_openapi_document(file, content)?;
    let Some(paths) = document.get("paths").and_then(Value::as_object) else {
        return Ok(Vec::new());
    };
    let title = openapi_document_title(&document, file);
    let base_path = document
        .get("basePath")
        .and_then(Value::as_str)
        .map(str::to_string);
    let mut candidates = Vec::new();
    for (raw_path, path_item) in paths {
        let Some(path_item_object) = path_item.as_object() else {
            continue;
        };
        for method in [
            "get", "post", "put", "delete", "patch", "options", "head", "trace",
        ] {
            let Some(operation) = path_item_object.get(method) else {
                continue;
            };
            let line = openapi_line_number(content, raw_path, method);
            let excerpt = openapi_excerpt(
                content,
                line,
                &format!("{} {}", method.to_ascii_uppercase(), raw_path),
            );
            let parameters =
                openapi_parameters(path_item, operation, file, line, &excerpt, generated_at);
            let request_body =
                openapi_request_body(operation, &parameters, file, line, &excerpt, generated_at);
            let responses = openapi_responses(operation, file, line, &excerpt, generated_at);
            let operation_name = operation
                .get("operationId")
                .and_then(Value::as_str)
                .map(str::to_string);
            let tag = operation
                .get("tags")
                .and_then(Value::as_array)
                .and_then(|tags| tags.first())
                .and_then(Value::as_str)
                .map(str::to_string);
            let description = operation
                .get("summary")
                .and_then(Value::as_str)
                .or_else(|| operation.get("description").and_then(Value::as_str))
                .map(str::to_string);
            let path = base_path
                .as_deref()
                .and_then(|prefix| join_api_paths(prefix, Some(raw_path.clone())))
                .or_else(|| normalize_api_path(Some(raw_path.clone())));
            let response_schema = responses
                .iter()
                .find_map(|response| response.schema.clone());
            candidates.push(ApiRouteCandidate {
                protocol: "http".to_string(),
                language: "unknown".to_string(),
                framework: Some(if document.get("swagger").is_some() {
                    "Swagger".to_string()
                } else {
                    "OpenAPI".to_string()
                }),
                method: Some(method.to_ascii_uppercase()),
                path,
                operation_name,
                handler_symbol: None,
                source_file: file.path.clone(),
                line,
                excerpt,
                confidence: "spec".to_string(),
                parser_source: "schema-parser".to_string(),
                module_label: format!("api-contract:{title}"),
                controller_label: tag.unwrap_or_else(|| title.clone()),
                parameter_overrides: parameters,
                request_schema_override: request_body.as_ref().and_then(|body| body.schema.clone()),
                request_body_override: request_body,
                response_schema_override: response_schema,
                response_overrides: responses,
                description,
                usage_scenario: None,
            });
        }
    }
    Ok(candidates)
}

pub(super) fn is_proto_contract_file(file: &ScannedFile) -> bool {
    file.extension.eq_ignore_ascii_case("proto")
}

pub(super) fn is_graphql_contract_file(file: &ScannedFile) -> bool {
    matches!(
        file.extension.to_ascii_lowercase().as_str(),
        "graphql" | "gql"
    )
}

pub(super) fn api_contract_schema_ref_from_name(
    name: &str,
    file: &ScannedFile,
    line: usize,
    excerpt: &str,
    parser_source: &str,
    generated_at: &str,
) -> Option<ApiSchemaRef> {
    let normalized = name
        .trim()
        .trim_start_matches('&')
        .trim_start_matches('[')
        .trim_end_matches(']')
        .trim_end_matches('!')
        .trim();
    if normalized.is_empty() {
        return None;
    }
    Some(ApiSchemaRef {
        id: format!(
            "api-schema-{}",
            stable_hash(&format!("{}|{}|{}", file.path, line, normalized))
        ),
        name: normalized.to_string(),
        language: "unknown".to_string(),
        source_file: file.path.clone(),
        evidence: vec![api_evidence_payload(
            &file.path,
            line,
            excerpt,
            parser_source,
            generated_at,
        )],
    })
}

fn proto_package_name(content: &str) -> Option<String> {
    content.lines().find_map(|line| {
        let trimmed = line.trim();
        trimmed
            .strip_prefix("package ")
            .map(|tail| tail.trim_end_matches(';').trim().to_string())
            .filter(|value| !value.is_empty())
    })
}

fn proto_rpc_signature(line: &str) -> Option<(String, String, String)> {
    let trimmed = line.trim();
    let rpc_tail = trimmed.strip_prefix("rpc ")?;
    let method = rpc_tail.split_whitespace().next()?.trim();
    let request_start = trimmed.find('(')?;
    let request_end = trimmed[request_start + 1..].find(')')? + request_start + 1;
    let request_type = trimmed[request_start + 1..request_end].trim();
    let returns_index = trimmed.find("returns")?;
    let response_start = trimmed[returns_index..].find('(')? + returns_index;
    let response_end = trimmed[response_start + 1..].find(')')? + response_start + 1;
    let response_type = trimmed[response_start + 1..response_end].trim();
    if method.is_empty() || request_type.is_empty() || response_type.is_empty() {
        return None;
    }
    Some((
        method.to_string(),
        request_type.to_string(),
        response_type.to_string(),
    ))
}

pub(super) fn extract_proto_contract_candidates(
    file: &ScannedFile,
    content: &str,
    generated_at: &str,
) -> Vec<ApiRouteCandidate> {
    let package_name = proto_package_name(content).unwrap_or_else(|| module_label(&file.path));
    let mut service_name: Option<String> = None;
    let mut candidates = Vec::new();
    for (line_index, line) in content.lines().enumerate() {
        let line_number = line_index + 1;
        let trimmed = line.trim();
        if let Some(tail) = trimmed.strip_prefix("service ") {
            service_name = tail
                .split(|character: char| character.is_whitespace() || character == '{')
                .next()
                .map(str::to_string)
                .filter(|value| !value.is_empty());
            continue;
        }
        if trimmed.starts_with('}') {
            service_name = None;
            continue;
        }
        let Some(service) = service_name.clone() else {
            continue;
        };
        let Some((method, request_type, response_type)) = proto_rpc_signature(trimmed) else {
            continue;
        };
        let excerpt = api_trimmed_excerpt(line);
        let request_schema = api_contract_schema_ref_from_name(
            &request_type,
            file,
            line_number,
            &excerpt,
            "descriptor",
            generated_at,
        );
        let response_schema = api_contract_schema_ref_from_name(
            &response_type,
            file,
            line_number,
            &excerpt,
            "descriptor",
            generated_at,
        );
        let operation_name = format!("{service}.{method}");
        candidates.push(ApiRouteCandidate {
            protocol: "grpc".to_string(),
            language: "unknown".to_string(),
            framework: Some("gRPC".to_string()),
            method: None,
            path: None,
            operation_name: Some(operation_name.clone()),
            handler_symbol: Some(operation_name),
            source_file: file.path.clone(),
            line: line_number,
            excerpt,
            confidence: "spec".to_string(),
            parser_source: "descriptor".to_string(),
            module_label: package_name.clone(),
            controller_label: service,
            parameter_overrides: Vec::new(),
            request_body_override: Some(ApiRequestBody {
                content_type: Some("application/grpc".to_string()),
                required: true,
                schema: request_schema.clone(),
                structured_fields: Vec::new(),
                examples: Vec::new(),
                evidence: vec![api_evidence_payload(
                    &file.path,
                    line_number,
                    line,
                    "descriptor",
                    generated_at,
                )],
            }),
            response_overrides: vec![ApiResponse {
                status_code: None,
                content_type: Some("application/grpc".to_string()),
                schema: response_schema.clone(),
                structured_fields: Vec::new(),
                examples: Vec::new(),
                is_error: false,
                evidence: vec![api_evidence_payload(
                    &file.path,
                    line_number,
                    line,
                    "descriptor",
                    generated_at,
                )],
            }],
            request_schema_override: request_schema,
            response_schema_override: response_schema,
            description: None,
            usage_scenario: None,
        });
    }
    candidates
}

fn graphql_field_signature(line: &str) -> Option<(String, Option<String>, String)> {
    let trimmed = line.trim().trim_end_matches(',');
    if trimmed.is_empty() || trimmed.starts_with('#') || trimmed.starts_with('}') {
        return None;
    }
    let (left, response_type) = trimmed.split_once(':')?;
    let field_name = left
        .split('(')
        .next()
        .map(str::trim)
        .filter(|value| !value.is_empty())?;
    let args = left
        .split_once('(')
        .and_then(|(_, tail)| {
            tail.rsplit_once(')')
                .map(|(args, _)| args.trim().to_string())
        })
        .filter(|value| !value.is_empty());
    Some((
        field_name.to_string(),
        args,
        response_type.trim().to_string(),
    ))
}

pub(super) fn extract_graphql_contract_candidates(
    file: &ScannedFile,
    content: &str,
    generated_at: &str,
) -> Vec<ApiRouteCandidate> {
    let mut operation_type: Option<String> = None;
    let mut candidates = Vec::new();
    for (line_index, line) in content.lines().enumerate() {
        let line_number = line_index + 1;
        let trimmed = line.trim();
        for (type_name, operation) in [
            ("type Query", "query"),
            ("type Mutation", "mutation"),
            ("type Subscription", "subscription"),
        ] {
            if trimmed.starts_with(type_name) {
                operation_type = Some(operation.to_string());
            }
        }
        if trimmed.starts_with('}') {
            operation_type = None;
            continue;
        }
        let Some(operation) = operation_type.clone() else {
            continue;
        };
        let Some((field_name, args, response_type)) = graphql_field_signature(trimmed) else {
            continue;
        };
        let excerpt = api_trimmed_excerpt(line);
        let response_schema = api_contract_schema_ref_from_name(
            &response_type,
            file,
            line_number,
            &excerpt,
            "schema-parser",
            generated_at,
        );
        let parameters = args
            .map(|args| {
                split_api_signature_parameters(&args)
                    .into_iter()
                    .flat_map(|parameter| {
                        let (name, type_name) = parameter.split_once(':')?;
                        Some(ApiParameter {
                            name: name.trim().to_string(),
                            location: "body".to_string(),
                            required: type_name.trim().ends_with('!'),
                            schema: api_contract_schema_ref_from_name(
                                type_name,
                                file,
                                line_number,
                                &excerpt,
                                "schema-parser",
                                generated_at,
                            ),
                            description: None,
                            default_value: None,
                            example: None,
                            structured_fields: Vec::new(),
                            evidence: vec![api_evidence_payload(
                                &file.path,
                                line_number,
                                &excerpt,
                                "schema-parser",
                                generated_at,
                            )],
                        })
                    })
                    .collect::<Vec<_>>()
            })
            .unwrap_or_default();
        candidates.push(ApiRouteCandidate {
            protocol: "graphql".to_string(),
            language: "unknown".to_string(),
            framework: Some("GraphQL".to_string()),
            method: Some(operation.clone()),
            path: None,
            operation_name: Some(field_name.clone()),
            handler_symbol: None,
            source_file: file.path.clone(),
            line: line_number,
            excerpt,
            confidence: "spec".to_string(),
            parser_source: "schema-parser".to_string(),
            module_label: module_label(&file.path),
            controller_label: operation,
            parameter_overrides: parameters,
            request_body_override: None,
            response_overrides: vec![ApiResponse {
                status_code: None,
                content_type: Some("application/graphql-response+json".to_string()),
                schema: response_schema.clone(),
                structured_fields: Vec::new(),
                examples: Vec::new(),
                is_error: false,
                evidence: vec![api_evidence_payload(
                    &file.path,
                    line_number,
                    line,
                    "schema-parser",
                    generated_at,
                )],
            }],
            request_schema_override: None,
            response_schema_override: response_schema,
            description: None,
            usage_scenario: None,
        });
    }
    candidates
}
