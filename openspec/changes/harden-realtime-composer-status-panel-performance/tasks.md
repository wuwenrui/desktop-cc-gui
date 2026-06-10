# Tasks

## Implementation

- [x] Route bottom status-panel summary items through a deferred realtime source while processing.
- [x] Use the deferred status-panel item source for the dock `StatusPanel` payload.
- [x] Narrow `useStatusPanelData` memo dependencies so wrapper object identity does not trigger avoidable full recomputation.

## Validation

- [ ] Run focused status-panel tests.
- [ ] Run focused composer tests.
- [ ] Manually verify Composer typing during multiple parallel realtime Codex sessions.

## Follow-up

- [ ] If "completed then loading again" still reproduces, create a separate scope-hardening change for realtime lifecycle keys using `workspaceId + engine + threadId + turnId/runtimeLeaseId`.

