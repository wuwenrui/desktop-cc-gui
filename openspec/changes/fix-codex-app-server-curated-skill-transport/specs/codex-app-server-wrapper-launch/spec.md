## MODIFIED Requirements

### Requirement: Windows Wrapper Failure MUST Use Bounded Compatibility Retry

When Windows `.cmd/.bat` wrapper launch fails before Codex app-server initialization completes, the system MUST attempt a bounded compatibility retry that avoids known fragile wrapper argument combinations. Compatibility retry MUST use argument forms supported by `codex app-server`; it MUST NOT rely on `--profile <name> app-server`.

#### Scenario: Windows primary avoids generated developer instructions argv
- **WHEN** the app starts a Codex app-server process on Windows
- **AND** ccgui-generated instructions contain the external spec priority hint or enabled curated skill bodies
- **THEN** primary launch argv MUST NOT include generated `developer_instructions` quoted TOML config arguments
- **AND** the launch argv MUST still preserve user-provided Codex args unless they are invalid

#### Scenario: wrapper primary fails before initialize
- **WHEN** the resolved Codex binary is a `.cmd` or `.bat` wrapper on Windows
- **AND** the primary app-server launch exits, closes stdout, or fails initialize before the session becomes connected
- **THEN** the system MUST attempt at most one compatibility retry for that launch request
- **AND** retry diagnostics MUST retain the primary failure summary

#### Scenario: compatibility retry avoids generated developer instructions argv
- **WHEN** compatibility retry is attempted for a Windows wrapper launch
- **THEN** the retry MUST avoid sending internally generated `developer_instructions` quoted TOML config arguments through `cmd.exe /c <wrapper>`
- **AND** the omitted generated argv instructions MUST include the external spec priority hint
- **AND** the omitted generated argv instructions MUST include curated skill bodies such as `lazy-senior-dev`
- **AND** user-provided Codex args MUST still be preserved unless they are invalid

#### Scenario: compatibility retry does not use profile app-server transport
- **WHEN** compatibility retry is attempted for a Windows wrapper launch
- **THEN** retry argv MUST NOT include `--profile ccgui-generated-instructions app-server`
- **AND** retry MUST NOT create a ccgui-generated profile file as the app-server curated skill transport

#### Scenario: retry success creates usable session
- **WHEN** primary Windows wrapper launch fails before initialize
- **AND** compatibility retry completes initialize handshake successfully after omitting ccgui-generated instructions
- **THEN** the system MUST create a usable Codex workspace session
- **AND** runtime diagnostics SHOULD indicate that fallback was retried

#### Scenario: retry success suppresses primary pre-connect failure events
- **WHEN** primary Windows wrapper launch emits startup failure events before initialize completes
- **AND** compatibility retry completes initialize handshake successfully
- **THEN** the system MUST NOT emit the primary attempt's pre-connect `runtime/ended` or stderr events to the user-facing app-server stream
- **AND** the connected retry session MUST remain the only user-visible startup outcome

#### Scenario: retry failure keeps both errors diagnosable
- **WHEN** primary Windows wrapper launch fails
- **AND** compatibility retry also fails
- **THEN** the user-facing error detail MUST include both the primary failure and fallback failure summaries
- **AND** it MUST NOT collapse the result into a generic unknown startup failure

### Requirement: Wrapper Compatibility MUST Be Testable

The system MUST include targeted backend tests that lock the wrapper fallback contract and protect non-wrapper paths from accidental behavior changes.

#### Scenario: wrapper fallback gating is covered
- **WHEN** backend tests exercise Windows wrapper launch planning or equivalent platform-gated helpers
- **THEN** they MUST verify that `.cmd/.bat` wrapper failures are eligible for bounded compatibility retry
- **AND** direct executable launches are not eligible

#### Scenario: generated instructions degraded fallback is covered
- **WHEN** backend tests exercise compatibility retry planning with curated skills enabled
- **THEN** they MUST verify that retry argv avoids the fragile internally generated `developer_instructions` config argument
- **AND** they MUST verify that retry argv does not use `--profile ccgui-generated-instructions`
- **AND** they MUST verify that retry preserves user-provided Codex args

#### Scenario: Windows primary omission is covered
- **WHEN** backend tests exercise platform-specific Codex app-server launch options
- **THEN** they MUST verify that Windows primary launch omits ccgui-generated `developer_instructions` argv
- **AND** they MUST verify that macOS/Linux primary launch behavior can still include generated `developer_instructions` argv.
