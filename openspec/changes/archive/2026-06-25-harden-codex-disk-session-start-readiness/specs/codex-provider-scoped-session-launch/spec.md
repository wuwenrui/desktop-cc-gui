## MODIFIED Requirements

### Requirement: Codex Conversation Creation MUST Select A Provider Profile

The system MUST treat Codex provider selection as a new-conversation launch decision rather than a global active provider switch.

#### Scenario: disk configuration is the default provider profile

- **WHEN** the user opens the new Codex conversation creation affordance
- **THEN** the provider selector MUST include a default option representing the current disk `.codex` / `CODEX_HOME` configuration
- **AND** that option MUST preserve the existing Codex launch behavior when selected

#### Scenario: disk create-session auto-recovers before surfacing manual reconnect

- **WHEN** a new Codex conversation is created with no provider profile id or with `__disk__`
- **AND** the first create-session attempt fails because the managed runtime is recovering or because the just-started thread fails readiness confirmation
- **THEN** the client MUST automatically ensure the disk Codex runtime is ready and retry creation once
- **AND** it MUST only show the manual reconnect/retry notice if the retry still fails

#### Scenario: managed provider create-session does not use disk auto-recovery

- **WHEN** a new Codex conversation is created with a managed provider profile id
- **AND** the first create-session attempt fails
- **THEN** the client MUST NOT run default disk `ensureRuntimeReady` as a recovery shortcut for that managed provider
- **AND** it MUST preserve the existing provider-scoped creation error behavior

#### Scenario: provider selection is persisted with the created conversation

- **WHEN** a Codex conversation is created with a selected provider profile
- **THEN** the created thread metadata MUST record the provider profile id, source, and user-visible name
- **AND** later turns for that thread MUST use the persisted provider binding rather than the current UI selection

### Requirement: Provider-Scoped Codex Runtimes MUST Be Isolated

The system MUST isolate Codex runtime sessions by workspace and provider profile so multiple providers can run concurrently.

#### Scenario: thread-bound provider binding lookup prefers canonical catalog metadata

- **WHEN** a thread-bound Codex operation resolves provider metadata for `workspaceId` and `threadId`
- **THEN** the backend MUST first look up the canonical catalog key `codex:<workspaceId>:<threadId>`
- **AND** it MAY fall back to legacy keys such as `codex::<workspaceId>::<threadId>`, `<threadId>`, and `codex:<threadId>`
- **AND** blank `threadId` MUST NOT produce a metadata lookup key
- **AND** missing metadata MAY default to the disk provider only for legacy compatibility
- **AND** an existing non-disk canonical binding MUST NOT be bypassed by a legacy disk binding.

#### Scenario: disk thread start confirms readiness without changing managed providers

- **WHEN** backend `thread/start` returns a thread id for the disk provider profile
- **THEN** the backend MUST perform a bounded readiness confirmation against the same disk runtime before returning success to the caller
- **AND** readiness confirmation failure MUST be surfaced as a create-session failure rather than marking the UI thread as loaded
- **AND** the same confirmation MUST NOT be applied to managed provider `thread/start` calls unless a future spec explicitly enables it

#### Scenario: app-server capability probe reuses successful evidence safely

- **WHEN** Codex app-server capability has recently been successfully probed for the same resolved binary, PATH environment, codex args, and launch options
- **THEN** subsequent runtime starts MAY reuse that successful probe evidence within a bounded TTL
- **AND** failed probes MUST NOT be cached as blocking evidence
- **AND** probe reuse MUST NOT collapse distinct managed provider launch args or wrapper launch modes
