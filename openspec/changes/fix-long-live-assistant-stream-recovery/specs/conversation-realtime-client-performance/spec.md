## ADDED Requirements

### Requirement: Realtime Performance Budget MUST Cover Single Long Live Assistant Rows

Realtime client performance evidence MUST include the cost of a single active assistant row growing to large text sizes, because list virtualization alone does not bound reducer, Markdown, layout, or scroll work inside that row. The P0 evidence target is Claude Code long output; other engines MAY opt in through the same budget.

#### Scenario: Claude Code long live row diagnostics distinguish local amplification
- **WHEN** Claude Code streams a long assistant message
- **AND** the assistant text grows beyond ordinary preview limits
- **THEN** diagnostics MUST be able to correlate delta ingress cadence, reducer merge cost, normalization cost, render cost, visible text growth, and long task evidence for the same turn
- **AND** diagnostics MUST distinguish local reducer or render amplification from upstream provider delay

#### Scenario: canonical text is not truncated on active append paths
- **WHEN** an active assistant message receives text deltas beyond the display preview budget
- **THEN** the reducer MUST preserve the canonical assistant text without applying preview truncation
- **AND** later deltas MUST merge onto the untruncated canonical body
 - **AND** this MUST hold for both reducer fast path normalization and fallback `prepareThreadItems` normalization

#### Scenario: rollback keeps diagnostics available
- **WHEN** long-row render fallback or shadow recovery is disabled by a rollback flag
- **THEN** realtime diagnostics MUST still record enough ingress, reducer, render, and visible-growth evidence to compare baseline and optimized behavior
