# Design: Follow-up v0.5.11 — split big remaining work

## 1. Large-file wave3

### Target modules

| File | Target | Extraction |
|---|---|---|
| `src/services/tauri.ts` | facade remains compatibility layer | `tauri/session.ts`, `tauri/permission.ts`, `tauri/appServer.ts` |
| `src/features/files/components/FileTreePanel.tsx` | component owns rendering orchestration only | `useFileTreeViewState.ts`, `FileTreeRefreshControls.tsx` |

### Constraints

- Keep existing public imports from `src/services/tauri.ts` working.
- Keep Tauri command names and payload field names unchanged.
- Do not change backend command behavior while splitting frontend wrapper modules.
- Run `npm run check:large-files` after the split.

## 2. Recovery cookbook

Document these fields in `.trellis/spec/backend/codex-provider-scoped-runtime.md`:

```yaml
staleRecoveryClassification:
  reasonCode:
    - "malformed-thread-id"
    - "missing-thread-binding"
    - "stale-thread-binding"
  staleReason:
    - "user-edited-prompt-after-send"
    - "concurrent-thread-recreated"
    - "app-server-restart"
  userAction:
    - "fresh-continuation"
    - "fork-and-retry"
    - "rebind-and-retry"
```

Add a provider-template section for future GEMINI / CLAUDE recovery hooks. The template should reuse the attempt-oriented shape from `useCodexMessageRecovery` while swapping provider-specific error classifiers and thread/session start APIs.

## 3. Measured evidence producers

Remaining proxy rows must only become `measured` when all of these are true:

- The source artifact is produced by real dev or CI runtime execution.
- The metric row records `sampleCount` and `sourceArtifact`.
- The producer has focused tests that reject malformed or stale diagnostics.

Do not use synthetic fixture output to satisfy measured evidence targets.
