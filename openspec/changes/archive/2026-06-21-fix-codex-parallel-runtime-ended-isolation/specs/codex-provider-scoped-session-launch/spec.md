## ADDED Requirements

### Requirement: Concurrent Codex Conversations MUST Not Collide Through Frontend Fallback

Concurrent Codex conversations, including same-provider conversations that reuse a provider-scoped runtime, MUST keep frontend lifecycle and progress events isolated by thread and turn ownership. Runtime sharing, provider binding, or active UI selection MUST NOT allow one conversation to consume another conversation's lifecycle signal.

#### Scenario: same-provider concurrent events require owner proof
- **WHEN** two Codex conversations using the same provider profile are processing concurrently in the same workspace
- **AND** frontend receives a lifecycle-sensitive event without explicit thread or turn owner
- **THEN** frontend MUST NOT settle, start, revive, or record liveness progress for whichever conversation is currently active or visible
- **AND** neither conversation MUST consume the event solely because it shares the provider runtime

#### Scenario: different-provider concurrent events require owner proof
- **WHEN** two Codex conversations using different provider profiles are processing concurrently in the same workspace
- **AND** frontend receives a lifecycle-sensitive event without explicit thread or turn owner
- **THEN** frontend MUST NOT infer owner from the globally selected provider, the active conversation provider, or the most recently used provider profile
- **AND** the event MUST remain diagnostic-only unless a safe explicit owner or bounded unique fallback exists

#### Scenario: explicit thread owner preserves provider-scoped routing
- **WHEN** frontend receives a Codex event with explicit affected thread context
- **THEN** event handling MUST follow the affected thread identity and its persisted provider binding
- **AND** it MUST NOT infer provider or conversation ownership from global active Codex supplier state

#### Scenario: unique processing conversation may receive bounded fallback
- **WHEN** exactly one Codex conversation in a workspace is processing
- **AND** a lifecycle-sensitive event lacks explicit affected context
- **THEN** frontend MAY route the event to that unique processing conversation as bounded fallback
- **AND** fallback MUST NOT change provider binding or route through another provider profile

### Requirement: Provider-Scoped Codex Parallelism MUST Preserve Session Identity

Provider-scoped Codex runtime reuse MUST preserve per-conversation session identity. A runtime key or provider profile key is not sufficient to identify the lifecycle owner of a frontend event.

#### Scenario: provider runtime key is not an event owner
- **WHEN** multiple Codex threads share the same workspace/provider runtime key
- **THEN** frontend MUST treat the runtime key as insufficient owner context for lifecycle mutation
- **AND** it MUST require thread/turn owner proof or a unique processing fallback

#### Scenario: provider metadata survives event ownership hardening
- **WHEN** a Codex thread has persisted provider metadata
- **AND** the ownership resolver routes an explicit event to that thread
- **THEN** the mutation MUST preserve the thread's provider metadata
- **AND** the event gate MUST NOT rewrite the thread as disk-provider or another managed provider thread

#### Scenario: provider-selected continuation remains thread-bound
- **WHEN** the user continues, resumes, compacts, rewinds, or forks a Codex thread with persisted provider binding
- **THEN** the operation MUST remain routed by that thread binding
- **AND** ownership hardening MUST NOT introduce a global provider fallback that changes the target conversation

### Requirement: Shared-Session Native Rebinding MUST Remain Explicit And Unique

Shared-session native thread rebinding MUST continue to rely on explicit native/shared binding facts. Ownership hardening MUST not replace unique shared-session binding logic with active thread or active provider inference.

#### Scenario: explicit native thread binding routes to shared thread
- **WHEN** a lifecycle event includes a native thread id that is registered for a shared-session thread
- **THEN** frontend MUST route lifecycle mutation to the shared thread id
- **AND** the engine hint from the binding MUST be preserved

#### Scenario: pending native binding must remain unique
- **WHEN** frontend resolves a pending shared-session binding by engine
- **THEN** it MUST only use a unique pending binding
- **AND** multiple pending bindings for the same engine MUST be treated as ambiguous

#### Scenario: shared-session rebinding cannot mask Codex parallel ambiguity
- **WHEN** two Codex shared-session conversations are pending or processing concurrently
- **AND** an event lacks native thread identity and lacks unique pending binding
- **THEN** frontend MUST NOT route the event to the active shared thread
- **AND** the event MUST NOT mutate either shared conversation's lifecycle state by guess
