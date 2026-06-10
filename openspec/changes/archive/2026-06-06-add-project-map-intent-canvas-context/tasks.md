# Tasks: Project Map Intent Canvas Context

- [x] 1. 新建 Intent Canvas 会话上下文 OpenSpec artifacts。
- [x] 2. 修复 `ProjectMapIntentCanvas` 接入后暴露的 TSX / type 问题。
- [x] 3. 在 `ProjectMapPanel` 接入 canvas open state、source seed 与 submit callback。
- [x] 4. 在 `DetailPanel` 增加 Architect / Spotlight 两个动作入口。
- [x] 5. 在 layout hook 与 app shell 中打通 canvas payload -> current conversation message。
- [x] 6. 补齐 Intent Canvas overlay 样式与响应式布局。
- [x] 7. 补齐中英文 i18n 文案。
- [x] 8. 执行 focused validation 并记录结果。

## Validation

- `openspec validate add-project-map-intent-canvas-context --strict --no-interactive`
- `npm run typecheck`
- `npm run check:large-files`
