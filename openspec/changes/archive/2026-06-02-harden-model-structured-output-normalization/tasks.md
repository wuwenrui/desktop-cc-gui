## 1. Structured-output foundation

- [x] 1.1 [P0][依赖: 无][输入: existing Project Map worker parser][输出: shared structured-output utility][验证: focused Vitest coverage] Extract JSON candidate scanning and lenient repair into a reusable model-output utility.
- [x] 1.2 [P0][依赖: 1.1][输入: caller validator][输出: typed parse result / diagnostic][验证: schema mismatch test] Require caller-provided validation before returning parsed payloads.

## 2. Project Map integration

- [x] 2.1 [P0][依赖: 1.*][输入: main Project Map generation responses][输出: shared normalizer adoption][验证: existing generation repair tests] Refactor generation parsing to use the shared utility without changing persisted schema.
- [x] 2.2 [P0][依赖: 1.*][输入: organizer responses][输出: organizer normalization + one JSON-only repair attempt][验证: malformed organizer JSON repair test] Route organizer output through shared normalization and bounded repair.
- [x] 2.3 [P0][依赖: 2.2][输入: unrecoverable organizer output][输出: fail-closed diagnostic][验证: failure test] Preserve visible `output_parse_failed` behavior when repair cannot produce a valid payload.

## 3. Regression coverage

- [x] 3.1 [P1][依赖: 2.*][输入: malformed model samples][输出: focused tests][验证: Vitest target files] Cover markdown-wrapped JSON, relaxed JSON, missing bracket repaired by retry, and schema mismatch cases.
- [x] 3.2 [P1][依赖: 3.1][输入: OpenSpec change][输出: validation evidence][验证: `openspec validate harden-model-structured-output-normalization --strict --no-interactive`] Validate the change artifacts after implementation.

## 4. Code-spec memory

- [x] 4.1 [P0][依赖: 1.*-3.*][输入: structured-output implementation lesson][输出: `.trellis/spec/frontend/model-structured-output.md` + index/quality triggers][验证: doc review] Capture the model-output normalization contract in frontend code-specs so future AI work reads the rule before implementation.
