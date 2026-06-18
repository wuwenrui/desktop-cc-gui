# codex-stale-thread-binding-recovery Specification

## Purpose

Defines the codex-stale-thread-binding-recovery behavior contract, covering Verified Codex Thread Replacement MUST Survive Restart.
## Requirements
### Requirement: Verified Codex Thread Replacement MUST Survive Restart

When a `Codex` stale thread has been recovered to a new canonical `threadId`, the system MUST persist the replacement only after the replacement has been verified as a high-confidence durable rebind.

#### Scenario: persisted alias remaps stale thread after restart

- **WHEN** a `Codex` thread replacement has been verified as `oldThreadId -> canonicalThreadId`
- **AND** the recovery decision is high confidence and non-ambiguous
- **AND** the user restarts the application and opens the same workspace or historical session
- **THEN** the lifecycle entrypoint MUST canonicalize the old `threadId` to the persisted `canonicalThreadId`
- **AND** the system MUST NOT call the known invalid old `threadId` before trying the canonical target

#### Scenario: alias chain resolves to latest canonical target

- **WHEN** a stale `threadId` forms a chain of verified replacements
- **THEN** the persisted alias read result MUST converge to the latest canonical `threadId`
- **AND** reopen and restore paths MUST NOT pass through stale intermediate thread ids

#### Scenario: low-confidence replacement does not persist durable alias

- **WHEN** stale-thread recovery finds a replacement candidate
- **AND** the candidate is based only on weak evidence such as a single newly discovered row, title similarity, or provider/source similarity without enough score gap or history evidence
- **THEN** the system MAY surface the candidate as degraded or user-confirmable recovery
- **BUT** it MUST NOT persist `oldThreadId -> candidateThreadId` as a durable alias

#### Scenario: ambiguous replacement keeps source session explainable

- **WHEN** two or more replacement candidates have equivalent or insufficiently separated recovery scores
- **THEN** automatic durable alias persistence MUST be rejected with an explicit ambiguous reason
- **AND** the source session surface MUST remain explainable as stale, degraded, or needing explicit recovery

### Requirement: Recover-Only Rebind MUST Be Available Without Forced Resend

当 `thread not found` 属于 stale binding 问题且系统已经具备安全 rebind 能力时，用户 MUST 可以只恢复当前会话绑定，而不是被迫 resend 上一条 prompt。

#### Scenario: stale thread recovery card offers recover-only action
- **WHEN** reconnect surface 识别到当前失败属于 `thread not found`
- **AND** 系统提供了安全的 thread rebind callback
- **THEN** UI MUST 展示 recover-only 动作
- **AND** 用户 MUST 能在不 resend 上一条 prompt 的情况下先恢复当前会话绑定

#### Scenario: no verified replacement keeps conservative failure semantics
- **WHEN** 系统无法确认安全 replacement thread
- **THEN** reconnect surface MUST 保持保守失败语义
- **AND** 系统 MUST NOT 通过启发式猜测把当前会话误绑到其他线程

### Requirement: Manual Runtime Recovery MUST Start A Fresh Recovery Cycle

当 `Codex` runtime 已因为 repeated stale health probe 进入 automatic recovery quarantine 时，用户手动触发的恢复动作 MUST 开启一轮 fresh explicit recovery cycle，而不是继续被上一轮 automatic backoff 继承阻塞。

#### Scenario: explicit recovery records lifecycle source

- **WHEN** 用户显式点击 `重新连接 runtime`、recover-only 或 recover-and-resend
- **THEN** recovery cycle MUST 标记 `recoverySource=manual-reconnect`、`manual-recover-only` 或 `manual-recover-and-resend`
- **AND** 该 source MUST 出现在 runtime/thread diagnostics 中，便于区分 automatic recovery 与用户主动恢复

### Requirement: First-Turn Stale Codex Drafts MUST Use Fresh Continuation Semantics

Codex stale-thread recovery MUST distinguish durable stale conversation identities from first-turn drafts that never accepted user work.

#### Scenario: empty stale draft can be replaced without manual recovery card
- **WHEN** a Codex thread identity fails with `thread not found`
- **AND** canonical accepted-turn / durable-activity facts prove the identity has no accepted user turn, no completed assistant response, and no persisted durable activity
- **THEN** the system MAY replace the stale draft with a fresh Codex thread for the current first prompt
- **AND** the primary user path MUST continue the prompt in the fresh thread rather than asking the user to recover the old empty identity
- **AND** this fresh replacement MUST be attempted before stale fork fallback for the same failed empty draft

#### Scenario: same-id refresh does not verify a missing first-turn draft
- **WHEN** a newly started Codex empty draft fails the first prompt with `thread not found`
- **AND** refresh/rebind returns the same `threadId` that just failed
- **THEN** the system MUST NOT treat that same id as a verified rebind
- **AND** the system MUST continue through first-turn fresh replacement or visible failure semantics rather than retrying the same missing id as recovered

