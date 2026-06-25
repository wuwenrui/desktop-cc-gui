# markdown-image-fullscreen-viewer Specification

## Purpose

Defines the contract for entering a fullscreen viewer on inline images embedded in Markdown content across both messages and file-preview surfaces, reusing the existing `viewerjs@^1.11.7` infrastructure introduced by the `markdown-mermaid-block-fullscreen-viewer` capability.

## ADDED Requirements

### Requirement: Image Fullscreen Entry MUST Exist On Both Surfaces

Both the messages surface and the file-preview surface MUST expose a way to open an inline image in a fullscreen viewer, and the entry MUST be triggered by user click on the image itself.

#### Scenario: messages surface image click opens viewer

- **WHEN** a user clicks an inline image rendered inside a messages-stream Markdown block
- **THEN** the messages surface MUST mount the image fullscreen viewer with the clicked image source
- **AND** the viewer container MUST be attached to `document.body` (not the image's parent)
- **AND** the messages surface MUST NOT alter the image's fallback path resolution (`LocalImage`'s `onError` / `readLocalImageDataUrl` chain stays intact).

#### Scenario: file-preview surface image click opens viewer

- **WHEN** a user clicks an inline image rendered inside a file-preview Markdown block
- **THEN** the file-preview surface MUST mount the same image fullscreen viewer with the clicked image source
- **AND** all file-preview fallback paths (broken-link rendering, file-link routing) MUST continue to work.

#### Scenario: file-preview relative image resolves against source markdown directory

- **WHEN** a Markdown file at `/repo/docs/report.md` contains `![x](assets/x.png)` or `![x](./assets/x.png)`
- **THEN** the file-preview renderer MUST resolve the image to `/repo/docs/assets/x.png` before rendering the `<img>`
- **AND** `LocalImage` MUST receive that resolved absolute path as `localPath` so the Tauri image bridge can recover if the asset URL fails
- **AND** clicking the image MUST pass the same resolved local path into the fullscreen viewer.

#### Scenario: fast file-preview path falls back for local images

- **WHEN** the fast HTML file-preview renderer is selected and the Markdown document contains a local image reference (`file://`, absolute path, `./`, `../`, or extension-like relative path)
- **THEN** the wrapper MUST fall back to the rich ReactMarkdown preview path
- **AND** the fallback reason MUST be reported as `fast-renderer-fallback:local-image-rich-fallback`
- **AND** the image MUST still render through the local path resolution contract above.

#### Scenario: image with empty or unresolvable source is inert

- **WHEN** an inline image has an empty `src` or a `src` that fails `normalizeMarkdownImageSrc`
- **THEN** the renderer MUST return `null` for that image (no viewer entry exposed)
- **AND** no error MUST leak into the surrounding render tree.

### Requirement: Image Fullscreen Viewer MUST Reuse Mermaid Viewer Infrastructure

The image fullscreen viewer MUST share the viewerjs runtime instance management, theme coordination, panel-lock coordination, reduced-motion handling, and singleton lifecycle introduced for the mermaid fullscreen viewer. It MUST NOT introduce a second viewerjs module instance, a second singleton, or a second CSS variable namespace for z-index.

#### Scenario: shared viewerjs module instance

- **WHEN** either the mermaid viewer or the image viewer is open
- **THEN** the `viewerjs` module referenced by both MUST be the same import (verified by `preloadViewerjs` module-level Promise cache).

#### Scenario: shared activeViewer singleton

- **WHEN** a user opens the image viewer while the mermaid viewer is already open
- **THEN** the existing mermaid viewer MUST be destroyed before the image viewer is created
- **AND** the converse MUST also hold (image viewer open, then mermaid viewer opens).

#### Scenario: cleanup preserves active viewer ownership

- **WHEN** a viewer component unmounts
- **THEN** the singleton's active viewer pointer MUST be cleared only if it still points to the unmounted viewer
- **AND** another surface's viewer MUST NOT be cleared by the unmount.

#### Scenario: panel-lock tears down image viewer

- **WHEN** a `.panel-lock-overlay` element appears anywhere under `document.body`
- **THEN** the open image viewer MUST be destroyed and the open state MUST reset
- **AND** the floater (if open) MUST continue to function below the lock overlay.

