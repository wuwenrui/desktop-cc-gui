## Context

`resolve_web_assets_root` previously selected the first candidate directory containing `index.html`. That was too weak because `src-tauri/dist/index.html` can be a placeholder shell while the actual Vite bundle lives at repository root `dist/index.html`.

## Decision

Keep the existing candidate order, but make candidate acceptance stricter:

- `index.html` must be readable.
- It must contain the React mount root (`id="root"` or `id='root'`).
- It must contain a module entry or bundled asset reference.

This preserves all existing path probing behavior while preventing a false-positive root from stopping the search.

## Testing

- Unit test rejects `<body></body>` shell indexes.
- Unit test verifies a valid later `dist` candidate is selected after an invalid earlier candidate.
- Existing web service runtime tests verify candidate generation for AppImage and platform layouts remains intact.

## Rollback

Revert the asset-root validation helper and tests. This restores the old behavior but reintroduces the white-screen false-positive risk.
