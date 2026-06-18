# message-row-render-stability Specification

## Purpose
TBD - created by archiving change composer-and-message-row-render-budget. Update Purpose after archive.
## Requirements
### Requirement: Message Rows MUST Use Stable Identity Across Live Updates
Message row rendering MUST keep stable identity for completed history rows while a live assistant row changes. Memoization MUST be based on explicit row-affecting fields rather than incidental object or live-only prop identity.

#### Scenario: completed history rows do not rerender for live text-only updates
- **WHEN** a live assistant row receives a text delta
- **AND** an earlier completed user or assistant message row has unchanged row content, copied state, recovery state, file link handlers, and suppression flags
- **THEN** the completed row MUST keep its memo boundary and avoid rerendering
- **AND** the live assistant row MAY rerender to show the latest text

#### Scenario: live-only props do not invalidate completed rows
- **WHEN** a prop is only consumed by streaming assistant rows, such as visible text reporting or active stream mitigation
- **THEN** changes to that prop MUST NOT invalidate non-streaming completed message rows
- **AND** legitimate completed-row props such as `isCopied`, `retryMessage`, copy handler, file link handlers, runtime reconnect state, and suppression flags MUST still invalidate when their visible behavior changes

#### Scenario: shared file-link handlers remain stable during live updates
- **WHEN** parent settings recreate `openTargets` arrays without changing a completed row's rendered content
- **THEN** `openFileLink` and `showFileLinkMenu` handler identities SHOULD remain stable so completed rows keep their memo boundary
- **AND** invoking those stable handlers MUST use the latest `workspacePath`, selected open target, and workspace-file callback configuration

#### Scenario: hidden runtime reconnect props do not invalidate ordinary completed rows
- **WHEN** runtime reconnect callbacks or retry-message payloads change during a live update
- **AND** a completed message row is not rendering the runtime reconnect card
- **THEN** those hidden reconnect-only props MUST NOT invalidate that row's memo boundary
- **AND** rows with `showRuntimeReconnectCard=true` MUST still compare reconnect callbacks, retry message, and recovery state normally

### Requirement: Message Row Render Budgets MUST Be Reported As Content-Safe Evidence
Renderer diagnostics and runtime evidence gates MUST expose message-row render budget fields without recording conversation content.

#### Scenario: row render counts distinguish live and history rows
- **WHEN** renderer diagnostics emit a message-row budget report during a streaming turn
- **THEN** the report MUST include enough content-safe fields to distinguish live assistant rows from completed history rows
- **AND** it MUST NOT include prompt text, assistant body text, tool output, or file content