#### Scenario: theme switch syncs image viewer chrome

- **WHEN** the document root's theme attributes change
- **THEN** the open image viewer MUST call `viewer.update()` so toolbar, backdrop, and close-button colors retint against the new theme variables.

#### Scenario: reduced-motion disables transition

- **WHEN** `prefers-reduced-motion: reduce` is set
- **THEN** the image viewer MUST render with `transition: false` and `blur: 0px`
- **AND** the floater's hover-collapse animation MUST be disabled.

### Requirement: Image Fullscreen Viewer Toolbar MUST Match Yank Note Layout

The image viewer's toolbar MUST present the 8 buttons in the same order as the existing mermaid viewer: `zoomIn`, `zoomOut`, `oneToOne`, `reset`, `rotateLeft`, `rotateRight`, `flipHorizontal`, `flipVertical`, configured via boolean in object key order. The image viewer MUST additionally enable `prev` and `next` for multi-image navigation. `play` MUST stay `false`.

#### Scenario: toolbar order is deterministic

- **WHEN** the image viewer mounts
- **THEN** viewerjs MUST render the toolbar by iterating the `toolbar` object in declared key order (verified by `Object.keys`).
- **AND** the order MUST be `zoomIn → zoomOut → oneToOne → reset → rotateLeft → rotateRight → flipHorizontal → flipVertical → prev → next`.

#### Scenario: prev/next enable multi-image navigation

- **WHEN** a Markdown block contains more than one `<img>`
- **THEN** the image viewer's `prev` and `next` buttons MUST switch between sibling images within the same Markdown block (and not across blocks).

### Requirement: Image Source Resolution MUST Avoid Memory Blow-up

The image viewer's source resolution MUST avoid base64-encoding large images and MUST fall back gracefully when local file resolution fails.

#### Scenario: http(s) / data: / blob: / asset: URLs are passed through

- **WHEN** the image's `src` is `http(s)://`, `data:`, `blob:`, or `asset:`
- **THEN** the viewer MUST receive the original `src` directly (no `TextEncoder` / `btoa` round-trip)
- **AND** the original `src` MUST be the value rendered into the portal `<img>` element.

#### Scenario: file:// and local relative paths use Tauri bridge

- **WHEN** the image's `src` is `file://` or a local relative path AND a `workspaceId` is provided
- **THEN** the resolver MUST call `readLocalImageDataUrl(workspaceId, resolvedPath)` to obtain a data URL.
- **AND** if the bridge returns `null` or throws, the resolver MUST fall back to the original `src`.

#### Scenario: missing workspaceId with file:// does not crash

- **WHEN** the image's `src` is `file://` AND no `workspaceId` is provided
- **THEN** the resolver MUST skip the bridge and return the original `src` (the browser handles `file://` natively).

### Requirement: Image Fullscreen Viewer MUST Survive React StrictMode Double-Mount

The image viewer MUST defend against React 18 StrictMode dev-mode double-mount by guarding viewer creation and cleanup with a cancellation flag and an `open`-gated effect.

#### Scenario: dev double-mount creates one viewer

- **WHEN** `ImageFullscreenViewer` mounts twice in StrictMode dev with the same `open`/`src`
- **THEN** exactly one `Viewer` instance MUST be created.
- **AND** the second mount's cleanup MUST NOT destroy the first mount's viewer.

### Requirement: Image Fullscreen Errors MUST NOT Escape The Component

Any error during `resolveImageViewerSrc`, viewerjs construction, or option invocation MUST be caught and MUST result in a graceful `onClose` (and a `console.error` for diagnostics), not an unhandled rejection or a React tree crash.

#### Scenario: viewerjs constructor throws

- **WHEN** `new Viewer(...)` throws
- **THEN** the component MUST call `onClose()`
- **AND** the portal `<img>` MUST be removed from `document.body`
- **AND** the singleton MUST NOT be left pointing at a half-constructed viewer.

#### Scenario: empty src after resolution

- **WHEN** the resolved `src` is an empty string
- **THEN** the viewer MUST NOT open
- **AND** the parent state MUST reset to closed.
