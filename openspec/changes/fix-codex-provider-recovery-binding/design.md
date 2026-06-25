## Overview

The fix keeps session identity anchored to persisted thread metadata. Backend routing resolves the provider binding from canonical catalog metadata before compatibility keys; frontend recovery reads the active thread's provider binding and carries it through fresh or fork continuation.

## Design Details

### Backend provider binding lookup

`resolve_thread_provider_profile_id(state, workspaceId, threadId)` now delegates key generation to `codex_provider_binding_lookup_keys(workspaceId, threadId)`.

Lookup priority:

1. `codex:<workspaceId>:<threadId>`: catalog canonical metadata key.
2. `codex::<workspaceId>::<threadId>`: legacy/draft double-colon key.
3. `<threadId>`: legacy bare id.
4. `codex:<threadId>` or stripped raw id for prefixed ids: legacy Codex compatibility.

The helper trims workspace/thread input and returns an empty key list for blank thread id. This prevents malformed input from producing accidental metadata hits.

### Frontend recovery provider inheritance

`useThreads` exposes `getThreadProviderProfileId(workspaceId, threadId)` from existing `ThreadSummary.providerProfileId`. The resolver is identity-stable and reads from `threadsByWorkspaceRef.current`, so AppShell/domain-context consumers do not receive a new send/recovery callback every time thread metadata changes. `useThreadMessaging` passes that value into `useCodexMessageRecovery`.

`useCodexMessageRecovery` normalizes the optional provider id:

- non-empty string -> `{ providerProfileId }`
- blank/null/undefined -> omit field, preserving disk default behavior

Fresh continuation calls `startThreadForMessageSend(workspace, "codex", { providerProfileId })` only when a non-empty binding exists. Fork continuation calls `forkThreadForWorkspace(workspace.id, threadId, { activate: true, providerProfileId })` under the same condition.

### Boundary handling

- Blank provider profile id is never forwarded.
- Missing provider metadata keeps existing disk/default fallback.
- Provider metadata lookup reads latest thread metadata without destabilizing AppShell context callback identities.
- Durable rebind path remains in `useThreadMessaging`; recovery hook does not hijack verified rebind.
- No host filesystem paths are introduced, so Windows/macOS path separator behavior is unchanged.

### Heavy test noise cleanup

`FileMarkdownPreviewFast.test.tsx` waits for the rich outline async compile state before the default-rich-preview test exits. This removes the repo-owned `act(...)` warning without muting `console.error`.

## Alternatives Considered

1. Retry more aggressively after `thread not found`.
   - Rejected: does not fix provider identity mismatch and risks retry storms.
2. Add canonical lookup plus frontend provider inheritance.
   - Chosen: smallest contract-level fix, compatible with existing metadata.
3. Redesign session alias/catalog ownership.
   - Rejected for this change: too broad and not required for the observed bug.

## Risk & Rollback

- Risk: legacy key order could change behavior for corrupted metadata containing conflicting bindings. Mitigation: canonical workspace key wins; legacy keys remain only as fallback.
- Risk: provider-bound recovery could expose unavailable provider errors instead of silently continuing on disk. This is desired by the provider-scoped runtime contract.
- Rollback: revert frontend provider inheritance and backend lookup helper changes; disk/default fallback behavior returns to previous state.
