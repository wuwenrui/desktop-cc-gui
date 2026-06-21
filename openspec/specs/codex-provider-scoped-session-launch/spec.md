# codex-provider-scoped-session-launch Specification

## Purpose
TBD - created by archiving change add-codex-provider-scoped-session-launch. Update Purpose after archive.
## Requirements
### Requirement: Codex Conversation Creation MUST Select A Provider Profile

The system MUST treat Codex provider selection as a new-conversation launch decision rather than a global active provider switch.

#### Scenario: disk configuration is the default provider profile

- **WHEN** the user opens the new Codex conversation creation affordance
- **THEN** the provider selector MUST include a default option representing the current disk `.codex` / `CODEX_HOME` configuration
- **AND** that option MUST preserve the existing Codex launch behavior when selected

#### Scenario: managed providers are available as launch options

- **WHEN** the client has stored Codex managed provider records
- **THEN** the provider selector MUST show those providers as selectable launch options
- **AND** selecting a managed provider MUST apply only to the conversation being created
- **AND** it MUST NOT change a global active Codex provider for existing conversations

#### Scenario: provider selection is persisted with the created conversation

- **WHEN** a Codex conversation is created with a selected provider profile
- **THEN** the created thread metadata MUST record the provider profile id, source, and user-visible name
- **AND** later turns for that thread MUST use the persisted provider binding rather than the current UI selection

### Requirement: Codex Fork MUST Allow Provider Selection Without Mutating Parent Thread

The system MUST model provider switching as creating a forked child conversation with a selected provider, not as hot-swapping the parent conversation provider.

#### Scenario: fork defaults to inheriting parent provider

- **WHEN** the user opens the fork affordance for a Codex thread
- **THEN** the fork provider selector MUST default to the parent thread's provider profile
- **AND** the selector MUST also allow choosing the disk provider profile and available managed provider profiles

#### Scenario: fork child records selected provider

- **WHEN** the user forks a Codex thread and selects a provider profile
- **THEN** the parent thread metadata MUST remain unchanged
- **AND** the parent conversation MUST remain visible under its original thread id
- **AND** the frontend MUST NOT apply a rewind-style `renameThreadId(parent -> child)` or `hideThread(parent)` transition for provider-selected message forks
- **AND** the child thread metadata MUST record the selected provider profile id, source, and user-visible name
- **AND** later turns for the child thread MUST use the child thread's persisted provider binding

#### Scenario: fork to a different provider creates a native child with selected-provider binding

- **WHEN** the user forks a Codex thread and selects a provider profile different from the parent thread provider
- **AND** the parent runtime can fork the parent thread through the requested message anchor
- **THEN** the backend MUST send native `thread/fork` to the parent thread's provider runtime
- **AND** it MUST NOT create a fresh selected-provider thread by sending a transcript seed as a user message
- **AND** if the selected provider uses a different `CODEX_HOME`, it MUST make the native child history visible to that selected provider home before recording the child binding
- **AND** the child metadata MUST record the selected provider binding and a provider-rebind fork marker
- **AND** the parent thread metadata and visibility MUST remain unchanged

#### Scenario: cross-provider native fork fails visibly when child history cannot be rebound

- **WHEN** the user forks a Codex thread to a different provider
- **AND** the backend cannot validate the selected provider, cannot resolve the requested message anchor, cannot native-fork the parent runtime, or cannot make the native child history visible to the selected provider home
- **THEN** the fork MUST fail with a user-visible diagnostic containing workspace id, parent or child thread id when available, selected provider profile id, and the failed action
- **AND** it MUST NOT silently create a disk-provider child
- **AND** it MUST NOT hide or rename the parent thread

#### Scenario: fork to a different provider does not fallback silently

- **WHEN** the user forks a Codex thread to a selected managed provider
- **AND** that selected provider is unavailable or invalid
- **THEN** the fork MUST fail with a provider-unavailable or provider-invalid error
- **AND** it MUST NOT silently create the child thread with the disk provider profile

#### Scenario: unavailable parent provider blocks native fork

- **WHEN** a parent thread is bound to a provider that is no longer available
- **AND** the user attempts to fork the thread
- **THEN** the fork MUST fail with a provider-unavailable diagnostic
- **AND** it MUST NOT synthesize a transcript-seeded replacement conversation
- **AND** the parent thread MUST remain marked with its original unavailable provider binding

### Requirement: Managed Codex Providers MUST Use Provider-Scoped CODEX_HOME

The system MUST materialize managed provider configuration into an app-local provider-scoped Codex home and launch Codex app-server with that home.

#### Scenario: managed provider config is materialized without mutating global config

- **WHEN** a Codex conversation is created with a managed provider
- **THEN** the backend MUST write that provider's `configToml` into a provider-scoped `config.toml`
- **AND** it MUST write `authJson` into the same provider-scoped home when provided
- **AND** it MUST NOT overwrite the user's global `~/.codex/config.toml` or `~/.codex/auth.json`

#### Scenario: project configuration does not silently override selected managed provider

