## Tasks

- [x] 1. Extend theme preset ID unions with five new light preset ids and five new dark preset ids.
- [x] 2. Add the 10 preset ids to the custom theme picker catalog while preserving existing light-first then dark ordering.
- [x] 3. Define full VS Code-style color maps for Catppuccin Latte, Tokyo Day, Rose Pine Dawn, Everforest Light, Ayu Light, Dracula, Nord, Catppuccin Mocha, Tokyo Night, and Rose Pine.
- [x] 4. Register each preset in `VSCODE_THEME_PRESETS` with stable label keys and correct `light` / `dark` appearance.
- [x] 5. Add English and Chinese locale labels plus Vitest i18n stub labels.
- [x] 6. Update focused tests for all custom theme picker options and utility catalog ordering.
- [x] 7. Sync Rust settings sanitize and window appearance resolution with the expanded preset catalog.
- [x] 8. Add Rust regression coverage proving newly added preset ids survive backend sanitize and resolve to the correct light/dark appearance.
- [x] 9. Run verification: focused Vitest, typecheck, targeted ESLint, full lint, large-file sentry, and focused Rust settings tests.
- [x] 10. Human-test settings UI: open custom theme palette, switch through representative new light/dark presets, and confirm readability across main surfaces.
- [x] 11. Run OpenSpec strict validation for this change after artifact writeback.
