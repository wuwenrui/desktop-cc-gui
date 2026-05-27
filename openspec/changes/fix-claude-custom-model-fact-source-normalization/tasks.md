## 1. Spec

- [x] Create OpenSpec change scaffold.
- [x] Define shape-only Claude custom model normalization contract.
- [x] Add delta spec for Claude dynamic model discovery.

## 2. Implementation

- [x] Add shared Claude custom model normalization helper.
- [x] Replace composer custom Claude model reader with shared helper.
- [x] Replace engine controller custom Claude model reader with shared helper.
- [x] Keep Codex/Gemini custom model validation unchanged.

## 3. Tests

- [x] Update composer model option tests for spaces and user-entered model facts.
- [x] Update engine controller tests for the same normalization contract.
- [x] Run focused Vitest suites.
- [x] Run OpenSpec validation for the change.
- [x] Run full OpenSpec strict validation.
- [x] Run TypeScript typecheck.

## 4. Review Follow-up

- [x] Remove hardcoded Claude grouped selector fallback.
- [x] Use shape-only Claude custom model validation in the vendor model dialog.
- [x] Read vendor-side Claude custom models through the shared Claude normalizer.
- [x] Add focused dialog regression coverage for user-entered Claude model facts.
- [x] Add focused hook regression coverage for vendor-side Claude storage reads.