- **WHEN** a workspace has a project-level `.codex/config.toml`
- **AND** the user creates a Codex conversation with a managed provider
- **THEN** the system MUST ensure the selected managed provider's launch-critical provider/model settings are effective through explicit overrides or equivalent effective-config validation
- **AND** if the selected managed provider would be overridden, the system MUST block thread creation with a user-visible conflict error
- **AND** it MUST NOT create a thread that appears bound to the managed provider while Codex actually uses the project configuration

#### Scenario: managed provider runtime receives scoped CODEX_HOME

- **WHEN** the backend starts Codex app-server for a managed provider profile
- **THEN** the child process MUST receive `CODEX_HOME` pointing at that provider-scoped home
- **AND** the runtime MUST NOT read credentials from another managed provider's scoped home

#### Scenario: sensitive provider files are protected

- **WHEN** the backend writes provider-scoped `auth.json`
- **THEN** it MUST avoid logging raw secret values
- **AND** it SHOULD apply owner-only file permissions where the platform supports them

#### Scenario: provider homes persist across app restarts

- **WHEN** a managed provider has been used to create Codex conversations
- **AND** the app restarts
- **THEN** the provider-scoped home MUST remain available as an app-local artifact
- **AND** the backend MUST be able to rediscover provider-bound history from that provider home

### Requirement: Provider-Scoped Codex Runtimes MUST Be Isolated

The system MUST isolate Codex runtime sessions by workspace and provider profile so multiple providers can run concurrently.

#### Scenario: same workspace can run multiple provider runtimes

- **WHEN** the user creates two Codex conversations in the same workspace with two different provider profiles
- **THEN** the backend MUST create or reuse distinct provider-scoped Codex runtimes
- **AND** managed-provider runtime identity MUST include both workspace identity and provider profile identity
- **AND** the disk provider MAY keep the legacy workspace-only runtime key as the compatibility representation of `providerProfileId="__disk__"`

#### Scenario: same workspace can run multiple conversations with the same provider

- **WHEN** the user creates multiple Codex conversations in the same workspace with the same provider profile, including multiple disk-profile conversations
- **THEN** the system MUST allow those conversations to run concurrently
- **AND** each conversation MUST keep its own thread/session identity
- **AND** the implementation MAY reuse one provider-scoped runtime for those conversations when thread routing remains correct

#### Scenario: concurrent provider conversations do not collide

- **WHEN** two Codex conversations using different provider profiles send turns concurrently
- **THEN** each turn MUST be routed to the runtime bound to that thread's provider profile
- **AND** neither turn MUST modify or depend on the other provider's `CODEX_HOME`

#### Scenario: concurrent same-provider conversations do not collide

- **WHEN** two Codex conversations using the same provider profile send turns concurrently
- **THEN** each turn MUST be routed to the correct Codex thread/session
- **AND** neither turn MUST receive events, status, or output belonging to the other thread

#### Scenario: unavailable provider binding does not silently fall back

- **WHEN** a thread is bound to a managed provider that is later deleted or unavailable
- **AND** the user sends another turn to that thread
- **THEN** the system MUST surface a provider-unavailable error
- **AND** it MUST NOT silently route the turn through the disk `.codex` provider profile

#### Scenario: app restart restores provider-bound history

- **WHEN** the app restarts after Codex conversations were created with disk and managed provider profiles
- **THEN** the Codex session catalog MUST aggregate disk-profile history and managed-provider history
- **AND** each restored thread MUST expose its provider profile id, source, name, and availability
- **AND** historical managed-provider threads MUST NOT be rewritten as disk-profile threads

#### Scenario: thread-bound continuation commands use persisted provider binding

- **WHEN** the user performs a thread-bound Codex continuation operation such as turn start, resume, compaction, rewind, or thread status
- **THEN** the backend MUST resolve the target thread's provider binding from metadata
- **AND** it MUST route the operation to the runtime for that workspace and provider profile

#### Scenario: stale app-server thread recovery stays within the bound provider runtime

- **WHEN** a thread-bound `turn/start` is routed to the thread's persisted provider runtime
- **AND** Codex app-server returns a `thread not found` or `thread_not_found` error for that thread id
- **THEN** the backend MAY send `thread/resume` for the same thread id to the same provider runtime and retry `turn/start` once
- **AND** the retry MUST use the original turn payload and the same provider runtime key
- **AND** the retry MUST use bounded request timeouts and clear foreground work if recovery fails
- **AND** it MUST NOT silently route the turn through the disk `.codex` provider profile

#### Scenario: fork is routed as a thread-derived launch

- **WHEN** the user forks a Codex thread
- **THEN** the backend MUST read the parent thread metadata and history
- **AND** it MUST route native child thread creation to the runtime for the parent provider profile
- **AND** if the selected provider profile differs from the parent provider, it MUST rebind the native child to the selected provider only after the child history is visible to the selected provider home
- **AND** it MUST NOT mutate the parent thread provider binding

#### Scenario: provider-selected workspace commands require an explicit provider

- **WHEN** the user invokes a provider-sensitive workspace command such as model list, account read, provider diagnostics, or MCP status
- **THEN** the frontend or backend caller MUST provide an explicit provider profile id
- **AND** the backend MUST NOT infer a managed provider from a global active Codex supplier state

