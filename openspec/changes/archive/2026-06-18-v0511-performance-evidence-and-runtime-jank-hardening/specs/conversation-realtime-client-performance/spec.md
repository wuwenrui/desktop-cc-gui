## ADDED Requirements

### Requirement: V0511 Realtime Input Render Budget MUST Be Producer Backed

Realtime input render budget evidence MUST be generated from reducer/profile fixtures rather than handwritten report rows.

#### Scenario: reducer burst fixture records fast path evidence

- **WHEN** a 1000-delta streaming burst fixture runs through the thread reducer
- **THEN** the producer MUST emit `S-IO-RR/prepareThreadItems_calls_per_1000_delta`
- **AND** the value MUST reflect the reducer profile counter rather than an assumed constant

#### Scenario: realtime route timing remains bounded or unsupported

- **WHEN** reducer flush or realtime route timing cannot be measured by the fixture
- **THEN** the producer MUST emit an explicit unsupported row
- **AND** the row MUST include the missing timing source as its reason
