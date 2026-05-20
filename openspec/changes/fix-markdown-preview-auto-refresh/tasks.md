## 1. Implementation

- [x] 1.1 Add a focused main-file external monitoring enablement helper or equivalent testable boundary.
- [x] 1.2 Gate main-window `externalChangeMonitoringEnabled` behind `liveEditPreviewEnabled` plus existing active workspace/file checks.
- [x] 1.3 Add regression coverage for disabled/enabled live preview gating.
- [x] 1.4 Preserve Mermaid block source/render selection across same-document Markdown preview subtree remounts.
- [x] 1.5 Add regression coverage for Mermaid rendered view stability.

## 2. Validation

- [x] 2.1 Run `openspec validate --all --strict --no-interactive`.
- [x] 2.2 Run focused frontend tests for the touched app-shell/file-view behavior.
- [x] 2.3 Run `npm run typecheck` if TypeScript signatures or exported helpers changed.
