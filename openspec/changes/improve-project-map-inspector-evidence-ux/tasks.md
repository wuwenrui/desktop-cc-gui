## 1. OpenSpec Readiness

- [x] 1.1 [P0][依赖: 无][输入: proposal/design/specs][输出: strict-valid OpenSpec artifacts][验证: `openspec validate improve-project-map-inspector-evidence-ux --strict`] 完成 change artifacts 并通过严格校验。

## 2. Project Map Inspector UX

- [x] 2.1 [P0][依赖: 1.1][输入: `ProjectMapPanel.tsx` toolbar/detail actions][输出: 移除 standalone Refresh 与 detail refresh action][验证: component test 不再能找到 refresh evidence button] 清理低价值刷新入口。
- [x] 2.2 [P0][依赖: 2.1][输入: candidate nodes][输出: 可点击 candidate badge 选择第一个候选并展开 inspector][验证: component test 点击 badge 后 inspector 显示 candidate node] 完成候选定位入口。
- [x] 2.3 [P0][依赖: 2.2][输入: selected candidate node][输出: candidate notice 与 i18n 文案][验证: component test 断言 notice 文案 key/文本存在] 补齐候选语义说明。
- [x] 2.4 [P1][依赖: 2.1][输入: related artifacts / sources metadata][输出: traceable artifact/source chip rendering][验证: component test 覆盖 path/ref/excerpt 与 no-trace fallback] 完成证据链 link-style UX。
- [x] 2.5 [P0][依赖: 2.1][输入: drilldown focus state][输出: Back to previous view 控件与 view history][验证: component test 下钻后返回上次] 补齐下层返回路径。
- [x] 2.6 [P0][依赖: 2.5][输入: focus view without history][输出: 返回上层 fallback][验证: component test 从无 history focus view 返回总览] 补齐无历史栈时的上层返回路径。

## 3. Styling

- [x] 3.1 [P0][依赖: 2.1][输入: `project-map.css` detail panel rules][输出: inspector 展开宽度约扩大 50%，collapsed rail 保持紧凑][验证: CSS selector regression / snapshot query] 调整详情面板宽度。
- [x] 3.2 [P1][依赖: 2.3,2.4][输入: candidate notice 与 trace chip classes][输出: 与现有 Project Map 视觉系统一致的样式][验证: focused DOM class assertions] 增加候选说明和证据 link 样式。
- [x] 3.3 [P0][依赖: 2.5][输入: graph layout constants][输出: 更紧凑的 overview/focus layout][验证: overlap test + focused distance assertion] 收紧节点间距但保留不重叠。
- [x] 3.4 [P0][依赖: 2.5][输入: canvas/detail navigation controls][输出: 横向 button group 与简短中文按钮文案，详情区收起/返回上次/返回总览同一行][验证: component test 断言 button group label] 收敛同类控制按钮。

## 4. Verification

- [x] 4.1 [P0][依赖: 2.*,3.*][输入: Project Map component tests][输出: focused tests pass][验证: `npm exec vitest -- run src/features/project-map/components/ProjectMapPanel.test.tsx --maxWorkers 1 --minWorkers 1`] 运行聚焦组件测试。
- [x] 4.2 [P0][依赖: 2.*,3.*][输入: TS project][输出: typecheck pass][验证: `npm run typecheck`] 运行类型检查。
- [x] 4.3 [P0][依赖: 4.1,4.2][输入: change artifacts][输出: strict OpenSpec validation pass][验证: `openspec validate improve-project-map-inspector-evidence-ux --strict`] 最终 OpenSpec 校验。
- [x] 4.4 [P0][依赖: 2.5,3.3][输入: Project Map component tests][输出: navigation/layout regression pass][验证: `npm exec vitest -- run src/features/project-map/components/ProjectMapPanel.test.tsx --maxWorkers 1 --minWorkers 1`] 验证返回上次与紧凑布局。
- [x] 4.5 [P0][依赖: 3.4][输入: Project Map component tests + i18n][输出: grouped controls regression pass][验证: `npm exec vitest -- run src/features/project-map/components/ProjectMapPanel.test.tsx --maxWorkers 1 --minWorkers 1`] 验证画布与详情按钮组。