#### Scenario: cold-start missing thread gets bounded readiness retry
- **WHEN** the first `turn/start` after Codex runtime cold start reports `thread not found`
- **THEN** the backend SHOULD perform same-runtime `thread/resume` plus short bounded readiness retry before surfacing the failure
- **AND** the retry MUST remain bounded and MUST NOT route the request to another provider/runtime

#### Scenario: durable stale thread still requires verified rebind or explicit fresh continuation
- **WHEN** a Codex thread identity fails after one or more accepted user turns or durable activity facts exist
- **THEN** the system MUST first attempt verified rebind through the existing stale-thread recovery contract
- **AND** fresh continuation MUST be explicit and user-visible rather than silently replacing the old thread

### Requirement: Fresh Continuation MUST Preserve User Intent Visibility

When stale Codex recovery falls back to a fresh thread, the user's immediate intent MUST remain visible and target the new active identity.

#### Scenario: fresh continuation renders the replayed prompt

- **WHEN** a recover-and-resend or first-turn fallback sends a prompt to a fresh Codex thread
- **THEN** the user prompt MUST be rendered or otherwise visibly represented in the fresh thread
- **AND** duplicate suppression MUST NOT hide the prompt merely because the action originated from a stale source thread

#### Scenario: fresh continuation keeps old thread explainable

- **WHEN** a fresh continuation replaces or supersedes a stale Codex source identity
- **THEN** the old thread surface MUST remain explainable as stale, abandoned, replaced, or degraded-readable when visible
- **AND** the UI MUST NOT imply that old context was fully preserved unless verified rebind occurred

#### Scenario: automatic agent session creation is reason-coded

- **WHEN** the app creates a fresh `agentN` style session after stale reopen or large-context recovery failure
- **THEN** the new session MUST carry a user-visible or diagnostic reason code for fresh continuation
- **AND** the UI MUST NOT present the fresh session as the original session unless a verified durable rebind exists

### Requirement: Manual Stale Thread Recovery MUST Return A Classified Outcome

Codex stale thread manual recovery MUST distinguish verified thread rebind from fresh-thread fallback and unrecoverable failure.

#### Scenario: classified outcome includes retryability and user action

- **WHEN** manual stale thread recovery 返回 `rebound`、`fresh` 或 `failed`
- **THEN** result MUST include retryability and a recommended user action when available
- **AND** frontend MUST NOT infer these semantics only from raw error text

### Requirement: Recover And Resend MUST Make Fresh Fallback Visible

When a user explicitly chooses a stale Codex thread recovery card continuation action, the system MUST make the continuation target clear and MUST not require the user to discover a separate Fork entry point manually.

#### Scenario: recovery card offers fork shortcut

- **WHEN** the message canvas detects a Codex stale thread recovery error
- **THEN** the recovery card MUST expose a direct Fork action in the canvas
- **AND** the user MUST NOT need to discover a separate bottom toolbar Fork menu to create a usable forked conversation

#### Scenario: recovery card explains stale thread meaning and next step

- **WHEN** the message canvas renders a Codex stale thread recovery card
- **THEN** the card MUST explain that the current Codex thread binding is no longer safe to continue
- **AND** it MUST state that the existing canvas content remains visible while the failed request needs a usable continuation thread
- **AND** it MUST present a recommended next step that tells the user to Fork the current conversation
- **AND** raw provider/runtime details such as `thread not found` MUST be visually secondary to the user-facing explanation

#### Scenario: fork shortcut is a clear primary action

- **WHEN** the stale thread recovery card can offer a continuation action
- **THEN** the primary action MUST combine a Fork-oriented icon with concise text such as `Fork`
- **AND** the action label MUST NOT promise automatic resend semantics
- **AND** the action MUST call the existing shared Fork capability rather than introducing a parallel fork implementation
- **AND** the action MUST NOT call the recover-and-resend path

#### Scenario: fork shortcut does not require runtime reacquire

- **WHEN** the user clicks the stale thread recovery card Fork action
- **THEN** the UI MUST invoke the shared Fork callback without first requiring runtime reacquire for the stale thread
- **AND** runtime reacquire MUST remain scoped to recover-only or non-stale reconnect/resend actions

### Requirement: Recover Only MUST Preserve Conservative Rebind Semantics

Recover-only stale thread actions MUST only report success for actual rebind outcomes.

#### Scenario: recover-only succeeds for rebound
- **WHEN** recover-only receives a `rebound` result
- **THEN** the UI MUST switch or remain on the canonical recovered thread
- **AND** the action MAY clear the failed recovery state

#### Scenario: recover-only does not present fresh fallback as recovered session
- **WHEN** recover-only receives a `fresh` result
- **THEN** the UI MUST NOT present the original stale thread as recovered
- **AND** the user MUST receive an explicit indication that continuing requires the fresh conversation path

