# Design: Windows Titlebar Control Safe Zone

## Current Shape

`TitlebarExpandControls` renders two independent absolute-positioned groups inside `.titlebar-controls`:

- `WindowControls`: `titlebar-toggle titlebar-toggle-right titlebar-window-controls`
- floating sidebar toggle: `titlebar-toggle titlebar-toggle-right titlebar-sidebar-toggle` when layout is swapped

Both groups inherit `.titlebar-toggle-right { right: 10px; }` from `base.css`.

`main.css` already pads `.main-topbar` in some Windows collapsed-panel cases, but that only protects normal header content. It does not separate two controls that both live in the titlebar overlay layer.

## Chosen Design

Use a scoped CSS safe-zone offset:

```css
.app {
  --titlebar-window-controls-width: 116px;
  --titlebar-toggle-side-gap: 12px;
}

.app.windows-desktop.layout-swapped
  .titlebar-sidebar-toggle.titlebar-toggle-right {
  right: calc(
    10px + var(--titlebar-window-controls-width) + var(--titlebar-toggle-side-gap)
  );
}
```

This keeps the window controls visually fixed at the far right and shifts only the colliding floating sidebar toggle left.

## Alternatives Considered

### A. Full right-side flex container

Render window controls and titlebar sidebar toggle inside a single `.titlebar-controls-right` flex container.

Pros:
- Stronger long-term model.
- Future right-side controls naturally compose without absolute-position collisions.

Cons:
- Larger component/CSS change.
- Higher risk while AppShell/topbar code is currently under separate boundary refactor work.

Decision: defer. The CSS safe-zone fix is smaller and directly addresses issue #673.

### B. Hide floating sidebar toggle on Windows swapped layouts

Pros:
- Avoids overlap completely.

Cons:
- Removes an existing restore affordance.
- Changes behavior rather than layout.

Decision: reject.

### C. Increase `.main-topbar` padding only

Pros:
- Existing pattern already exists.

Cons:
- Does not affect `.titlebar-controls` overlay collisions.

Decision: reject as insufficient.

## Test Strategy

- CSS contract test asserts the Windows swapped `.titlebar-sidebar-toggle.titlebar-toggle-right` selector exists and uses `--titlebar-window-controls-width` plus `--titlebar-toggle-side-gap`.
- Component test asserts Windows titlebar renders both window controls and floating sidebar restore control when requested, with distinct class groups.
- Existing macOS/non-Windows assertions remain unchanged.
