## ADDED Requirements

### Requirement: Near-Threshold Cleanup Recommendations MUST Be Risk-Ordered

Large-file cleanup recommendations MUST rank near-threshold files by hot-path risk, fail-threshold headroom, and compatibility boundary before proposing extraction.

#### Scenario: runtime hot paths outrank passive debt
- **WHEN** near-threshold files are summarized for optimization planning
- **THEN** runtime hot paths MUST be ranked before passive docs, i18n, or test-only debt
- **AND** the report MUST include remaining fail-threshold headroom

#### Scenario: split candidates preserve facades
- **WHEN** a near-threshold file is recommended for splitting
- **THEN** the recommendation MUST state the public facade or compatibility boundary to preserve
- **AND** unrelated hot paths MUST NOT be grouped into one split solely because they are near threshold
