## Context

The existing Windows wrapper fallback was introduced to handle `.cmd/.bat` launch fragility by retrying without the internal external-spec `developer_instructions` hint in argv. The later curated-skill always-on work added another generated `developer_instructions` path: enabled curated skill bodies, including the default `lazy-senior-dev`, are appended to Codex app-server args at launch time.

The user reproduced the failure on Windows and confirmed that disabling `lazy-senior-dev` lets Codex session creation succeed. That narrows the issue to generated instruction transport through the Windows wrapper command line, not Codex availability or general app-server capability.

Codex CLI supports `--profile <name>`, which layers `$CODEX_HOME/<name>.config.toml` on top of base config. That gives us a stable file-based transport for large generated instructions.

## Root Cause

`CodexAppServerLaunchOptions::wrapper_compatibility_retry()` currently disables `inject_internal_spec_hint`, but `build_codex_app_server_args_with_settings()` still sees live `AppSettings` and can append curated skill bodies as a generated `developer_instructions` config argument.

On Windows wrapper launch, fallback can still execute a fragile shape similar to:

```text
cmd.exe /c codex.cmd -c developer_instructions="<large curated skill body>" app-server
```

The correct fallback is not to drop curated skills. The correct fallback is to move ccgui-generated instructions out of argv and into a generated Codex profile file under the runtime's effective `CODEX_HOME`.

## Proposed Design

Add a generated profile projection for wrapper compatibility retry.

Suggested constants:

```rust
const CODEX_GENERATED_PROFILE_NAME: &str = "ccgui-generated-instructions";
```

The generated file path is:

```text
<effective CODEX_HOME>/ccgui-generated-instructions.config.toml
```

The generated file contains only ccgui-owned launch projection:

```toml
developer_instructions = "...merged internal hint and enabled curated skills..."
```

Primary behavior remains unchanged:

```text
codex [user args] -c developer_instructions="..." app-server
```

Wrapper retry behavior becomes:

```text
codex.cmd [user args] --profile ccgui-generated-instructions app-server
```

### Effective CODEX_HOME

The implementation must use the same `CODEX_HOME` that the child process receives:

| Runtime kind | Effective `CODEX_HOME` source | Generated profile location |
| --- | --- | --- |
| Disk profile | workspace `codex_home`, inherited parent/worktree `codex_home`, legacy `.codemoss`, or default `~/.codex` | that resolved disk home |
| Managed provider | provider-scoped home under `codex-provider-homes/<providerId>/` | that provider-scoped home |

The implementation must not write `~/.codex/config.toml` and must not write a generated profile into disk home for a managed provider.

### User Overrides

If user-authored `codexArgs` already include `developer_instructions=` or `instructions=`, ccgui must not create a competing generated profile. The user override remains in argv because it is user-owned and already part of their configured args.

### File Write

Use existing owner-only write semantics where appropriate and create the `CODEX_HOME` directory if missing. The generated profile is deterministic and replaceable on each launch so toggling curated skills followed by runtime restart projects the current enabled set.

## Compatibility

- macOS/Linux are unaffected because wrapper retry is platform-gated.
- Windows direct `.exe` launches are unaffected because wrapper retry is not used.
- Healthy Windows wrapper primary launch still uses existing argv injection and does not retry.
- Failed Windows wrapper launch still reports both primary and fallback errors if retry also fails.
- Generated profile files are ccgui-owned runtime projections, not user-authored config.

## Risks

- A user may already have a profile named `ccgui-generated-instructions`. Prefixing with `ccgui-` and treating the file as generated makes ownership explicit; a future hardening pass may add hash or metadata if collisions are observed.
- If Codex changes `--profile` semantics, fallback could fail. Tests must lock argv construction, and runtime diagnostics already preserve fallback errors.
- User-authored `developer_instructions` in `codexArgs` can still be fragile on Windows wrappers. This is outside ccgui-generated instruction transport and should not be silently rewritten.

## Verification

- Add Rust unit coverage for generated fallback projection:
  - primary launch with `lazy-senior-dev` enabled includes `writableRoots` and `lazy-senior-dev` in argv;
  - wrapper retry with `lazy-senior-dev` enabled writes a generated profile under the supplied `CODEX_HOME`;
  - wrapper retry argv includes `--profile ccgui-generated-instructions` and does not include `lazy-senior-dev` or large generated instruction text;
  - wrapper retry preserves valid user args.
- Run focused backend tests:

```bash
cargo test --manifest-path src-tauri/Cargo.toml backend::app_server_cli --lib
```

- Validate OpenSpec:

```bash
openspec validate fix-windows-codex-wrapper-curated-instructions --strict --no-interactive
```
