## MODIFIED Requirements

### Requirement: Packaged Web Service MUST Resolve Bundled Frontend Assets

Web Service runtime MUST resolve packaged frontend assets from supported desktop bundle layouts before falling back to the "frontend assets not found" page.

#### Scenario: explicit asset directory remains highest-priority override
- **WHEN** `MOSSX_WEB_ASSETS_DIR` is set to a directory containing a valid frontend `index.html`
- **THEN** Web Service MUST serve that directory as the frontend asset root
- **AND** it MAY also accept the same env value when the real asset root is its `dist` child

#### Scenario: invalid empty shell index is skipped
- **WHEN** a candidate asset directory contains an `index.html` without the app mount root or module/asset entry
- **THEN** Web Service MUST treat that candidate as invalid
- **AND** it MUST continue probing later asset candidates before serving `/app`

#### Scenario: local development layout remains supported
- **WHEN** Web Service starts from a development checkout whose `cwd` or daemon executable ancestors expose a valid `dist/index.html`
- **THEN** Web Service MUST resolve that `dist` directory without requiring `MOSSX_WEB_ASSETS_DIR`
- **AND** existing `resources/dist` and `Resources/dist` candidates MUST remain supported for Windows and macOS bundle compatibility

#### Scenario: Linux AppImage layout is resolved from APPDIR
- **WHEN** Web Service runs inside a Linux AppImage where `APPDIR` points at the mounted bundle root
- **THEN** Web Service MUST probe `$APPDIR/usr/lib/ccgui/dist/index.html`
- **AND** it MUST serve that directory when present and valid

#### Scenario: Linux AppImage layout is resolved from daemon executable ancestry
- **WHEN** Web Service runs inside a Linux AppImage with daemon executable path like `$APPDIR/usr/bin/cc_gui_daemon`
- **THEN** Web Service MUST derive the bundle root from executable ancestors and probe `$APPDIR/usr/lib/ccgui/dist/index.html`
- **AND** this fallback MUST NOT change token authentication, RPC routing, port validation, or static asset response semantics
