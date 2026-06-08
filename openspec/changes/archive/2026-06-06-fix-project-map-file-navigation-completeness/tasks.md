## 1. Projection split（P0）

- [x] 1.1 输入：`relationshipDashboardData.files`、query、role filter、noise toggle；输出：full matching file projection，不做 Top N 裁剪；验证：Files Explorer 可基于 matching total 构建分组。
- [x] 1.2 输入：full matching projection；输出：bounded graph/top files projection；验证：Graph rail 仍只渲染有限高相关文件且不影响 explorer 数据源。
- [x] 1.3 输入：selection state；输出：selected/inspected file lookup 支持 full matching set；验证：从 explorer 选中的文件可继续聚焦 graph/inspector。

## 2. Files Explorer completeness（P0）

- [x] 2.1 输入：full matching projection；输出：Files Explorer groups 使用完整匹配集合；验证：大扫描下 group count 不受 120 Top limit 限制。
- [x] 2.2 输入：grouped files；输出：默认每组 bounded render，并展示 group total/rendered counts；验证：几千文件不会一次性铺满 DOM。
- [x] 2.3 输入：active query/filter/noise；输出：搜索与过滤作用于完整扫描集合；验证：被 Top rail 截断之外的文件仍可通过搜索出现。

## 3. UI language and transparency（P0）

- [x] 3.1 输入：Graph rail header；输出：`File Tree` 语义改为 `Top Files` / 高相关文件；验证：用户不会把 capped rail 理解为完整导航。
- [x] 3.2 输入：Explorer header/counts；输出：显示 scanned/matching/rendered 或等价透明计数；验证：用户能区分扫描总量与当前渲染量。
- [x] 3.3 输入：zh/en locale；输出：中英文 i18n 同步更新；验证：无硬编码用户可见文案。

## 4. Verification notes（P1）

- [x] 4.1 记录建议验证：focused Project Map relationship UI test 或 manual smoke：scan -> graph top files -> files explorer search -> select file -> inspector focus。
- [x] 4.2 记录建议验证：`openspec validate fix-project-map-file-navigation-completeness --strict --no-interactive`、`npm run typecheck`。

## 5. Graph rail grouping（P0 follow-up）

- [x] 5.1 输入：Top Files projection；输出：按 role -> module/path segment 构建 1-2 层分组；验证：Graph rail 不再平铺所有 Top files。
- [x] 5.2 输入：二级分组 files；输出：每组默认 bounded render 并提供展开/收起；验证：大组可分页式展开，默认不会铺满 rail。
- [x] 5.3 输入：Graph rail grouped UI；输出：zh/en 文案与 feature-scoped CSS；验证：无硬编码文案，视觉层级清楚。

## 6. Graph rail collapsible hierarchy（P0 follow-up）

- [x] 6.1 输入：role/module group hierarchy；输出：role 与 module 两层均可折叠；验证：Top Files 不再默认展开所有层级。
- [x] 6.2 输入：selected file state；输出：选中文件所在 role/module 路径强制保持可见；验证：选择文件后不会因折叠丢失上下文。
- [x] 6.3 输入：折叠按钮 UI；输出：feature-scoped CSS 与 zh/en 折叠状态文案；验证：toggle 不继承文件卡片竖条样式。
