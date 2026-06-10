# case-import

案件导入：从已有案件材料文件夹自动解析案件信息建案，替代手填表单成为主要建案方式。

## Requirement: AlphaBox 同步库发现

应用 SHALL 只读扫描 `~/.AlphaBoxNova/*/db/common_*.db/config_sqlite.db`（`common_*.db` 为目录）的 `folder_configs` 表（`local_root_path`/`remote_root_path`/`folder_status`），列出已同步到本地的资料库。DB 不存在、表缺失或 0 行 SHALL 返回空数组而非报错（未同步是常态）。

### Scenario: 本机未同步任何库
- WHEN `folder_configs` 为空或配置库不存在
- THEN 命令返回空数组，前端展示空态文案并引导去 AlphaBox 同步或直接选择本地文件夹

### Scenario: 已同步多个库
- WHEN 配置库存在且有多行映射
- THEN 每行返回 `{localRootPath, remoteName, status}`，前端以卡片（库名+本地路径）列出

## Requirement: 候选案件目录扫描

`scan_case_candidates(parent_dir)` SHALL 列出父目录的一级子目录（跳过隐藏目录与符号链接），每项返回 `{path, name, fileCount(递归上限500), hasDocx, hasPdf, modifiedAt}`。

### Scenario: 扫描资料库根目录
- WHEN 对一个 AlphaBox 库本地根或律师选择的父目录执行扫描
- THEN 仅一级子目录作为候选返回，隐藏目录与符号链接不出现

## Requirement: 案件文件夹规则解析（纯读取）

`parse_case_folder(dir)` SHALL 遍历目录（深度 ≤3、文件数 ≤200、单文件 ≤10MB），解析 .docx（zip 取 `word/document.xml` 剥标签）与 .txt/.md（UTF-8 优先，失败按编码探测兜底），返回 `CaseDraft`：案件名建议、案号、案由、法院、阶段建议与依据、当事人列表（角色+名称，不猜立场）、已解析文件、跳过的 PDF 数与 notes。每个解析字段 SHALL 带 `sourceFile` 与 `confidence(high|medium|low)`；解析不出的字段为 null。本命令 SHALL 零写入，绝不修改目标目录。

### Scenario: 含起诉状与受理通知书的文件夹
- WHEN 文件夹内 docx 起诉状含「原告：/被告：」行、txt 受理通知含案号与「案由：」
- THEN 草稿含当事人（角色原样）、案号、案由、法院，各带来源文件；阶段建议 filed

### Scenario: PDF 与扫描件
- WHEN 文件夹内存在 PDF 文件
- THEN 本期不解析，计入 `skippedPdfCount` 并在 notes 标注「N 个 PDF 未解析」

### Scenario: 解析不出任何字段
- WHEN 文件夹内只有图片或无信号文本
- THEN 草稿字段为 null/空列表，案件名建议回退文件夹名，阶段建议 intake，不报错

## Requirement: 阶段保守推断

阶段 SHALL 按案件进程从后往前匹配关键词并给出证据（`stageEvidence`）：执行通知/执行裁定 → enforcement；判决书/裁定书 → judgment；受理通知/缴费通知/传票或解析到案号 → filed；有起诉状但无案号 → filing_prep；否则 intake。「执行裁定书」SHALL 判为 enforcement 而非 judgment。

### Scenario: 同时存在判决书与执行通知
- WHEN 文件夹含「判决书.docx」与「执行通知书.pdf」
- THEN 阶段建议 enforcement，证据列出命中的文件名/内容

## Requirement: 导入确认与登记表写入

确认页 SHALL 预填解析结果，每个有来源的字段旁灰字标「来自 {文件}」，无来源字段留空；当事人逐行由律师指定我方/对方（缺省不指定）。确认导入 SHALL 写入 caseRegistry：`workspacePath` = 原目录、`origin: "imported"`、可选 `caseNo`/`courtName`/解析阶段；默认 SHALL NOT 在原目录创建骨架子目录（「补齐标准子目录」勾选项默认关）；随后打开工作区。类型扩展 SHALL 兼容旧记录（无 `origin`/`courtName` 的记录照常加载）。

### Scenario: 单个导入
- WHEN 律师在确认页指定我方/对方并点「确认导入」
- THEN 登记表新增一条 origin=imported 的记录，原目录未被修改，工作区被打开

### Scenario: 勾选补齐子目录
- WHEN 律师勾选「补齐标准子目录」后确认
- THEN 在原目录下创建六个标准子目录后再写登记表

## Requirement: 批量导入

「多个案件的父目录」模式 SHALL 对候选目录逐行解析（并发 ≤3），解析成功的行默认勾选且案件名逐行可改；点「导入所选」SHALL 一次性写入所有勾选案件（不自动打开工作区，提示导入数量）。

### Scenario: 批量导入两个案件
- WHEN 父目录下两个候选都解析成功，律师改了其中一个案件名并全选导入
- THEN 登记表新增两条记录，改名生效，界面提示「已导入 2 个案件」
