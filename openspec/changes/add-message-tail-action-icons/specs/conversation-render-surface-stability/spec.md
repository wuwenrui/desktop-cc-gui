## ADDED Requirements

### Requirement: Assistant Message Tail Actions MUST Expose Copy And Latest Branch Actions

Completed assistant replies MUST expose compact tail actions that reuse existing message/session behavior without changing conversation content.

#### Scenario: assistant replies show copy actions

- **WHEN** the conversation timeline renders an assistant message
- **THEN** the message tail MUST expose a copy icon action
- **AND** copy MUST copy the rendered assistant text when a rendered value is available

#### Scenario: latest final assistant reply shows fork action

- **WHEN** an assistant message is the latest final assistant reply in the active thread
- **AND** it has a valid previous user-message anchor
- **THEN** the message tail MUST expose a fork icon action
- **AND** fork MUST open a shared confirmation dialog explaining the fork purpose and usage
- **AND** fork MUST route through the existing composer fork flow only after the user confirms

#### Scenario: latest final assistant reply shows rewind action

- **WHEN** an assistant message is the latest final assistant reply in the active thread
- **AND** it has a valid previous user-message anchor
- **THEN** the message tail MUST expose a rewind icon action
- **AND** rewind MUST open the existing rewind confirmation dialog using that previous user-message anchor
- **AND** rewind MUST execute only after the user confirms the dialog

#### Scenario: older assistant replies do not show fork or rewind

- **WHEN** an assistant message is not the latest final assistant reply
- **THEN** the message tail MUST NOT expose the fork icon
- **AND** the message tail MUST NOT expose the rewind icon
- **AND** copy availability MUST remain independent of the latest-final visibility rule

#### Scenario: unsupported action anchors are hidden

- **WHEN** an assistant message cannot be mapped to a previous user-message anchor
- **THEN** fork and rewind actions MUST be hidden for that message
- **AND** the copy action MUST remain available when the message has copyable text
