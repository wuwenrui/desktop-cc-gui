## Why

律师模式下，用户需要把案件资料里的 PDF/扫描件先变成可读文本，再继续在主对话中协同处理。主对话可能使用 DeepSeek 等无视觉能力模型，当前案件导入也明确跳过 PDF 文本解析。

本变更新增 lawhub 左侧菜单下的 OCR 能力。OCR 是独立视觉子任务：它可以临时使用用户模型列表中具备视觉能力的模型，但不得切换、覆盖或污染用户当前主对话的 engine/model/provider/thread 选择。

## 目标与边界

- Goal：在左侧 `lawhub` 菜单下新增「OCR 识别」入口。
- Goal：支持图片和 PDF；PDF 先渲染为页图片，再分批交给视觉模型识别。
- Goal：OCR 调用只使用独立视觉模型选择，不改变主对话模型。
- Goal：OCR 结果同时保存到当前工作区固定路径，并插入/附加到当前 Composer，供主模型继续处理。
- Goal：视觉模型来源必须来自用户可用模型列表，且按逐模型视觉能力筛选；引擎级 `imageInput` 只能作为粗筛。
- Boundary：不实现本地 OCR 引擎，不引入外部 OCR 云服务。
- Boundary：不把 OCR 做成普通 prompt skill，因为普通 skill 仍会走当前主模型。
- Boundary：不改 new-api，不要求 lawhub 后端参与 OCR。

## What Changes

- 新增 `lawhub-ocr` 前端 feature slice，包含 OCR 面板、模型选择、PDF/image 输入、进度与结果预览。
- 新增逐模型视觉能力解析：优先读取模型显式 capability，其次读取用户 OCR 视觉模型绑定，最后使用保守的已知模型名 hint；未知能力不自动选中。
- 复用现有 `engineSendMessageSync` 独立调用能力，发送 `engine/model/images`，并设置 `continueSession=false`。
- 复用现有 `writeWorkspaceFile` 保存 Markdown 结果到 `lawhub-ocr/<source-stem>/<run-id>.md`。
- 新增 Composer 插入事件，把结果摘要、保存路径和 OCR 文本插入当前输入区，不修改主模型。

## Capabilities

### New Capabilities

- `lawhub-ocr-vision-workflow`：桌面端在 lawhub 菜单内用独立视觉模型执行 OCR，并把结果保存到工作区与当前 Composer。

### Modified Capabilities

- `engine-capability-matrix`：不改现有引擎能力矩阵值；新增消费者规则，要求 OCR 不把引擎级 `image.input` 当作逐模型视觉能力。