### Requirement: Codex Create Session MUST Survive Stopping Runtime Races

Codex create-session 路径 MUST 正确处理 create 期间 runtime 已进入 stopping、manual shutdown、runtime ended 或 stale reuse cleanup 的竞态。

#### Scenario: create session rejects stopping runtime reuse

- **WHEN** 用户创建 Codex session
- **AND** 当前 registered runtime 已标记为 `manual shutdown`、`runtime ended`、`stopping` 或等价状态
- **THEN** create-session MUST NOT 复用该 runtime 作为 foreground target
- **AND** MUST start or await a fresh guarded runtime acquisition

#### Scenario: create session gets one bounded retry after stopping race

- **WHEN** create-session 已进入 `thread/start`
- **AND** bound runtime 因同一 stopping/manual-shutdown race 在 turn 创建前结束
- **THEN** 系统 MUST perform one bounded fresh reacquire or equivalent guarded retry
- **AND** flow MUST settle as either successful new session or recoverable failure without unbounded reconnect loop

#### Scenario: create shutdown race emits recoverable diagnostic

- **WHEN** create-session 因 stopping runtime race 失败
- **THEN** 系统 MUST classify the failure as `stopping-runtime-race` or equivalent reasonCode
- **AND** frontend MUST be able to show reconnect-and-retry rather than only a raw error toast

### Requirement: Codex Stale Binding Recovery MUST Be Durable-Safe

Codex stale thread binding recovery MUST preserve durable local activity and MUST NOT silently replace durable conversations with fresh threads or unverified aliases.

#### Scenario: durable stale thread requires verified rebind or explicit fresh continuation

- **WHEN** a stale Codex thread has accepted user turn, assistant response, tool activity, approval, generated image, or other durable local activity
- **THEN** the system MUST first attempt verified rebind through the stale-thread recovery contract
- **AND** fresh continuation MUST be explicit and user-visible rather than silently replacing the old thread

#### Scenario: recoverable stale send retries at most once

- **WHEN** send or resume fails with recoverable stale binding signal such as `thread-not-found`, `session-not-found`, `broken-pipe`, or `runtime-ended`
- **THEN** the system MAY attempt automatic recovery and retry the user action at most once
- **AND** repeated failure MUST settle to visible recovery state rather than entering retry storm

#### Scenario: recovery failure preserves old thread visibility

- **WHEN** stale binding recovery fails
- **THEN** UI MUST keep the source thread explainable as stale, abandoned, unrecovered, degraded-readable, or requiring fresh continuation
- **AND** the system MUST NOT silently clear local history or bind it to an unrelated thread

#### Scenario: alias rollback does not delete thread content

- **WHEN** a persisted stale-thread alias later fails to load or fails a consistency check
- **THEN** the system MAY remove the alias mapping for the stale source id
- **AND** alias rollback MUST NOT delete the source thread history or the candidate replacement thread

### Requirement: Codex Stale Binding Diagnostics MUST Use Stable Reason Codes

Codex stale binding 和 runtime shutdown 相关错误 MUST 被分类为稳定 reasonCode，供 frontend 和 diagnostics surface 消费。

#### Scenario: stale thread not found is classified

- **WHEN** Codex provider returns `thread not found`、`session not found` or equivalent stale identity error
- **THEN** 系统 MUST classify it as `stale-thread-binding` with staleReason such as `thread-not-found` or `session-not-found`
- **AND** frontend recovery logic MUST use this classification rather than substring matching alone when available

#### Scenario: probe failure differs from already stopping

- **WHEN** stale health probe fails
- **THEN** diagnostics MUST distinguish `probe-failed` from `already-stopping`、`manual-shutdown` and `runtime-ended`
- **AND** retryability MUST reflect the classified lifecycle state

#### Scenario: internal cleanup differs from foreground turn loss

- **WHEN** Codex runtime stops because of stale-session cleanup、replacement、idle eviction、settings restart or app shutdown cleanup
- **AND** no active foreground work is attached to that runtime
- **THEN** backend MUST record lifecycle evidence without emitting misleading foreground `runtime-ended` conversation diagnostics
- **AND** active foreground work MUST still receive structured recoverable diagnostics when affected

### Requirement: Empty Draft Fresh Replay MUST Be Single-Shot And Non-Alias-Rebinding

When Codex stale binding recovery replaces an empty first-turn draft with a fresh thread, the replacement MUST behave as a single-shot prompt continuation rather than a verified stale-thread rebind.

#### Scenario: empty draft replay happens at most once
- **WHEN** a first-turn empty Codex draft hits a recoverable missing-thread error
- **THEN** the system MAY create a fresh Codex thread and replay the current prompt once
- **AND** repeated missing-thread failure MUST settle to visible recovery or error state rather than looping through fresh replacements

