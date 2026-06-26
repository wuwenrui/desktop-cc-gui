## MODIFIED Requirements

### Requirement: AppShell MUST Compose Shell And Canvas Through Separate Runtime Boundaries
AppShell runtime boundaries SHALL distinguish Shell control node construction from Conversation Canvas content node construction.

#### Scenario: Active canvas state uses selector boundary
- **WHEN** active conversation state changes because of stream item, tool event, thread status, token usage, or rate-limit churn
- **THEN** Conversation Canvas consumers SHALL subscribe to the required active canvas slice through selector-based external-store access
- **AND** Shell control node construction SHALL NOT require full active canvas arrays or maps solely to preserve canvas rendering
- **AND** selector equality SHALL suppress updates when the selected slice is unchanged.

#### Scenario: Composer and StatusPanel live slices use the same selector boundary
- **WHEN** Composer or StatusPanel needs live advisory state from the active conversation
- **THEN** those surfaces SHALL consume `items`, status maps, token usage, rate limits, and active thread facts through selector-derived props
- **AND** AppShell layout composition SHALL keep send-critical Composer state such as draft text, attachments, model selection, and callbacks outside the active canvas store.