#### Scenario: unclassified Codex commands are blocked from provider-scoped fallback

- **WHEN** a Codex command is not classified as thread-bound, provider-selected, disk-default, or provider-agnostic
- **THEN** the provider-scoped implementation MUST treat the command as unsupported until routing is defined
- **AND** it MUST NOT reuse the old workspace-only runtime lookup by default

#### Scenario: adapters without managed provider runtimes fail visibly

- **WHEN** a remote or daemon adapter receives a Codex creation or fork command with a managed `providerProfileId`
- **AND** that adapter has not implemented provider-scoped Codex runtime launch
- **THEN** the adapter MUST return a user-visible unsupported-provider-runtime error
- **AND** it MUST NOT drop `providerProfileId`
- **AND** it MUST NOT create, fork, or send the command through the disk `.codex` provider profile

### Requirement: Codex Supplier Management MUST Not Expose Misleading Global Enablement

The Codex supplier management tab MUST manage reusable provider profiles and MUST NOT imply that one provider is globally active for all Codex sessions.

#### Scenario: provider cards do not offer global enable

- **WHEN** the user views Codex providers in supplier management
- **THEN** managed provider cards MUST NOT show an action that globally enables that provider for all Codex sessions
- **AND** the UI SHOULD describe providers as available for new conversation creation

#### Scenario: existing management actions remain available

- **WHEN** the user views a managed Codex provider card
- **THEN** edit, delete, and custom model management actions MAY remain available
- **AND** those actions MUST NOT change provider binding for already-created conversations unless a future explicit migration action is introduced

#### Scenario: editing a provider affects future runtimes only

- **WHEN** a managed Codex provider is edited while a runtime using the previous configuration is already running
- **THEN** the running runtime MUST NOT be silently hot-swapped to the edited configuration
- **AND** newly spawned runtimes for that provider MUST use the latest saved provider configuration

### Requirement: Codex Provider Selection MUST Cover All New Conversation Entrypoints

All user-visible and programmatic Codex conversation creation entrypoints MUST either expose provider selection or explicitly use the disk default profile.

#### Scenario: visible creation entrypoints share the same provider selector behavior

- **WHEN** the user creates a new Codex conversation from any visible entrypoint such as sidebar action, empty state action, command action, or keyboard-driven creation
- **THEN** the creation flow MUST use the same provider selection contract
- **AND** the default selection MUST be the disk `.codex` provider profile

#### Scenario: non-interactive creation defaults or passes provider explicitly

- **WHEN** a non-interactive or programmatic path creates a Codex conversation
- **THEN** it MUST either pass an explicit provider profile id
- **OR** it MUST intentionally default to the disk `.codex` provider profile
- **AND** that choice MUST be visible in the created thread metadata

### Requirement: Codex Conversation Surfaces MUST Show Provider Label

The system MUST make the provider binding for each Codex conversation visible enough for users to distinguish sessions while disk and managed-provider conversations run in parallel.

#### Scenario: conversation list shows provider label

- **WHEN** the user views Codex conversations in the sidebar, session list, or equivalent conversation list
- **THEN** each Codex conversation SHOULD show a provider label derived from thread metadata
- **AND** disk, managed, and unavailable providers MUST be distinguishable

#### Scenario: active conversation shows provider label

- **WHEN** the user opens a Codex conversation
- **THEN** the active conversation surface SHOULD show the bound provider label in the header, metadata area, or equivalent prominent location
- **AND** the label MUST NOT be computed from a global active supplier state

#### Scenario: frontend preserves provider metadata across thread updates

- **WHEN** Codex thread metadata enters the frontend through start response, catalog projection, live turn events, sidebar snapshots, or fork response
- **THEN** the frontend MUST preserve `providerProfileId`, `providerProfileSource`, `providerProfileName`, `providerAvailability`, and `sourceLabel` when present
- **AND** later thread update actions that omit provider fields MUST NOT erase existing provider metadata
- **AND** sidebar, pinned list, and composer provider labels MUST derive from thread metadata rather than supplier-management active state

### Requirement: Codex Runtime Isolation Claims MUST Distinguish Provider Scope From Thread Process Scope
Codex runtime isolation claims MUST distinguish provider-scoped process/config isolation from per-thread process isolation.

#### Scenario: provider-scoped isolation is evaluated
- **WHEN** a change claims Codex runtime isolation for managed providers
- **THEN** the claim MUST be evaluated against provider-scoped `CODEX_HOME`, provider runtime key, persisted provider binding, and thread routing correctness
- **AND** it MUST NOT require one app-server process per thread unless a later behavior spec explicitly introduces that requirement

#### Scenario: per-thread process isolation is requested
- **WHEN** a user or artifact asks for per-thread Codex app-server process isolation
- **THEN** the system MUST treat it as a new behavior requirement requiring a separate proposal, design, risks, and validation plan
- **AND** it MUST NOT be retroactively treated as missing work for the existing provider-scoped runtime contract

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
