## ADDED Requirements

### Requirement: Message Image Resources SHALL Have Bounded Renderer Lifetime

Conversation image rendering SHALL avoid retaining full image data URLs in React state or DOM longer than required for the current user-visible operation.

#### Scenario: deferred history image releases full resource after preview closes
- **WHEN** a user hydrates a deferred history image and opens it for preview
- **THEN** the full image resource MUST be available while the preview is visible
- **AND** closing the preview or unmounting the row MUST release transient full-resource state without removing the canonical deferred image locator

#### Scenario: inline image preview preserves original image access
- **WHEN** a message contains an inline data URL or local image path
- **THEN** the timeline MAY render a lightweight preview surface
- **AND** opening the image MUST still provide access to the original full image without compressing, cropping, or mutating the canonical message item

#### Scenario: image memory protection does not degrade send semantics
- **WHEN** a user sends, queues, forks, rewinds, or recovers a message with images
- **THEN** the original image list used by the send/retry/recovery payload MUST remain unchanged
- **AND** render-layer resource cleanup MUST NOT delete or rewrite canonical conversation image data
