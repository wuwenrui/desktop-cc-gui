## 1. OpenSpec Artifacts

- [x] 1.1 Create proposal for manual prompt enhancer provider/model/timeout control; input: confirmed requirement; output: `proposal.md`; validation: proposal states goals, non-goals, options, and acceptance criteria.
- [x] 1.2 Create capability spec; input: proposal capability list; output: `specs/composer-prompt-enhancer/spec.md`; validation: scenarios cover manual run, engine selection, model selection, timeout, adoption, and stale lifecycle.
- [x] 1.3 Create technical design; input: proposal and spec; output: `design.md`; validation: design records hook/dialog split and no-backend-change decision.

## 2. Frontend Implementation

- [x] 2.1 Split prompt enhancer open and run lifecycle in `usePromptEnhancer`; depends on 1.2; input: current Composer draft and user config; output: manual run API; validation: opening dialog does not call runtime.
- [x] 2.2 Add controlled provider and timeout fields to `PromptEnhancerDialog`; depends on 2.1; input: hook state; output: configuration UI and run button; validation: selected values are passed to run callback.
- [x] 2.3 Add controlled model selection for the selected enhancer engine; depends on 2.2; input: Composer provider model groups; output: selected enhancer model state; validation: runtime request receives selected model or null when unavailable.
- [x] 2.4 Wire new dialog props through `ChatInputBoxFooter` and `ChatInputBox`; depends on 2.1 and 2.3; input: hook return values and model groups; output: connected UI; validation: no runtime bridge schema change.
- [x] 2.5 Add localized copy for new controls; depends on 2.2; input: new UI labels; output: zh/en i18n keys; validation: no user-facing hardcoded strings.
- [x] 2.6 Add scoped prompt enhancer CSS for configuration controls; depends on 2.2; input: new class names; output: feature-local styles; validation: no global prompt panel selector changes.

## 3. Tests And Closure

- [x] 3.1 Update focused hook tests for manual open/run behavior; depends on 2.1; input: mocked `engineSendMessageSync`; output: tests for no-auto-run and configured engine/timeout; validation: focused Vitest target.
- [x] 3.2 Mark implementation tasks complete after code changes; depends on 2.1-3.1; input: changed files; output: updated `tasks.md`; validation: tasks reflect actual completion state.
- [x] 3.3 Optional verification on request; depends on 3.1; input: user approval to run checks; output: focused test/typecheck results; validation: commands recorded in final response.
