# Spec: composer-context-project-resource-discovery

## 中文导读

该规格让 Composer/Agent 的资源发现策略优先使用 Project Map 的 relationship context pack。
目的是避免每次都重复做全量扫描，把扫描能力沉底（Project Map），把消费能力做轻（Composer）。

## ADDED Requirements

### Requirement: Project Map context packs are a first-class resource source
Composer resource discovery SHALL consume `project-map-relations/context-packs/latest.json` when available.

#### Scenario: fresh context pack exists
- **WHEN** discovery is triggered for active workspace
- **THEN** composer MAY prioritize must-read files, related files, tests, contracts, and risk flags from context pack

#### Scenario: stale context pack
- **WHEN** context pack is stale
- **THEN** discovery SHALL tag suggestions as stale or request Project Map refresh

### Requirement: no duplicate broad scan if deterministic context is available
Composer SHALL avoid launching another broad file scan for resource ranking when Project Map context is sufficient.

#### Scenario: relationship context covers requested files
- **WHEN** request concerns files present in relationship context
- **THEN** composer SHALL skip re-scan and use existing context data

### Requirement: fallback behavior
Composer SHALL remain backward compatible when Project Map context is missing.

#### Scenario: no relationship data
- **WHEN** no fresh context pack exists
- **THEN** composer SHALL fallback to existing discovery mechanism

### Requirement: context pack fields for composer are explicit
Composer SHALL require stable fields from context packs.

#### Scenario: consume contract
- **WHEN** consuming context pack
- **THEN** composer SHOULD rely on `mustReadFiles`, `relatedFiles`, `testTargets`, `contracts`, `riskFlags`, `provenance`, `staleReason`


## 中文+English 术语对照（Composer Glossary）

- context pack / 上下文包
- resource discovery / 资源发现
- stale suggestions / 陈旧建议
- fallback mode / 回退模式
- deterministic source / 确定性来源
