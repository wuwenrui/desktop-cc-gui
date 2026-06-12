## Context

现有 `lawhub` 侧栏入口是自包含菜单，已下挂「制作 PPT」。Composer 已有事件桥可从侧栏触发 skill 选择，且 engine API 已支持同步独立调用并传入 `engine/model/images`。

关键约束是模型语义：OCR 可以使用视觉模型，但主对话当前模型必须保持不变。用户后续继续对话时，仍由主 Composer 当前 engine/model 执行，只是输入中多了 OCR 后的纯文本材料。

## Decisions

### Decision 1: OCR 是独立视觉子任务，不是普通 skill

「OCR 识别」入口打开专用面板。用户选择文件和视觉模型后，前端调用独立 OCR runner：

```text
source file -> pdf/image normalizer -> vision model batch call -> markdown result
                                               |
                                               +-> writeWorkspaceFile(lawhub-ocr/...)
                                               +-> dispatch composer insert event
```

OCR runner 调 `engineSendMessageSync` 时必须显式传 `engine`、`model`、`images`、`continueSession=false`，并使用独立 `autoSession` 标识。它不得调用 `setActiveEngine`、`setSelectedModelId` 或写入 thread composer selection。

### Decision 2: 逐模型视觉能力不能只看引擎能力

现有 `EngineFeatures.imageInput` 是引擎级能力，只说明该引擎通道支持图片输入，不说明当前 provider/model 都支持视觉。OCR 模型候选按以下顺序解析：

1. 模型对象的显式 `capabilities.imageInput === true`。
2. 用户保存的 OCR 视觉模型绑定。
3. 保守内置 hint：已知视觉模型名匹配时标为 supported。
4. 引擎级 `imageInput=true` 但模型未知时标为 unknown，只能手动选择并展示提示，不能自动选择。

DeepSeek/ds 这类未知或明确文本模型不得被自动选择为 OCR 模型。

### Decision 3: OCR 输出双落点

每次 OCR 生成一个 Markdown 文件：

```text
lawhub-ocr/<source-stem>/<YYYYMMDD-HHmmss>-ocr.md
```

文件内容包含来源文件、识别模型、页码/图片分段、原文识别结果和识别备注。保存成功后再向 Composer 插入一段文本，包含保存路径和 OCR 正文。这样用户既能立即继续问，也能在案件目录固定路径下复用解析结果。

### Decision 4: PDF 先转页图片，分批识别

PDF 处理复用现有 `pdfjs-dist` worker。每页渲染为受控尺寸图片，按页批量传给视觉模型。默认限制页数、图片大小和并发，长 PDF 需要用户分段继续。

图片文件直接走图片输入。PDF 和图片都需要在 UI 中展示来源、页数/张数、当前批次、失败批次和可重试状态。

## Error Handling

- 未选择工作区：OCR 入口禁用或提示先选择案件/工作区。
- 没有视觉模型：展示模型配置入口，不回退主对话模型。
- 模型未知能力：允许手动选择，但提示该模型未被确认支持视觉。
- OCR 部分失败：保留成功页，结果文件标记失败页，允许重试失败页。
- 保存失败：不插入 Composer，提示保存失败，避免用户误以为结果已落盘。

## Testing

- 单元测试：模型视觉能力解析、输出路径生成、OCR prompt 构造、结果 Markdown 格式。
- 组件测试：Lawhub OCR 菜单、文件选择状态、无工作区/无视觉模型降级、保存后插入 Composer 事件。
- 服务测试：`engineSendMessageSync` 参数断言，确认不调用主模型切换 API。
- 集成/手动：选 PDF 识别，结果保存到 `lawhub-ocr/...`，当前 Composer 被插入文本，主模型选择保持不变。
