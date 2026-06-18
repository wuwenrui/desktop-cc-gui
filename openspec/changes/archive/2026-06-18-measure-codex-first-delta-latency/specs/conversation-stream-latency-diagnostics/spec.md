## ADDED Requirements

### Requirement: First Delta Diagnostics MUST Preserve Provider Dimensions

Stream latency diagnostics MUST preserve enough bounded dimensions to classify first-delta waiting separately from frontend render, batch, and reducer latency.

#### Scenario: Codex first-delta wait remains upstream pending until delta ingress

- **WHEN** a Codex-compatible turn has started and no assistant delta or snapshot ingress has arrived
- **THEN** diagnostics MUST classify the wait as upstream pending, first-delta latency, first-token delay, or equivalent
- **AND** records MUST include `workspaceId`, `threadId`, `turnId`, `engine`, `providerId/providerName/baseUrl` when available, `model`, and `platform` when available
- **AND** diagnostics MUST NOT classify the wait as client render amplification before assistant delta ingress exists

#### Scenario: first delta arrival closes the first-delta wait window

- **WHEN** the first assistant delta or snapshot ingress arrives for the correlated turn
- **THEN** diagnostics MUST preserve the elapsed first-delta latency window
- **AND** subsequent visible text latency MUST be measured from delta ingress to visible growth rather than from user send