#### Scenario: empty draft replacement does not persist durable alias
- **WHEN** a first-turn empty Codex draft is replaced by a fresh thread
- **THEN** the system MUST NOT persist an alias that claims the old thread identity was verified as recovered
- **AND** diagnostics MUST distinguish the result from durable stale-thread rebind

### Requirement: Sidebar Catalog Hydration MUST Use Full Catalog As Fact Source

The active workspace sidebar MUST use full active project catalog hydration as its fact source and MUST NOT write a startup first-page subset into the main project session list.

#### Scenario: active startup uses full catalog

- **WHEN** active workspace startup hydrates the sidebar project session list
- **THEN** the hydration task MUST request `full-catalog`
- **AND** it MUST NOT request or apply a `first-page` subset

#### Scenario: full catalog consumes backend catalog cursors internally

- **WHEN** the backend catalog returns a page with `nextCursor`
- **THEN** sidebar full-catalog hydration MUST continue fetching catalog pages internally
- **AND** the applied main list MUST include all fetched active catalog sessions until `nextCursor=null` or a bounded degraded stop condition occurs
- **AND** the remaining catalog cursor MUST NOT be exposed as a normal sidebar load-older cursor

#### Scenario: stale full catalog hydration remains retryable

- **WHEN** a `full-catalog` hydration result is discarded because a newer workspace thread-list request superseded it
- **THEN** the workspace MUST NOT be marked as fully catalog-hydrated
- **AND** a later background hydration pass MUST be allowed to retry `full-catalog`

#### Scenario: active workspace full catalog has priority

- **WHEN** the active workspace still needs full-catalog hydration
- **AND** other unrelated workspaces also need idle background hydration
- **THEN** the active workspace full-catalog hydration MUST run before unrelated idle workspace prewarm
- **AND** the sidebar SHOULD align with strict project session list count/order after that full-catalog pass applies

#### Scenario: direct tracked refresh does not downgrade active workspace to a subset

- **WHEN** the active workspace sidebar has already converged to `full-catalog`
- **AND** a manual, reload, rename, or other direct `listThreadsForWorkspaceTracked(workspace)` refresh runs without an explicit startup hydration kind
- **THEN** the refresh MUST use `full-catalog`
- **AND** it MUST NOT overwrite the active sidebar with startup `first-page` rows or any other subset projection

### Requirement: Active Thread Map MUST Canonicalize Verified Stale Bindings Before Lifecycle Use

When a persisted active workspace thread id has a verified stale-thread alias, frontend lifecycle state MUST converge that active id to the canonical target before send, resume, refresh, or restore consumers can keep using the stale id.

#### Scenario: active workspace map repairs a stale Codex thread alias

- **GIVEN** `activeThreadIdByWorkspace` contains a Codex `threadId` with a verified persisted alias
- **AND** the alias chain resolves to a latest canonical `threadId`
- **WHEN** the thread lifecycle state observes the active workspace map
- **THEN** the active workspace entry MUST be rebound to the latest canonical `threadId`
- **AND** lifecycle consumers MUST NOT continue to treat the stale source `threadId` as the current active conversation

#### Scenario: active workspace map ignores empty or already canonical bindings

- **GIVEN** an active workspace entry has an empty, missing, or already canonical `threadId`
- **WHEN** active-thread canonicalization runs
- **THEN** the system MUST NOT dispatch a redundant active-thread mutation
- **AND** existing loaded thread content MUST remain untouched

### Requirement: Codex Create Session Shutdown Race Retry MUST Stay Bounded Across Entrypoints

Codex create-session entrypoints MUST share the same stopping-runtime race semantics: reject a runtime that is already ending, perform at most one fresh reacquire/retry for the create request, and settle persistent races as a recoverable create-session error.

#### Scenario: app create-session retries once after stopping runtime race

- **WHEN** the Tauri Codex `start_thread` command starts a session
- **AND** the first `thread/start` attempt fails because the bound runtime ended during manual shutdown or equivalent stopping lifecycle
- **THEN** the app path MUST perform one fresh runtime acquire before retrying `thread/start`
- **AND** it MUST NOT retry non-runtime errors such as workspace connectivity failures

#### Scenario: persistent app race returns stable recoverable error

- **WHEN** the app create-session retry also fails with a stopping-runtime race
- **THEN** the app path MUST return a stable recoverable create-session error such as `[SESSION_CREATE_RUNTIME_RECOVERING]`
- **AND** it MUST NOT enter an unbounded retry loop

#### Scenario: daemon create-session keeps parity with app path

- **WHEN** the daemon `start_thread` path observes the same stopping-runtime race
- **THEN** it MUST use the same bounded retry and recoverable-error semantics as the app path
- **AND** daemon parity MUST NOT create a second retry strategy that diverges from the app command path

