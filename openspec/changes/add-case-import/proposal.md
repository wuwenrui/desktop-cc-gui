## Why

lawyer-shell 的「新建案件」是手填表单，被用户批评为「儿戏、没有对接真实业务」：律师的案件信息早就躺在材料文件夹里（起诉状/判决书/受理通知书等高信号文书），且 AlphaBox（律师在用的网盘客户端）已把云端「资料库」同步到本地。需要「导入案件」——从已有案件材料文件夹自动解析案件信息，替代手填表单成为主要建案方式。

## 目标与边界

- Goal：Rust 三命令（`src-tauri/src/case_import/`）：`alphabox_sync_roots`（读 `~/.AlphaBoxNova/*/db/common_*.db/config_sqlite.db` 的 `folder_configs` 表列已同步库）、`scan_case_candidates`（列父目录一级子目录为候选）、`parse_case_folder`（解析 docx/txt/md，抽取案号/当事人/案由/法院/阶段，每字段带来源文件与置信度）。
- Goal：ImportCaseDialog 两入口（AlphaBox 同步库 / 本地文件夹）+ 解析确认页（预填字段旁灰字标来源，律师指定当事人我方/对方）+ 批量模式（父目录候选并发解析 ≤3，勾选导入，逐行改名）。
- Goal：导入写入 caseRegistry（`workspacePath` = 原目录，新增 `origin: "imported"`、`courtName`，类型兼容旧记录），默认不在原目录创建骨架子目录（确认页可选开启）。
- Boundary：`parse_case_folder` 纯解析、零写入，绝不修改目标目录。
- Boundary：本期不解析 PDF/扫描件与 .doc（旧版 Word），仅计数并在 notes 标注。
- Boundary：不猜当事人立场——解析到的角色+名称原样列出，由律师在确认界面指定我方/对方。
- Boundary：AlphaBox DB 缺失/表空返回空数组（未同步是常态，不是错误），空态文案引导去 AlphaBox 同步或直接选本地文件夹。
- Boundary：不重构既有代码；NewCaseDialog 保留为次入口。

## What Changes

- 新增 `src-tauri/src/case_import/`（mod/alphabox/scan/docx_text/parse），`lib.rs` 声明 + `command_registry.rs` 注册三命令。
- `caseRegistry.ts`：`CaseRecord`/`NewCaseInput` 增加可选 `origin`、`courtName`、`stage`（旧记录兼容，缺省 manual/null/intake）。
- 新增 `caseImport.ts`（命令封装 + 草稿→表单纯映射 + 有限并发 map）、`ImportCaseDialog.tsx`、`ImportConfirmForm.tsx`、`BatchImportTable.tsx`。
- `CaseHomePage.tsx`：新增「导入案件」主按钮（视觉权重高于新建），编排骨架可选创建、登记表写入与工作区打开。
- 无破坏性改动；不新增运行时依赖（rusqlite/zip/regex/encoding_rs 均已有）。

## Capabilities

### New Capabilities

- `case-import`：案件导入——AlphaBox 同步库发现、候选目录扫描、文件夹规则解析（案号/当事人/案由/法院/阶段，带来源与置信度）、导入确认与批量导入。

### Modified Capabilities

- `lawyer-mode-shell`：案件登记表字段扩展（`origin`/`courtName`/导入时带阶段），「我的案件」首页主入口改为导入。
