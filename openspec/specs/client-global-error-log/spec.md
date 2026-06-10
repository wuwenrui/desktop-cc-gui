# client-global-error-log Specification

## Purpose
TBD - created by archiving change persist-client-error-log. Update Purpose after archive.
## Requirements
### Requirement: Client MUST Persist Core Error Diagnostics To Global Daily JSONL

系统 MUST 将核心客户端错误诊断追加写入用户全局 `.ccgui/error-log` 目录，并按本地日期每日轮转。

#### Scenario: core debug error is appended

- **WHEN** renderer records a core `DebugEntry` with source `error` or `stderr`
- **THEN** system MUST append a sanitized JSONL record under `~/.ccgui/error-log/YYYY-MM-DD.jsonl`
- **AND** the record MUST include timestamp, source, label, schema version, and bounded payload summary

#### Scenario: stuck-turn settlement diagnostics are appended

- **WHEN** renderer records a thread/session settlement rejected diagnostic or terminal settlement busy residue diagnostic
- **THEN** system MUST append a sanitized JSONL record to the same daily file
- **AND** the record SHOULD preserve correlation fields such as workspaceId, threadId, turnId, engine, diagnosticCategory, and reason when available

#### Scenario: non-core debug noise is not persisted

- **WHEN** renderer records ordinary client/event/server diagnostics that are not error, stderr, or stuck-turn settlement evidence
- **THEN** system MUST keep normal Debug panel behavior
- **AND** system MUST NOT append those entries to the global error log by default

### Requirement: Global Error Log MUST Be Safe, Bounded, And Non-Blocking

系统 MUST 保证全局错误日志不泄漏敏感内容、不无限放大，并且不影响主业务流程。

#### Scenario: sensitive and long text fields are sanitized

- **WHEN** a persisted error payload contains token, password, secret, authorization, cookie, prompt, content, output, stdout, stderr, raw, delta, or equivalent sensitive/long text fields
- **THEN** system MUST redact or summarize those fields before writing
- **AND** system MUST NOT write complete user messages, assistant responses, tool outputs, auth files, or secret values

#### Scenario: payload and log line remain bounded

- **WHEN** an error payload contains deeply nested objects, large arrays, or long strings
- **THEN** system MUST bound depth, array length, string length, and final serialized line size
- **AND** oversized content MUST be represented by explicit truncation metadata

#### Scenario: log write failure does not break app flow

- **WHEN** creating the log directory or appending the JSONL file fails
- **THEN** the original app action MUST continue without throwing through the UI path
- **AND** the log failure MUST NOT recursively create another persisted error entry

### Requirement: Renderer stability diagnostics MUST be classified and capped in the global error log
The global client error log SHALL preserve renderer stability evidence without allowing repeated low-value diagnostics to hide crash evidence.

#### Scenario: renderer stability diagnostic is recorded
- **WHEN** renderer heartbeat miss, process failure, unresponsive state, recovery attempt, or pressure snapshot is recorded
- **THEN** the log entry MUST use a stable renderer diagnostic label
- **AND** the payload MUST be redacted and bounded
- **AND** repeated entries MUST be capped by label and time window

#### Scenario: noisy polling diagnostic repeats
- **WHEN** identical git branch polling failures repeat for the same non-repository workspace path
- **THEN** the global error log MUST dedupe, aggregate, or downgrade the repeated entries
- **AND** renderer crash or pressure diagnostics MUST remain visible in the log timeline

