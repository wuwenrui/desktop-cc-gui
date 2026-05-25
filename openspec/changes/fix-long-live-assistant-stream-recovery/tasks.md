## 1. Reproduction And Failing Tests

- [x] 1.1 [P0] Add reducer fixtures for a Claude active assistant message growing beyond 20000 JS chars through both fast path and fallback append paths; input: synthetic deltas; output: failing tests proving canonical text is currently truncated; verify with focused Vitest.
- [x] 1.2 [P0] Add a Claude history restore fixture matching the observed interrupted `aaa` shape; input: provider JSONL with user/thinking but no assistant final body plus shadow transcript; output: failing recovery test; verify with focused Vitest.
- [x] 1.3 [P0] Add live rendering tests for long CJK text with paragraph breaks; input: streaming text chunks; output: failing assertion that paragraph separation remains visible; verify with focused component/unit test.
- [x] 1.4 [P1] Add diagnostics test coverage for long live row evidence fields; input: synthetic long-output stream; output: evidence contains ingress, reducer, render, visible growth, and recovery source dimensions.

## 2. Canonical Text And Reducer Safety

- [x] 2.1 [P0] Split active assistant canonical normalization from display/preview truncation on both fast path and `prepareThreadItems` fallback; depends on 1.1; output: active streaming text bypasses `MAX_ITEM_TEXT` while structural normalization remains intact; verify reducer fixtures pass.
- [x] 2.2 [P0] Ensure subsequent deltas merge onto the untruncated canonical body; depends on 2.1; output: no ellipsis-contaminated merge base; verify with >20k continuation fixture.
- [x] 2.3 [P1] Audit all callers of `normalizeItem` / `truncateText` touched by live assistant paths; output: display-only truncation stays explicit and no ordinary list preview regresses; verify existing thread item tests.

## 3. Shadow Transcript Storage

- [x] 3.1 [P0] Implement bounded Claude Code live assistant shadow transcript storage in app data; input: engine/workspace/session/thread/turn/item identity plus delta text; output: append or batched write API with engine-neutral boundary; verify storage unit tests.
- [x] 3.2 [P0] Wire Claude Code live assistant delta handling to shadow writes without blocking visible reducer updates; depends on 3.1; output: text deltas persist during streaming; verify mocked write scheduler test.
- [x] 3.3 [P1] Implement settled cleanup and retention pruning; depends on 3.1; output: settled, old, oversized, and corrupt shadows are safely pruned or skipped; verify storage boundary tests.
- [x] 3.4 [P1] Add rollback/feature flag boundary for shadow recovery while keeping canonical truncation fix active; output: recovery can be disabled for emergency diagnosis without reintroducing text corruption.

## 4. Claude History Recovery

- [x] 4.1 [P0] Add Claude restore shadow lookup after provider transcript parsing; depends on 3.1; output: recovery only runs when provider final assistant body is absent; verify `aaa`-shape recovery test.
- [x] 4.2 [P0] Mark recovered assistant items with local recovery metadata; depends on 4.1; output: restored row includes `recoveredFromLiveShadow` or equivalent metadata; verify snapshot/unit assertion.
- [x] 4.3 [P0] Prevent duplication when provider final body exists; depends on 4.1; output: provider transcript remains primary source; verify duplicate-prevention test.
- [x] 4.4 [P1] Preserve Claude thinking visibility rules during shadow recovery; depends on 4.1; output: recovered assistant text shows while hidden thinking remains hidden; verify existing thinking visibility tests plus new case.

## 5. Long Live Rendering Stability

- [x] 5.1 [P1] Add secondary paragraph-preserving live rendering guard for long assistant text; depends on 1.3; output: live CJK/Markdown paragraphs remain separated without treating LiveMarkdown as the proven Claude root cause; verify rendering test passes.
- [x] 5.2 [P1] Add bounded processing-stage fallback for huge active rows; depends on 5.1; output: long live rows avoid repeated full Markdown work while processing; verify diagnostics and component tests.
- [x] 5.3 [P1] Ensure completed output converges to final Markdown semantics; depends on 5.2; output: headings, lists, code fences, links, and emphasis render normally after completion; verify final convergence tests.
- [x] 5.4 [P1] Add visible-growth diagnostics for long live rows; depends on 5.2; output: diagnostics distinguish upstream delay from reducer/render amplification; verify diagnostics fixture.

## 6. Validation And Evidence

- [x] 6.1 [P0] Run focused Vitest suites for reducer, Claude restore, shadow transcript storage, and live rendering; output: all targeted tests pass.
- [x] 6.2 [P0] Run `npm run typecheck`; output: TypeScript contract remains valid.
- [x] 6.3 [P1] Run `openspec validate fix-long-live-assistant-stream-recovery --strict --no-interactive`; output: change artifacts validate strictly.
- [x] 6.4 [P1] Capture manual or scripted evidence with a 50k CJK stream fixture; output: no paragraph collapse after preview budget, no ellipsis merge, and recoverable history after simulated close.
