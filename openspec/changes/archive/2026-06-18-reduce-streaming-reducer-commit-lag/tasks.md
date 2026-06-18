## 1. Implementation

- [x] 1.1 [P0][input: `src/features/threads/hooks/useThreadItemEvents.ts`][output: operation-level dispatch priority helper] Add a small helper that classifies `appendAgentMessageDelta` as urgent live delta work while leaving terminal and heavy normalized events unchanged.
- [x] 1.2 [P0][depends:1.1][input: realtime batcher first-token/cadence/manual flush paths][output: urgent live delta reducer dispatch] Apply the helper to batcher flush execution so live assistant deltas do not enter transition scheduling after flush.

## 2. Tests

- [x] 2.1 [P0][depends:1.2][input: `useThreadItemEvents.test.ts`][output: cadence dispatch priority regression] Add or update hook tests proving cadence-flushed `appendAgentMessageDelta` dispatches immediately and does not enqueue `scheduleRealtimeDispatch`.
- [x] 2.2 [P0][depends:1.2][input: existing terminal fence tests][output: terminal fence still protected] Verify queued/stale normalized event tests still prove terminal state is checked before mutation.

## 3. Validation

- [x] 3.1 [P0][depends:2.1-2.2][input: focused frontend suites][output: test results] Run focused Vitest suites for item events, reducer fast path, and realtime batcher contract.
- [x] 3.2 [P0][depends:3.1][input: TypeScript/lint/OpenSpec][output: final gates] Run `npm run typecheck`, `npm run lint`, and `openspec validate reduce-streaming-reducer-commit-lag --strict --no-interactive`.

## 4. Runtime Evidence Follow-up

- [x] 4.1 [P0][input: hot-start user streaming turn][output: post-fix runtime observation] Export renderer diagnostics after the user reruns a streaming turn and record whether `realtime.turnTrace.summary` is available.
- [x] 4.2 [P0][depends:4.1][input: raw renderer diagnostics][output: next bottleneck classification] Classify the next actionable bottleneck from observed labels when no turn summary is emitted.

## 5. Visible Text Surface Follow-up

- [x] 5.1 [P0][depends:4.2][input: `MessagesRows.stream-mitigation.test.tsx`][output: lightweight Markdown visible report regression] Add a focused regression proving lightweight/Codex recovery streaming reports current assistant text when Markdown rendered-value callback is delayed.
- [x] 5.2 [P0][depends:5.1][input: `MessagesRows.tsx`][output: row-level visible text fallback] Add the minimal streaming lightweight Markdown visible-text fallback without forcing Codex to plain text.
- [x] 5.3 [P0][depends:5.2][input: focused frontend suites][output: test results] Run focused MessageRow and realtime scheduling Vitest suites.
- [x] 5.4 [P0][depends:5.3][input: TypeScript/lint/OpenSpec][output: final gates] Run `npm run typecheck`, `npm run lint`, and OpenSpec strict validation.
