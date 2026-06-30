## MODIFIED Requirements

### Requirement: Provider-Scoped Codex Runtimes MUST Be Isolated

The system MUST isolate Codex runtime sessions by workspace and provider profile so multiple providers can run concurrently.

#### Scenario: thread-bound provider binding lookup prefers canonical catalog metadata

- **WHEN** a thread-bound Codex operation resolves provider metadata for `workspaceId` and `threadId`
- **THEN** the backend MUST first look up the canonical catalog key `codex:<workspaceId>:<threadId>`
- **AND** it MAY fall back to legacy keys such as `codex::<workspaceId>::<threadId>`, `<threadId>`, and `codex:<threadId>`
- **AND** blank `threadId` MUST NOT produce a metadata lookup key
- **AND** missing metadata MAY default to the disk provider only for legacy compatibility
- **AND** an existing non-disk canonical binding MUST NOT be bypassed by a legacy disk binding.
