## MODIFIED Requirements

### Requirement: Conversation-derived project knowledge candidates

The system SHALL support adding verifiable project knowledge from project Q&A into the map through AI-generated candidates.

#### Scenario: Pending candidate can be confirmed from node inspector

- **WHEN** the selected Project Map node has a pending candidate record targeting that node
- **THEN** the inspector SHALL show a confirm candidate action
- **AND** activating confirm SHALL validate the candidate patch through the evidence gate before mutating the active node
- **AND** on success the candidate status SHALL become `confirmed`
- **AND** the candidate evidence SHALL be appended to project map evidence records

#### Scenario: Pending candidate can be rejected from node inspector

- **WHEN** the selected Project Map node has a pending candidate record targeting that node
- **THEN** the inspector SHALL show a reject candidate action
- **AND** activating reject SHALL mark the candidate `rejected`
- **AND** the active node SHALL remain unchanged

#### Scenario: Invalid candidate confirmation is blocked

- **WHEN** a pending candidate patch fails the evidence gate
- **THEN** the inspector confirm action SHALL NOT mutate the active node
- **AND** the UI SHALL expose a readable error message
