//! Lawyer copilot: 案件导入命令（lawyer-shell「导入案件」）。
//!
//! 从已有案件材料文件夹自动解析案件信息，替代手填表单：
//! - `alphabox_sync_roots`：读 AlphaBox 网盘客户端本地 SQLite 映射，列出已同步资料库。
//! - `scan_case_candidates`：列某目录的一级子目录作为候选案件。
//! - `parse_case_folder`：解析单个案件文件夹（docx/txt/md），抽取案号/当事人/案由/法院/阶段。
//!
//! 新增文件（fork-friendly）：不修改任何上游业务模块，仅 `lib.rs` 的 `mod`
//! 声明与 `command_registry.rs` 的 handler 列表引用本模块。
//!
//! 三个命令全部只读：绝不写入目标目录或 AlphaBox 数据库。

mod alphabox;
mod docx_text;
mod parse;
mod scan;

use std::path::PathBuf;

/// Tauri 命令：列出 AlphaBox 已同步到本地的资料库。
///
/// DB 不存在 / 表缺失 / 0 行均返回空数组（未同步是常态，不是错误）。
#[tauri::command]
pub(crate) async fn alphabox_sync_roots() -> Result<Vec<alphabox::SyncRoot>, String> {
    tauri::async_runtime::spawn_blocking(alphabox::collect_sync_roots)
        .await
        .map_err(|e| format!("读取 AlphaBox 同步库失败: {e}"))
}

/// Tauri 命令：列 `parent_dir` 的一级子目录作为候选案件（跳过隐藏目录与符号链接）。
#[tauri::command]
pub(crate) async fn scan_case_candidates(
    parent_dir: String,
) -> Result<Vec<scan::CandidateDir>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        scan::scan_candidates(&PathBuf::from(parent_dir))
    })
    .await
    .map_err(|e| format!("扫描候选案件失败: {e}"))?
}

/// Tauri 命令：解析单个案件文件夹，返回带来源标注的案件草稿。
///
/// 纯解析、零写入：本命令绝不修改目标目录。
#[tauri::command]
pub(crate) async fn parse_case_folder(dir: String) -> Result<parse::CaseDraft, String> {
    tauri::async_runtime::spawn_blocking(move || parse::parse_folder(&PathBuf::from(dir)))
        .await
        .map_err(|e| format!("解析案件文件夹失败: {e}"))?
}
