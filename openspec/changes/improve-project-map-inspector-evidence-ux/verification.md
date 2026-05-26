## Verification Report: improve-project-map-inspector-evidence-ux

### Summary

| Dimension | Status |
|---|---|
| Completeness | 10/10 tasks complete; 4 requirements covered |
| Correctness | 4/4 requirements mapped to implementation and tests |
| Consistency | Design decisions followed |

### Evidence

- OpenSpec strict validation: `openspec validate improve-project-map-inspector-evidence-ux --strict` passed.
- Focused component test: `npm exec vitest -- run src/features/project-map/components/ProjectMapPanel.test.tsx --maxWorkers 1 --minWorkers 1` passed with 16 tests.
- Project Map focused suite: `npm exec vitest -- run src/features/project-map/components/ProjectMapPanel.test.tsx src/features/project-map/hooks/useProjectMapDataset.test.tsx src/features/project-map/services/projectMapGenerationWorker.test.ts src/features/project-map/utils/candidates.test.ts --maxWorkers 1 --minWorkers 1` passed with 51 tests.
- TypeScript: `npm run typecheck` passed.
- Large-file sentry: `npm run check:large-files` passed.
- Lint: `npm run lint` exited 0; existing warning remains in unrelated hook file:
  - `src/features/threads/hooks/useThreadActionsResumeThread.ts`
- Diff whitespace: `git diff --check` passed.

### Requirement Mapping

#### Project Map inspector action hierarchy

- Implementation:
  - `src/features/project-map/components/ProjectMapPanel.tsx` removes the standalone topbar refresh button.
  - `src/features/project-map/components/ProjectMapPanel.tsx` removes the duplicate detail-panel refresh action.
  - Node-level `Complete` and `Calibrate` remain available.
- Test:
  - `ProjectMapPanel.test.tsx` asserts `projectMap.refreshEvidence` is absent from toolbar and detail action row.

#### Project Map candidate review affordance

- Implementation:
  - `handleCandidateReviewClick` selects the first candidate node and expands the inspector.
  - `.project-map-candidate-badge` is now a button rather than a static badge.
  - Candidate nodes render `projectMap.candidateNotice.*` in the inspector.
- Test:
  - `ProjectMapPanel.test.tsx` clicks the candidate badge and verifies candidate notice rendering.

#### Project Map inspector readability

- Implementation:
  - `src/styles/project-map.css` increases `.project-map-detail-panel` width to `min(478px, calc(100% - 36px))`.
  - `.project-map-detail-panel.is-collapsed` keeps the compact collapsed width.
- Validation:
  - Focused component tests cover detail collapse / reopen behavior.
  - `npm run check:large-files` passed after stylesheet changes.

#### Project Map drilldown navigation

- Implementation:
  - `ProjectMapPanel.tsx` keeps local `viewHistory` snapshots of `focusNodeId + selectedNodeId`.
  - Drilling into a node pushes the previous view; Back to previous restores it; Back to overview clears history.
  - Canvas and inspector both expose the previous-view action when history exists.
- Test:
  - `ProjectMapPanel.test.tsx` drills into a node, verifies Back to previous appears, activates it, and confirms the overview context returns.

#### Project Map compact non-overlapping layout

- Implementation:
  - `ProjectMapPanel.tsx` reduces graph gap, fit padding, overview radius, focused radius, and expanded slot offsets.
  - Existing `resolveGraphNodeCollisions()` remains active as the non-overlap guard.
  - `project-map.css` positions the Back to previous control below zoom controls to avoid overlap.
- Test:
  - `ProjectMapPanel.test.tsx` keeps the crowded graph overlap assertion and adds a focused-distance assertion for the lower-level view.

#### Project Map evidence link UX

- Implementation:
  - `TraceChip`, `ArtifactChip`, and `SourceChip` render traceable metadata from existing `path`, `line`, `ref`, `hash`, and `excerpt` fields.
  - Traceable entries render as link-style buttons with accessible names containing the label and trace.
  - Entries without trace metadata render as read-only chips.
- Test:
  - `ProjectMapPanel.test.tsx` covers file/spec path + line rendering, excerpt rendering, and no-trace fallback.

### Archive Decision

Do not archive this change independently yet.

Reason: `project-xray-panel` is still owned by active parent change `add-project-xray-panel`, and no main spec exists at `openspec/specs/project-xray-panel/spec.md` yet. Archiving this narrow UX change first would risk creating a partial main spec that does not include the parent capability's full contract.

Recommended next step: keep this change active and archive it together with, or after, the parent Project Knowledge Map capability has been synced into main specs.

### Open Issues

- No CRITICAL issues.
- No implementation-blocking WARNING issues.
- Follow-up candidate workflow remains intentionally out of scope: candidate apply / reject should be a separate OpenSpec change.
