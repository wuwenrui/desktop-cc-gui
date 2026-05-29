## Why

Web Service `/app` can white-screen when the daemon starts with `src-tauri` as its working directory. In that layout, `src-tauri/dist/index.html` may exist as an empty shell (`<body></body>`), and the asset resolver treated it as a valid frontend bundle before reaching the real repository `dist/index.html`.

## What Changes

- Validate candidate frontend asset roots by inspecting `index.html`, not only by checking file existence.
- Reject empty shell indexes that lack the React root and module asset entry.
- Continue probing later candidates so the real `dist` bundle is selected.

## Capabilities

### Modified Capabilities

- `client-web-service-settings`: Web Service packaged/development asset resolution MUST skip invalid empty shell indexes and keep probing for a valid frontend bundle.

## Impact

- Backend:
  - `src-tauri/src/bin/cc_gui_daemon/web_service_runtime.rs`
- Frontend:
  - None.
- Dependencies:
  - No new dependency.

## Acceptance Criteria

- `/app` MUST NOT serve an empty shell index when a later valid dist bundle exists.
- Asset resolution MUST still support explicit env, development checkout, Windows/macOS resources, and Linux AppImage candidate layouts.
- Focused Rust tests MUST cover empty-shell rejection and candidate fallback.
- `openspec validate fix-web-service-empty-dist-white-screen --strict --no-interactive` MUST pass.
