# Spec Delta: recovery-cookbook

## Purpose

Document the operational recovery fields and future provider template after `useCodexMessageRecovery` has been extracted.

## ADDED Requirements

### Requirement: Recovery cookbook MUST define diagnostic field semantics

The Codex provider runtime spec SHALL document `staleRecoveryClassification.reasonCode`, `staleReason`, and `userAction`.

#### Scenario: reasonCode is documented
- **WHEN** a recovery debug event includes `reasonCode`
- **THEN** the cookbook SHALL define the accepted values and their trigger conditions

#### Scenario: userAction is documented
- **WHEN** recovery code emits `fresh-continuation`, `fork-and-retry`, or `rebind-and-retry`
- **THEN** the cookbook SHALL explain the user-visible and runtime behavior for that action

### Requirement: Provider recovery template MUST be reusable

The cookbook SHALL include a GEMINI / CLAUDE recovery template that maps provider-specific stale session classifiers into the attempt-oriented recovery shape.

#### Scenario: Future provider recovery hook
- **WHEN** a future provider implements stale session recovery
- **THEN** it SHOULD reuse the `createRecoveryAttempt(deps)` style and replace only provider-specific classifiers and start/fork APIs
