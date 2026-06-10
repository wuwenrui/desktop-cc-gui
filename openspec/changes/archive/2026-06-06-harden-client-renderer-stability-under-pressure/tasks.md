## 1. Evidence And Current-State Mapping

- [x] 1.1 [P0][deps:none][input: issue #663 evidence + current diagnostics paths][output: evidence model note in implementation notes][validation: note separates Windows `STATUS_ACCESS_VIOLATION`, mac long-run white-screen, multi-engine jank, git polling noise, and runtime/helper process regression risks]
- [x] 1.2 [P0][deps:1.1][input: current renderer diagnostics, client-global-error-log, runtime performance evidence utilities][output: code reference map for existing diagnostic channels][validation: map identifies owner for renderer heartbeat, pressure snapshot, global error log, and evidence report]
- [x] 1.3 [P0][deps:1.1][input: current Tauri/wry/WebView integration][output: platform hook support matrix][validation: matrix classifies Windows WebView2, macOS WKWebView, and Linux WebKitGTK hooks as supported, unsupported, or not-implemented with reason]
- [x] 1.4 [P1][deps:1.2][input: existing runtime/helper process management paths][output: process visibility map for node/codex/claude/helper starts][validation: map records available process count/start signals and unsupported platform gaps]

## 2. Renderer Heartbeat, Watchdog, And Recovery

- [x] 2.1 [P0][deps:1.2][input: frontend app lifecycle + diagnostics service][output: privacy-safe renderer heartbeat sender][validation: unit test or focused fixture proves heartbeat excludes prompt, assistant, tool, file and environment content]
- [x] 2.2 [P0][deps:2.1][input: Tauri backend command/event channel][output: backend heartbeat receiver and bounded state store][validation: focused backend or service test records latest heartbeat by renderer/app scope]
- [x] 2.3 [P0][deps:2.2][input: heartbeat state + timer/scheduler][output: backend watchdog classification for missed heartbeat/unresponsive renderer][validation: test classifies missed heartbeat without claiming confirmed native crash]
- [x] 2.4 [P1][deps:1.3,2.2][input: platform hook support matrix][output: native process failure bridge where supported, unsupported markers where unavailable][validation: platform tests or static tests prove support state is emitted deterministically]
- [x] 2.5 [P1][deps:2.3][input: pressure snapshot contract][output: bounded renderer pressure snapshot metadata][validation: test covers active engine count, streaming turn count, process count support state, memory/long-task support state, and cap behavior]
- [x] 2.6 [P1][deps:2.3,2.5][input: recovery policy design][output: bounded reload/recovery state with backoff and diagnostic UI state][validation: focused test proves repeated failures stop automatic recovery and preserve or surface unsent Composer draft state]

## 3. Multi-Engine Streaming Pressure Control

- [x] 3.1 [P0][deps:1.1][input: Claude, Codex, Gemini, OpenCode, custom provider realtime ingress paths][output: streaming delta ingress map][validation: map identifies every active delta source and current fan-out into React state/projections]
- [x] 3.2 [P0][deps:3.1][input: shared realtime event batching utilities or new feature-local coalescer][output: bounded multi-engine delta coalescing boundary][validation: pure helper test proves deltas are coalesced by cadence and flushed on turn settlement]
- [x] 3.3 [P0][deps:3.2][input: Messages active row contract][output: active assistant row integration that remains visibly live under coalescing][validation: focused Messages test proves latest visible text updates and final settlement flushes]
- [x] 3.4 [P0][deps:3.2][input: Composer and message control action paths][output: immediate control bypass for draft, IME, selection, Stop, toolbar, copy/fork/rewind, scroll][validation: streaming fixture proves critical controls do not wait for coalesced timeline/status/catalog/sidebar work]
- [x] 3.5 [P1][deps:3.2,2.5][input: pressure diagnostics contract][output: streaming pressure diagnostics for coalesced update rate and active engine count][validation: diagnostic test proves labels are bounded and redacted]

## 4. Git Branch Polling Noise Guard

- [x] 4.1 [P0][deps:1.1][input: current git branch polling hook/service/backend command][output: branch polling call-path map][validation: map identifies where `.ccgui/workspace` enters branch list polling]
- [x] 4.2 [P0][deps:4.1][input: workspace path + repository validation utility][output: preflight Git repository validation before branch list][validation: focused test proves non-repository path skips branch list call]
- [x] 4.3 [P0][deps:4.2][input: branch UI state contract][output: neutral/degraded branch state for non-Git workspace][validation: UI or hook test proves no repeated `git/branches/list error` for default workspace path]
- [x] 4.4 [P1][deps:4.2][input: global error log diagnostic cap/dedupe utilities][output: dedupe/throttle for repeated branch polling failures][validation: test proves identical failures aggregate while permission/corrupt repository errors remain visible]

## 5. Runtime Helper And Passive Acquire Guardrails

- [x] 5.1 [P0][deps:1.4][input: passive selection, model list, account rate limits, thread list, session visibility paths][output: runtime acquire boundary audit matrix][validation: matrix marks each path as passive, helper-live, or runtime-required]
- [x] 5.2 [P0][deps:5.1][input: existing runtime lifecycle guard][output: regression tests for passive reads not acquiring runtime][validation: tests prove local history/passive metadata reads do not start runtime unless explicit action requires it]
- [x] 5.3 [P0][deps:5.1][input: helper reads requiring live runtime][output: shared guarded acquire path checks for helper reads][validation: tests prove acquire contention/quarantine surfaces from shared guard rather than helper-specific recovery storm]
- [x] 5.4 [P1][deps:1.4,5.1][input: process visibility map][output: bounded process start/count diagnostics by engine/workspace scope][validation: test or platform-gated fixture records node/codex/claude helper process evidence or unsupported reason]
- [x] 5.5 [P1][deps:5.2,5.3][input: archived fixes for background rollout leak and helper read regression][output: historical regression checklist in implementation notes][validation: checklist proves this change preserves prior passive selection and helper guard contracts]

## 6. Evidence Report And Validation

- [x] 6.1 [P0][deps:2.3,3.2,4.2,5.2][input: implemented diagnostics and focused tests][output: renderer stability evidence report][validation: report classifies Windows, macOS, Linux signals as measured, proxy, manual-only, or unsupported]
- [x] 6.2 [P0][deps:all P0 implementation tasks][input: OpenSpec artifacts][output: strict OpenSpec validation result][validation: `openspec validate harden-client-renderer-stability-under-pressure --strict --no-interactive` passes]
- [x] 6.3 [P0][deps:3.3,3.4,4.3,5.2][input: touched frontend tests][output: focused Vitest result for streaming coalescing, controls responsiveness, branch polling guard, runtime passive guard][validation: focused suites pass]
- [x] 6.4 [P1][deps:2.2,2.3,5.3,5.4][input: touched Tauri/backend code][output: focused Rust/backend test result][validation: targeted `cargo test --manifest-path src-tauri/Cargo.toml ...` passes or skipped with explicit frontend-only reason]
- [x] 6.5 [P1][deps:6.1,6.2,6.3][input: final implementation and evidence][output: closure notes with rollback switches and unsupported platform gaps][validation: closure notes list how to disable native hook, recovery, streaming coalescing and branch polling guard independently]
