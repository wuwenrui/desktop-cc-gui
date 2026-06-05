# model-structured-output-normalization Specification

## Purpose

Defines the model structured output normalization behavior contract.

## Requirements

### Requirement: Shared model structured-output normalization

The system SHALL provide a reusable normalization path for untrusted model text that extracts structured JSON candidates, parses strict JSON, applies bounded local repair for common model formatting defects, and returns only payloads accepted by a caller-provided domain validator.

#### Scenario: Wrapped JSON is extracted and validated

- **WHEN** a model response includes prose or markdown fences around a JSON object
- **THEN** the normalization path MUST extract candidate JSON objects and return a payload only after the caller validator accepts it

#### Scenario: Common relaxed JSON defects are locally repaired

- **WHEN** a model response uses common relaxed JSON forms such as trailing commas, single quoted strings, unquoted object keys, bare string enum values, or schema placeholder ellipsis outside string literals
- **THEN** the normalization path MUST attempt bounded local repair before failing the parse

#### Scenario: Parsed non-payload JSON is rejected

- **WHEN** a model response contains valid JSON that does not satisfy the caller-provided payload validator
- **THEN** the normalization path MUST reject it as a schema mismatch instead of returning it as trusted data

### Requirement: Bounded structured-output repair retry

A feature that requests structured model output SHALL use at most one JSON-only repair retry when initial normalization fails and the feature can safely rebuild the original prompt context.

#### Scenario: Repair retry succeeds

- **WHEN** initial normalization fails but the JSON-only repair response normalizes into a validator-approved payload
- **THEN** the feature MUST continue with the validated repaired payload

#### Scenario: Repair retry fails closed

- **WHEN** both initial normalization and the JSON-only repair response fail validation
- **THEN** the feature MUST expose a diagnostic failure and MUST NOT persist partial trusted data derived from the failed response

### Requirement: Model-agnostic structured-output handling

Structured-output normalization SHALL NOT branch on provider or model names when repairing, validating, or classifying malformed structured output.

#### Scenario: User switches model provider

- **WHEN** the user switches among Claude, MiniMax, Codex, Gemini, or another supported model for a feature that expects JSON
- **THEN** the feature MUST use the same normalization and validation contract rather than model-specific parsing behavior
