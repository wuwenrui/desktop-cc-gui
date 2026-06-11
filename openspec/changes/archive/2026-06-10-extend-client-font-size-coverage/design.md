## Context

Current behavior has two separate appearance mechanisms:

- `uiScale` is persisted and applied as WebView zoom through the Tauri window API.
- `codeFontSize` is persisted and injected as `--code-font-size` on the document root or selected detached window containers.

Several important surfaces already consume `--code-font-size`, but many readable client views still define local fixed sizes such as `10px`, `11px`, `12px`, and `13px`. The most visible gaps are file/folder surfaces and Git worktree file trees. Git worktree has partial variable indirection through `--git-filetree-*`, but some defaults are fixed and not fully derived from the configured font-size baseline.

The intended behavior is not full layout zoom. The product already has `uiScale` for that. The missing layer is a content typography scale: readable labels, file names, paths, metadata, status markers, and code-like text should respond consistently to the user's chosen font size.

## Design Goals

- Define one reusable typography token contract for client-readable text.
- Keep `uiScale` and content font size separate.
- Prefer CSS variable migration over one-off component logic.
- Make detached windows use the same token contract as the main window.
- Avoid broad mechanical replacement of every `font-size: Npx`.
- Keep high-density controls usable at the low/high ends of the supported range.

## Proposed Architecture

```text
AppSettings.codeFontSize
  -> normalize/clamp through existing settings path
  -> useCodeCssVars / shared typography helper
     -> --code-font-size
     -> --app-font-size-xs
     -> --app-font-size-sm
     -> --app-font-size-md
     -> --app-font-size-lg
     -> --app-font-size-xl
     -> domain aliases where useful:
        --client-content-font-size
        --client-meta-font-size
        --client-caption-font-size
        --git-filetree-name-font-size
        --git-filetree-path-font-size
        --git-filetree-status-font-size
        --git-filetree-badge-font-size
  -> CSS surfaces consume variables for readable text
```

The implementation should keep the current stored setting as the source of truth. If the user-facing copy is confusing, the UI can clarify that this value controls code and client content text size, but persistence should remain backward-compatible.

## Typography Token Rules

Recommended token semantics:

- `--code-font-size`: code body baseline, exactly the configured size.
- `--app-font-size-xs`: compact captions and minor badges, derived slightly below baseline with a readable floor.
- `--app-font-size-sm`: secondary metadata and muted paths.
- `--app-font-size-md`: standard client content labels.
- `--app-font-size-lg`: section titles and prominent labels.
- `--client-content-font-size`: alias for standard readable content text.
- `--client-meta-font-size`: alias for metadata/path text.
- `--client-caption-font-size`: alias for compact captions.

The exact formulas should be centralized, for example by using `calc(var(--code-font-size) +/- Npx)` with `clamp(...)` where supported. Avoid duplicating the same calculations in individual feature CSS files.

## Surface Migration Strategy

### Phase 1: highest-value gaps

Migrate surfaces directly matching the user-reported issue:

- file/folder tree rows;
- detached file explorer menubar and file tree text;
- Git History/HUB worktree file tree variables;
- shared Git diff/filetree typography aliases.

### Phase 2: adjacent readable client surfaces

Migrate code/file/diff metadata where the text is clearly content rather than fixed chrome:

- file view path/status metadata;
- diff headers, file names, line/code content where not already covered;
- status badges that represent textual data.

### Phase 3: broader audit

Audit remaining `font-size: Npx` usages and classify them into:

- content text: migrate to token;
- chrome/control text: consider token if user-facing and readable;
- icon/hit-target/layout geometry: leave fixed;
- intentionally tiny visual marker: leave fixed and document rationale if recurring.

## Detached Window Contract

Detached windows currently inject a subset of font variables manually. They should receive the same typography token set as the main document root. The implementation should avoid drift by using a shared helper that builds CSS variable values for both root injection and inline detached-window style objects.

Affected detached/client windows include at least:

- detached file explorer;
- detached Spec Hub window;
- client documentation window;
- detached Browser Agent window if it displays client chrome using app variables.

## Rejected Alternatives

### Use UI scale only

Rejected. UI scale affects the entire WebView and is too broad for users who only want more readable text in client surfaces.

### Convert every fixed pixel font-size at once

Rejected. The codebase has many fixed sizes, including icons, tiny markers, and density-sensitive controls. A blind replacement risks layout regressions and noisy visual drift.

### Add a new persisted setting immediately

Rejected for this change. The existing user complaint is about the current font-size setting not covering enough surfaces. A new setting can be considered later, but this change should first make the current setting coherent and backward-compatible.

## Validation

- Unit test shared typography variable builder if implemented as a helper.
- Update existing detached window tests to assert shared typography variables, not only `--code-font-size`.
- Add CSS contract tests for file tree and Git worktree token usage.
- Run focused tests for settings and detached file explorer.
- Run `npm run typecheck`.
- Run `npm run lint` if implementation touches TS/TSX.
- Run focused Vitest suites for modified CSS/React areas.

## Rollout / Compatibility

- Existing persisted settings remain valid.
- Existing default size remains valid.
- If variable calculations use newer CSS functions, include fallbacks where needed for supported WebView targets.
- The change should be visually reversible by setting the font size back to the default.
