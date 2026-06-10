# Spec: project-map-incremental-generation

## 中文导读

这份规格明确了两个边界：
- deterministic relationship scan 是事实底座。
- AI/LLM 相关的 project-map generation 只能在其上作语义增强。

如果这条边界不做，系统很容易出现“生成结果越写越离真实代码越远”的回归。

## ADDED Requirements

### Requirement: Deterministic relationships are authoritative substrate
Project Map generation SHALL treat relationship scan data as authoritative facts for graph-like reasoning.

#### Scenario: relationship scan exists
- **WHEN** generation starts and fresh relationship artifacts exist
- **THEN** generator MAY consume `files`, `relations`, `modules`, `impact`, and `context-packs`
- **AND** generated outputs SHALL preserve relation provenance fields (`scanRunId`, relation ids)

#### Scenario: relationship conflict
- **WHEN** generated relation conflicts with deterministic relation
- **THEN** deterministic edge SHALL win and generator output SHALL be flagged as conflicting

### Requirement: generation must not overwrite deterministic edge
The generation system SHALL never overwrite deterministic relation artifacts.

#### Scenario: generator emits relation
- **WHEN** generator proposes new relation edges
- **THEN** it SHALL write only semantic overlays or suggestions, not modify `relations/*.json` directly

### Requirement: stale context awareness in generation
Generation SHALL reflect stale state in prompts and confidence.

#### Scenario: stale scan
- **WHEN** scan is stale by commit/fingerprint
- **THEN** generator SHALL include stale warning and optional refresh path

### Requirement: no redundant broad scans
The system SHALL reuse existing relationship context packs to avoid duplicate scanning.

#### Scenario: fresh context pack exists
- **WHEN** generation needs project-resource discovery
- **THEN** generator SHALL first read context packs rather than re-scan all files

### Requirement: provenance traceability for calibrated nodes
Calibrations and candidates SHALL keep source links to relationship artifacts.

#### Scenario: candidate calibration
- **WHEN** a map node is calibrated
- **THEN** candidate SHALL reference evidence relation/file/run identifiers


## 中文+English 术语对照（Generation Glossary）

- authoritative facts / 权威事实
- semantic overlay / 语义覆盖层
- candidate rejection / 候选拒绝
- stale context / 过期上下文
- provenance / 源头追踪
- calibration / 标定
