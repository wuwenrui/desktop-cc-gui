## 1. Rust 案件导入命令

- [x] 1.1 [P0][Dep:none][I: rusqlite/zip/regex/encoding_rs 既有依赖；`skill_market.rs` zip 范式][O: `src-tauri/src/case_import/alphabox.rs`（只读扫 `~/.AlphaBoxNova/*/db/common_*.db/config_sqlite.db` 的 folder_configs）][V: `cargo test case_import --lib` 含 DB 缺失/表缺失/空表用例] AlphaBox 同步库发现。
- [x] 1.2 [P0][Dep:none][O: `scan.rs`（一级子目录候选：fileCount≤500 递归/hasDocx/hasPdf/modifiedAt，跳隐藏与符号链接）][V: cargo test 含符号链接/隐藏/上限用例] 候选扫描。
- [x] 1.3 [P0][Dep:none][O: `docx_text.rs`（zip 取 word/document.xml，段落转行、实体解码）+ `parse.rs`（案号/当事人/案由/法院正则 + 阶段推断矩阵 + 来源/置信度）][V: cargo test 含内存 docx fixture、起诉状/判决书头部片段、干扰文本、阶段矩阵、零写入断言] 规则解析。
- [x] 1.4 [P0][Dep:1.1-1.3][O: `mod.rs` 三命令 + `lib.rs`/`command_registry.rs` 注册][V: `cargo check`] 命令接线。

## 2. 前端导入向导

- [x] 2.1 [P0][Dep:none][I: `caseRegistry.ts`][O: `CaseRecord`/`NewCaseInput` 增可选 origin/courtName/stage，兼容旧记录][V: `npx vitest run src/features/lawyer-shell/caseRegistry.test.ts` 含旧记录兼容用例] 登记表扩展。
- [x] 2.2 [P0][Dep:2.1][O: `caseImport.ts`（命令封装 + draftToImportForm/importFormToNewCaseInput/mapWithConcurrency）][V: `npx vitest run src/features/lawyer-shell/caseImport.test.ts`] 类型与纯映射。
- [x] 2.3 [P0][Dep:2.2][O: `ImportCaseDialog.tsx`（AlphaBox/本地两 Tab + 空态文案）+ `ImportConfirmForm.tsx`（来源灰字 + 当事人立场指定 + 骨架勾选默认关）+ `BatchImportTable.tsx`（并发≤3 逐行解析、勾选、改名）][V: `npx vitest run src/features/lawyer-shell/ImportCaseDialog.test.tsx`] 导入向导 UI。
- [x] 2.4 [P0][Dep:2.3][I: `CaseHomePage.tsx`][O: 「导入案件」主按钮（权重高于新建）+ 导入编排（可选骨架→写登记表→单个打开工作区/批量提示）][V: `npx vitest run src/features/lawyer-shell/CaseHomePage.test.tsx`] 首页接线。

## 3. 验证

- [x] 3.1 [P0][Dep:1-2][V: `npm run typecheck`、`npm run lint`、`npx vitest run src/features/lawyer-shell`、`cargo test case_import --lib`、`cargo check`] 静态 + 单元门禁。
- [ ] 3.2 [P1][Dep:3.1][V: 起 `npm run tauri:dev`：在装有 AlphaBox 且已同步库的机器上走通「同步库 → 候选 → 解析 → 确认导入 → 打开工作区」；无 AlphaBox 机器验证空态] 端到端手动验证（需真实材料与桌面 app，本变更内不可做）。
