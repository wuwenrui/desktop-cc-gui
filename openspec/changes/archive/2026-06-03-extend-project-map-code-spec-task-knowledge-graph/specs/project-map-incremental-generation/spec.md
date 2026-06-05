## ADDED Requirements

### Requirement: Deterministic spec task document graph extraction
Project Map generation SHALL support deterministic extraction of OpenSpec, Trellis task, and documentation relationships before applying any LLM-inferred enrichment.

#### Scenario: OpenSpec capability is linked deterministically
- **WHEN** deterministic evidence links a Project Map node to an OpenSpec capability
- **THEN** the generated graph records the relationship with deterministic or spec-link source kind
