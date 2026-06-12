## 1. 规范与定位

- [ ] 1.1 [P0][Dep:none][I: 现有 lawhub 菜单、engine send、workspace file API][O: 影响文件清单与实现边界][V: rg 输出能定位全部入口] 确认菜单、模型、文件保存、Composer 插入链路。
- [ ] 1.2 [P0][Dep:1.1][I: OpenSpec change][O: `lawhub-ocr-vision-workflow` spec delta][V: `openspec validate add-lawhub-ocr-vision-workflow --strict --no-interactive`] 完成行为规范。

## 2. 视觉模型能力

- [ ] 2.1 [P0][Dep:1.2][I: `EngineModelInfo` / engine status / custom models][O: 视觉模型候选 resolver][V: Vitest 覆盖 supported/unknown/unsupported/ds 不自动选] 实现逐模型视觉能力解析。
- [ ] 2.2 [P0][Dep:2.1][I: 用户模型列表][O: OCR 模型选择 view model][V: Vitest 覆盖自动推荐和手动选择] 只从用户可用模型中产生 OCR 候选。

## 3. OCR 运行与落盘

- [ ] 3.1 [P0][Dep:2.2][I: `pdfjs-dist` / 图片路径][O: PDF/image normalizer][V: 单测覆盖 PDF 页范围、图片输入、大小限制] 生成视觉模型可消费的图片批次。
- [ ] 3.2 [P0][Dep:3.1][I: `engineSendMessageSync`][O: OCR runner][V: mock 断言 `engine/model/images/continueSession=false`，且不调用主模型切换] 独立调用视觉模型。
- [ ] 3.3 [P0][Dep:3.2][I: `writeWorkspaceFile`][O: `lawhub-ocr/<source-stem>/<run-id>.md`][V: 单测覆盖路径净化和内容格式] 保存 Markdown 结果。

## 4. UI 与 Composer 集成

- [ ] 4.1 [P0][Dep:3.3][I: `LawhubNavSection`][O: `OCR 识别` 子入口 + 面板][V: 组件测试覆盖入口和状态] 加侧栏入口。
- [ ] 4.2 [P0][Dep:3.3][I: Composer 事件桥][O: 保存成功后插入 OCR 文本和路径][V: 组件测试覆盖插入事件；主模型 state 不变] 双落点集成。
- [ ] 4.3 [P1][Dep:4.2][I: CSS/i18n][O: OCR 面板文案和样式][V: `npm run typecheck` + focused Vitest] 完成交互细节。

## 5. 验证

- [ ] 5.1 [P0][Dep:4.*][V: focused Vitest] 执行新增单元/组件测试。
- [ ] 5.2 [P0][Dep:5.1][V: `npm run typecheck`、相关 lint] 执行静态检查。
- [ ] 5.3 [P0][Dep:5.2][V: 桌面手动验收] 起 app 验证 PDF OCR、文件落盘、Composer 插入、主模型不变。
