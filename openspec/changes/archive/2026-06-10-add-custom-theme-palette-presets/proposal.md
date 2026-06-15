## Why

自定义主题模式已经支持通过主题配色下拉选择 VS Code 风格 preset，但当前 catalog 数量偏少，用户在不同工作环境、显示器亮度、白天/夜间使用场景下缺少足够选择。

这次变更只扩充 preset catalog，不改变主题模式、设置持久化、runtime appearance 解析或下游 light/dark contract。

## What Changes

- 在 `设置 -> 基础设置 -> 外观 -> 自定义 -> 主题配色` 中新增 10 套不重样 preset。
- 新增 5 套 light appearance preset：
  - Catppuccin Latte
  - Tokyo Day
  - Rose Pine Dawn
  - Everforest Light
  - Ayu Light
- 新增 5 套 dark appearance preset：
  - Dracula
  - Nord
  - Catppuccin Mocha
  - Tokyo Night
  - Rose Pine
- 每套 preset 均提供完整主题源色，覆盖 editor/sidebar/panel/input/button/dropdown/list/activity/status/title/terminal/diff/link/badge 等现有 token 映射输入。
- 中英文 locale 与测试 i18n stub 同步新增 label。
- 设置页下拉和 theme preset utility 测试同步更新完整顺序断言。
- Rust settings sanitize 白名单与 window appearance 推导同步新增 preset，避免保存后被后端回退到默认 preset。

## Non-Goals

- 不新增用户自定义单个颜色 token 的编辑器。
- 不新增 VS Code theme JSON 导入器、在线 marketplace 或云同步。
- 不改变 `theme=custom` 的持久化字段结构。
- 不改变 `custom` preset 解析为 `light / dark` appearance 的 runtime contract。
- 不调整设置页布局或主题选择交互。

## Impacted Specs

- `settings-custom-theme-presets`: 扩展 curated preset catalog 的数量和覆盖要求。

## Impacted Code

- `src/features/theme/constants/vscodeThemePresets.ts`
- `src/types.ts`
- `src/i18n/locales/en.part1.ts`
- `src/i18n/locales/zh.part1.ts`
- `src/test/vitest.setup.ts`
- `src/features/theme/utils/themePreset.test.ts`
- `src/features/settings/components/SettingsView.test.tsx`
- `src-tauri/src/shared/settings_core.rs`

## Success Criteria

- 自定义主题配色下拉包含原有 preset 和新增 10 套 preset。
- 新增 preset 同时覆盖 light 与 dark appearance，各 5 套。
- 选择任一新增 preset 后仍只更新 `customThemePresetId`，不改写 light/dark slot。
- 保存设置后后端 MUST 保留新增 preset id，不得因 Rust sanitize 白名单遗漏而回退。
- 新增 preset 均能通过现有 token mapper 应用到客户端 UI。
- 设置页中英文环境下 label 可显示，不出现 untranslated key。
- Focused Vitest、typecheck、lint 和 large-file sentry 通过。

## Verification Status

当前实现已通过：

```bash
npx vitest run src/features/theme/utils/themePreset.test.ts src/features/settings/components/SettingsView.test.tsx
npm run typecheck
npx eslint src/types.ts src/features/theme/constants/vscodeThemePresets.ts src/i18n/locales/en.part1.ts src/i18n/locales/zh.part1.ts src/test/vitest.setup.ts src/features/theme/utils/themePreset.test.ts src/features/settings/components/SettingsView.test.tsx
npm run lint
npm run check:large-files
cargo test --manifest-path src-tauri/Cargo.toml shared::settings_core::tests
```

待用户手动测试设置页视觉和主题切换体验。
