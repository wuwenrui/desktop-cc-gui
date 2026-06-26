## ADDED Requirements

### Requirement: Claude Custom Models MUST Appear In Grouped Selector

Claude Code custom models MUST remain available in grouped Composer model selector surfaces, even when Claude Code is not the currently active engine.

#### Scenario: Claude custom model visible outside active Claude engine
- **WHEN** the user has added a Claude custom model
- **AND** the active Composer provider is `Codex`, `Gemini`, or another provider
- **THEN** the grouped selector MUST include that Claude custom model in the Claude Code group
- **AND** it MUST preserve the custom runtime model value exactly as configured

#### Scenario: grouped selector preserves shape-only Claude custom model ids
- **WHEN** a Claude custom model id contains spaces, punctuation, Unicode characters, or provider-specific syntax
- **AND** the grouped selector is opened
- **THEN** the Claude Code group MUST keep that model visible
- **AND** it MUST NOT apply the generic Codex/Gemini model-id regex allowlist to the Claude custom entry
