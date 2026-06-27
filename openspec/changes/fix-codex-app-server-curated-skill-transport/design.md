## Context

Windows failures were correlated with enabling the bundled `lazy-senior-dev` curated skill. The skill body itself is valid. The failure point is transport: ccgui-generated instructions are large and were passed through Windows process argv during engine startup.

The previous Codex wrapper fallback tried to move generated instructions into a generated `--profile ccgui-generated-instructions` config. Direct CLI verification shows that `codex --profile <name> app-server` is not a supported app-server command shape, so that fallback must not be the contract.

Claude has an analogous risk: curated skills are appended through `--append-system-prompt <large body>`. On Windows, that large argv payload sits next to the stream-json stdin protocol and can trigger the same class of boundary failure.

Follow-up Windows testing confirmed this split:
- Codex works when generated instructions move to `turn/start.collaborationMode.settings.developer_instructions`.
- Claude works when large `--append-system-prompt` argv is removed, but the curated skill is not recognized because it is not present in Claude's native skills inventory.
- Claude sees native skills after mirror, but native skills are not automatically loaded; an activation policy is still needed.

## Goals / Non-Goals

**Goals:**
- Preserve enabled built-in skills on macOS/Linux launch paths and Windows Codex turns.
- Make Windows Codex session creation usable when curated skill argv transport blocks startup.
- Keep Windows Codex built-in skills usable through `turn/start.collaborationMode.settings.developer_instructions`.
- Keep Windows Claude built-in skills usable through Claude native skill discovery without large argv.
- Tell Windows Claude to invoke enabled native Skills for matching tasks through a short prompt file, not through inline argv text.
- Remove the invalid Codex `--profile ... app-server` fallback.
- Keep old Claude polluted history filtering as compatibility cleanup, not as the primary fix.

**Non-Goals:**
- Do not disable or remove `lazy-senior-dev`.
- Do not change macOS/Linux launch contracts.
- Do not mutate user-authored Codex or Claude config files.
- Do not add a frontend setting or per-message curated skill scope.

## Decisions

### Decision 1: Codex Windows launch omits generated-instruction argv

Codex Windows app-server launch will preserve user-authored `codexArgs` but omit ccgui-generated `developer_instructions` from process argv on both primary and retry paths. This avoids making the broken primary attempt fail before fallback can help.

Rejected alternatives:
- `--profile ccgui-generated-instructions app-server`: rejected because Codex app-server does not support that command shape.
- Disabling `lazy-senior-dev`: rejected because the user setting must remain enabled and usable on healthy paths.

### Decision 2: Codex Windows turns carry generated instructions in JSON-RPC settings

Codex already sends `turn/start.collaborationMode.settings.developer_instructions` for execution policy. Windows app-server turns will merge the external spec priority hint and enabled curated skill block into that same settings field. This keeps built-in skills usable without launch argv transport.

### Decision 3: Keep macOS/Linux Codex launch behavior unchanged

macOS/Linux Codex launch still injects generated instructions through supported `-c developer_instructions=...` behavior. This protects the working platforms from behavioral regression.

### Decision 4: Claude skips curated append on Windows

Claude macOS/Linux paths keep `--append-system-prompt`. Windows skips that generated argv body and continues to send user prompt content through stream-json stdin. This avoids touching macOS, which is already correct.

### Decision 5: Claude Windows mirrors curated skills into effective Claude home

Before a Windows Claude send, ccgui syncs enabled curated skills into `<effective Claude home>/skills/<skill-id>/SKILL.md`.

Effective Claude home is resolved dynamically:
1. configured Claude engine `home_dir`
2. `CLAUDE_HOME`
3. platform default Claude home

The mirror is ccgui-managed:
- write only directories containing a ccgui sentinel
- skip existing user-owned skill directories without overwriting them
- remove disabled curated skill mirrors only when the sentinel proves ccgui ownership

This keeps the skill usable via Claude's native skill discovery while avoiding the argv boundary that produced stream-json pollution on Windows.

### Decision 6: Claude Windows uses `--append-system-prompt-file` for activation policy

Windows CLI testing showed:
- native skill files make the skill visible, but do not auto-load the skill body
- stdin stream-json rejects `system` roles and cannot carry developer/system instructions
- `--append-system-prompt-file <path>` is supported with `-p --input-format stream-json --output-format stream-json --verbose`

Therefore Windows Claude launch uses a ccgui-managed short hint file. The hint only names enabled skill ids and instructs Claude to invoke the matching native Skill for coding/debugging/review/refactoring/implementation turns. It MUST NOT contain the full skill body.

The command argv carries only the hint file path:

```text
--append-system-prompt-file <effective Claude home>/ccgui/curated-skill-hints/enabled-curated-skills.md
```

### Decision 7: History filtering remains a compatibility layer

Leaked stream-json envelope filtering is still useful for already polluted transcripts. It should not add frontend retry state-machine behavior. Source transport fixes must prevent new pollution.

### Decision 7: Curated settings UI uses the SettingsView state source

The curated skill switch in Settings must not create its own `useAppSettings()` slot. `SettingsView` already owns the active `appSettings` snapshot and save path, so `CuratedSection` reads `enabledCuratedSkillIds` from that caller-owned snapshot and sends backend-returned `AppSettings` through `onUpdateAppSettings`.

This keeps the UI aligned with the authoritative backend result after `set_curated_skill_enabled` succeeds. It also avoids optimistic false positives: when the write fails, the previous visible switch state stays in place and the error is surfaced.

## Risks / Trade-offs

- [Risk] Windows Codex first-turn settings payload may be unsupported by older app-server builds. → Mitigation: use the existing `collaborationMode.settings.developer_instructions` path already used for execution policy and keep the existing capability fallback behavior.
- [Risk] Claude Windows native skill mirror collides with a user-owned skill id. → Mitigation: sentinel ownership check; user-owned directories are skipped and never overwritten.
- [Risk] Different machines use different Claude homes. → Mitigation: resolve configured home, `CLAUDE_HOME`, and platform default at runtime instead of hard-coding a path.
- [Risk] Reintroducing inline `--append-system-prompt` could revive Windows argv pollution. → Mitigation: use only `--append-system-prompt-file`; argv carries a path, not prompt body.
- [Risk] Historical polluted sessions remain on disk. → Mitigation: keep high-confidence history filtering for stream-json envelope rows and adjacent polluted assistant echoes.
- [Risk] Settings UI appears stale even though backend toggle persisted. → Mitigation: remove the duplicate `useAppSettings()` state slot from `CuratedSection` and drive the switch from `SettingsView`'s active settings snapshot.
