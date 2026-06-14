//! Lawyer copilot: skill 市场客户端命令。
//!
//! 从 skill 托管平台下载某个公开 skill 的某个版本（zip）并解压到
//! `~/.claude/skills/<name>/`，同时在 `~/.claude/skills/.skillhub-installed.json`
//! 记录 `name -> {skill_id, version, installed_at}` 以便前端做"已装 vs 最新版本"对比。
//! 另提供本地结构查看命令（`market_skill_tree` / `market_skill_file`）。
//!
//! 新增文件（fork-friendly）：不修改任何上游业务模块。仅 `lib.rs` 的 `mod`
//! 声明与 `command_registry.rs` 的 handler 列表引用本模块。
//!
//! 安全：zip 解压做 zip-slip 防护（拒绝绝对路径 / 含 `..` 的条目），
//! 所有写入都被约束在目标目录内（写出前再做一次"规范化后仍在目标目录下"校验）。

use std::collections::BTreeMap;
use std::io::{Cursor, Read};
use std::path::{Component, Path, PathBuf};
use std::time::Duration;

use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};

/// 单 skill zip 下载上限（与后端 `max_zip_bytes` 对齐的客户端侧保护）。
const MAX_ZIP_BYTES: usize = 5 * 1024 * 1024;

/// 文本预览上限（512KB），超出在 UTF-8 字符边界截断并标记 truncated。
const MAX_PREVIEW_BYTES: usize = 512 * 1024;

/// `.skillhub-installed.json` 中单条已装记录。
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub(crate) struct InstalledEntry {
    pub skill_id: i64,
    pub version: i64,
    /// 首次安装时间（epoch 毫秒）。旧索引缺字段 → None，升级时不补造。
    #[serde(default)]
    pub installed_at: Option<u64>,
    /// 平台 display_name（侧栏展示用，缺失回落 name）。旧索引缺字段 → None。
    #[serde(default)]
    pub display_name: Option<String>,
}

/// skill 目录树中的一个条目（path 为相对 skill 根的 `/` 分隔路径）。
#[derive(Debug, Clone, PartialEq, Serialize)]
pub(crate) struct SkillTreeEntry {
    pub path: String,
    pub size: u64,
    pub is_dir: bool,
}

/// skill 内单个文本文件的预览内容。
#[derive(Debug, Clone, PartialEq, Serialize)]
pub(crate) struct SkillFileContent {
    pub path: String,
    pub content: String,
    pub size: u64,
    pub truncated: bool,
}

/// zip 条目不安全（zip-slip）时返回的错误类型。
#[derive(Debug, Clone, PartialEq)]
pub(crate) struct ZipUnsafeError(pub String);

impl std::fmt::Display for ZipUnsafeError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "unsafe zip entry: {}", self.0)
    }
}

/// 判断一个 zip 条目名是否安全（防 zip-slip）。
///
/// 拒绝：空名、绝对路径（`/` 或 `\` 开头、Windows 盘符）、含 `..` 的路径段、
/// 解析出带 `..`/根/前缀组件的相对路径。返回规范化后的相对 `PathBuf`。
fn safe_relative_path(name: &str) -> Result<PathBuf, ZipUnsafeError> {
    if name.is_empty() {
        return Err(ZipUnsafeError("empty entry name".to_string()));
    }
    if name.starts_with('/') || name.starts_with('\\') {
        return Err(ZipUnsafeError(format!("absolute path: {name}")));
    }
    // Windows 盘符前缀，如 `C:\` / `C:/`。
    let bytes = name.as_bytes();
    if bytes.len() >= 2 && bytes[1] == b':' && bytes[0].is_ascii_alphabetic() {
        return Err(ZipUnsafeError(format!("drive-prefixed path: {name}")));
    }

    let normalized = name.replace('\\', "/");
    let mut rel = PathBuf::new();
    for component in Path::new(&normalized).components() {
        match component {
            Component::Normal(part) => rel.push(part),
            // `.` 直接跳过；其余（`..` / 根 / 前缀）一律拒绝。
            Component::CurDir => {}
            Component::ParentDir => {
                return Err(ZipUnsafeError(format!("path traversal: {name}")));
            }
            Component::RootDir | Component::Prefix(_) => {
                return Err(ZipUnsafeError(format!("absolute path: {name}")));
            }
        }
    }
    if rel.as_os_str().is_empty() {
        return Err(ZipUnsafeError(format!("resolves to empty path: {name}")));
    }
    Ok(rel)
}

/// 把 zip 字节解压到 `dest_dir`（应为某个 skill 的目标目录）。
///
/// 每个条目都先经 `safe_relative_path` 防 zip-slip，再二次校验最终路径仍位于
/// `dest_dir` 之下，目录条目只建目录、文件条目写内容。返回写出的文件数。
fn extract_zip_into(zip_bytes: &[u8], dest_dir: &Path) -> Result<usize, String> {
    let reader = Cursor::new(zip_bytes);
    let mut archive =
        zip::ZipArchive::new(reader).map_err(|e| format!("打开 zip 失败: {e}"))?;

    std::fs::create_dir_all(dest_dir).map_err(|e| format!("创建目标目录失败: {e}"))?;

    let mut files_written = 0usize;
    for i in 0..archive.len() {
        let mut entry = archive
            .by_index(i)
            .map_err(|e| format!("读取 zip 条目失败: {e}"))?;
        let raw_name = entry.name().to_string();

        let rel = safe_relative_path(&raw_name).map_err(|e| e.to_string())?;
        let out_path = dest_dir.join(&rel);

        // 二次防御：规范化拼接后仍必须在 dest_dir 之下。
        if !out_path.starts_with(dest_dir) {
            return Err(format!("zip entry escapes target dir: {raw_name}"));
        }

        if entry.is_dir() {
            std::fs::create_dir_all(&out_path)
                .map_err(|e| format!("创建目录失败 {}: {e}", out_path.display()))?;
            continue;
        }

        if let Some(parent) = out_path.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|e| format!("创建父目录失败 {}: {e}", parent.display()))?;
        }

        let mut buf = Vec::new();
        entry
            .read_to_end(&mut buf)
            .map_err(|e| format!("读取 zip 条目内容失败: {e}"))?;
        std::fs::write(&out_path, &buf)
            .map_err(|e| format!("写入文件失败 {}: {e}", out_path.display()))?;
        files_written += 1;
    }
    Ok(files_written)
}

fn skills_dir() -> Result<PathBuf, String> {
    let home = dirs::home_dir().ok_or_else(|| "无法确定 home 目录".to_string())?;
    Ok(home.join(".claude").join("skills"))
}

fn installed_index_path(skills_dir: &Path) -> PathBuf {
    skills_dir.join(".skillhub-installed.json")
}

/// 读取已装索引为 `name -> InstalledEntry` 的有序映射。文件不存在视为空。
fn read_installed_index(skills_dir: &Path) -> Result<BTreeMap<String, InstalledEntry>, String> {
    let path = installed_index_path(skills_dir);
    if !path.exists() {
        return Ok(BTreeMap::new());
    }
    let content = std::fs::read_to_string(&path)
        .map_err(|e| format!("读取已装索引失败: {e}"))?;
    if content.trim().is_empty() {
        return Ok(BTreeMap::new());
    }
    let parsed: BTreeMap<String, InstalledEntry> =
        serde_json::from_str(&content).map_err(|e| format!("解析已装索引失败: {e}"))?;
    Ok(parsed)
}

/// 写回已装索引（覆盖写）。
fn write_installed_index(
    skills_dir: &Path,
    index: &BTreeMap<String, InstalledEntry>,
) -> Result<(), String> {
    std::fs::create_dir_all(skills_dir).map_err(|e| format!("创建 skills 目录失败: {e}"))?;
    let json = serde_json::to_string_pretty(index)
        .map_err(|e| format!("序列化已装索引失败: {e}"))?;
    std::fs::write(installed_index_path(skills_dir), json)
        .map_err(|e| format!("写入已装索引失败: {e}"))
}

/// 把一条安装记录 upsert 进索引并返回新映射（不可变风格：返回新副本）。
fn upsert_installed(
    index: &BTreeMap<String, InstalledEntry>,
    name: &str,
    entry: InstalledEntry,
) -> BTreeMap<String, InstalledEntry> {
    let mut next = index.clone();
    next.insert(name.to_string(), entry);
    next
}

/// 当前 epoch 毫秒。
fn now_epoch_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

/// 决定 upsert 时的 installed_at：新条目填 now；已有条目（升级）保留原值，含 None。
fn resolve_installed_at(
    index: &BTreeMap<String, InstalledEntry>,
    name: &str,
    now_ms: u64,
) -> Option<u64> {
    match index.get(name) {
        Some(existing) => existing.installed_at,
        None => Some(now_ms),
    }
}

/// 决定 upsert 时的 display_name：本次提供非空值 → 覆盖（跟随平台改名）；
/// 未提供 → 保留已有值（旧条目可能为 None）。
fn resolve_display_name(
    index: &BTreeMap<String, InstalledEntry>,
    name: &str,
    incoming: Option<String>,
) -> Option<String> {
    let incoming = incoming.filter(|s| !s.trim().is_empty());
    match incoming {
        Some(value) => Some(value),
        None => index.get(name).and_then(|e| e.display_name.clone()),
    }
}

/// 把已装索引转换为前端友好的 `serde_json::Value`
/// （对象：name -> {skill_id, version, installed_at}，installed_at 缺失为 null）。
fn index_to_value(index: &BTreeMap<String, InstalledEntry>) -> Value {
    let mut map = Map::new();
    for (name, entry) in index {
        let mut obj = Map::new();
        obj.insert("skill_id".to_string(), Value::from(entry.skill_id));
        obj.insert("version".to_string(), Value::from(entry.version));
        obj.insert(
            "installed_at".to_string(),
            entry.installed_at.map(Value::from).unwrap_or(Value::Null),
        );
        obj.insert(
            "display_name".to_string(),
            entry
                .display_name
                .clone()
                .map(Value::from)
                .unwrap_or(Value::Null),
        );
        map.insert(name.clone(), Value::Object(obj));
    }
    Value::Object(map)
}

/// 校验 skill 目录名：非空、不含 `/` `\` `..`、非绝对路径/盘符（单层目录名）。
fn validate_skill_name(name: &str) -> Result<(), String> {
    if name.trim().is_empty() {
        return Err("skill 名称不能为空".to_string());
    }
    if name.contains('/') || name.contains('\\') || name.contains("..") {
        return Err(format!("非法 skill 名称: {name}"));
    }
    safe_relative_path(name).map_err(|e| e.to_string())?;
    Ok(())
}

/// 相对路径 → `/` 分隔字符串（Windows 下把 `\` 归一为 `/`）。
fn rel_path_to_slash(rel: &Path) -> String {
    rel.to_string_lossy().replace('\\', "/")
}

/// 递归收集 `dir` 下所有条目（相对 `root`），跳过 symlink（与 skills.rs 发现逻辑同口径）。
fn collect_tree(root: &Path, dir: &Path, out: &mut Vec<SkillTreeEntry>) -> Result<(), String> {
    let entries =
        std::fs::read_dir(dir).map_err(|e| format!("读取目录失败 {}: {e}", dir.display()))?;
    for entry in entries {
        let entry = entry.map_err(|e| format!("读取目录条目失败: {e}"))?;
        let path = entry.path();
        let Ok(meta) = std::fs::symlink_metadata(&path) else {
            continue;
        };
        if meta.file_type().is_symlink() {
            continue;
        }
        let Ok(rel) = path.strip_prefix(root) else {
            continue;
        };
        let rel_str = rel_path_to_slash(rel);
        if rel_str.is_empty() {
            continue;
        }
        if meta.is_dir() {
            out.push(SkillTreeEntry { path: rel_str, size: 0, is_dir: true });
            collect_tree(root, &path, out)?;
        } else if meta.is_file() {
            out.push(SkillTreeEntry { path: rel_str, size: meta.len(), is_dir: false });
        }
    }
    Ok(())
}

/// 列出 `skills_dir/<name>/` 的全量目录树（按 path 排序）。接 base_dir 便于测试。
fn skill_tree_core(skills_dir: &Path, name: &str) -> Result<Vec<SkillTreeEntry>, String> {
    validate_skill_name(name)?;
    let root = skills_dir.join(name);
    if let Ok(meta) = std::fs::symlink_metadata(&root) {
        if meta.file_type().is_symlink() || !meta.is_dir() {
            return Err(format!("skill 目录不存在: {name}"));
        }

        let mut entries = Vec::new();
        collect_tree(&root, &root, &mut entries)?;
        entries.sort_by(|a, b| a.path.cmp(&b.path));
        return Ok(entries);
    }

    let single_file = skills_dir.join(format!("{name}.md"));
    let meta = std::fs::symlink_metadata(&single_file)
        .map_err(|_| format!("skill 目录不存在: {name}"))?;
    if meta.file_type().is_symlink() || !meta.is_file() {
        return Err(format!("skill 目录不存在: {name}"));
    }
    Ok(vec![SkillTreeEntry {
        path: "SKILL.md".to_string(),
        size: meta.len(),
        is_dir: false,
    }])
}

fn read_skill_text_file(path: &Path, display_path: String) -> Result<SkillFileContent, String> {
    let meta = std::fs::metadata(path).map_err(|e| format!("读取文件信息失败: {e}"))?;
    if !meta.is_file() {
        return Err(format!("不是文件: {display_path}"));
    }

    let bytes = std::fs::read(path).map_err(|e| format!("读取文件失败: {e}"))?;
    let text = std::str::from_utf8(&bytes)
        .map_err(|_| "二进制文件不支持预览 (binary file not previewable)".to_string())?;

    if bytes.len() <= MAX_PREVIEW_BYTES {
        return Ok(SkillFileContent {
            path: display_path,
            content: text.to_string(),
            size: meta.len(),
            truncated: false,
        });
    }

    // 在 UTF-8 字符边界截断，保证 content 始终是合法 UTF-8。
    let mut cut = MAX_PREVIEW_BYTES;
    while cut > 0 && !text.is_char_boundary(cut) {
        cut -= 1;
    }
    Ok(SkillFileContent {
        path: display_path,
        content: text[..cut].to_string(),
        size: meta.len(),
        truncated: true,
    })
}

/// 读取 `skills_dir/<name>/<rel_path>` 文本内容。接 base_dir 便于测试。
///
/// 安全：`rel_path` 过 `safe_relative_path`，且 canonicalize 后必须仍位于
/// skill 根目录之下（双保险，symlink 逃逸也会被拦）。
/// 非 UTF-8 → Err；超 512KB → 在字符边界截断并置 truncated。
fn skill_file_core(
    skills_dir: &Path,
    name: &str,
    rel_path: &str,
) -> Result<SkillFileContent, String> {
    validate_skill_name(name)?;
    let rel = safe_relative_path(rel_path).map_err(|e| e.to_string())?;
    let root = skills_dir.join(name);

    if let Ok(root_meta) = std::fs::symlink_metadata(&root) {
        if root_meta.file_type().is_symlink() || !root_meta.is_dir() {
            return Err(format!("skill 目录不存在: {name}"));
        }
        let canon_root = root
            .canonicalize()
            .map_err(|_| format!("skill 目录不存在: {name}"))?;
        let canon_file = root
            .join(&rel)
            .canonicalize()
            .map_err(|_| format!("文件不存在: {rel_path}"))?;
        if !canon_file.starts_with(&canon_root) {
            return Err(format!("路径越出 skill 目录: {rel_path}"));
        }
        return read_skill_text_file(&canon_file, rel_path_to_slash(&rel));
    }

    if rel_path_to_slash(&rel) != "SKILL.md" {
        return Err(format!("文件不存在: {rel_path}"));
    }

    let single_file = skills_dir.join(format!("{name}.md"));
    let meta = std::fs::symlink_metadata(&single_file)
        .map_err(|_| format!("skill 目录不存在: {name}"))?;
    if meta.file_type().is_symlink() || !meta.is_file() {
        return Err(format!("skill 目录不存在: {name}"));
    }
    let canon_skills_dir = skills_dir
        .canonicalize()
        .map_err(|_| format!("skill 目录不存在: {name}"))?;
    let canon_file = single_file
        .canonicalize()
        .map_err(|_| format!("文件不存在: {rel_path}"))?;
    if !canon_file.starts_with(&canon_skills_dir) {
        return Err(format!("路径越出 skill 目录: {rel_path}"));
    }
    read_skill_text_file(&canon_file, "SKILL.md".to_string())
}

fn http_client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(10))
        .timeout(Duration::from_secs(30))
        .build()
        .map_err(|e| format!("创建 HTTP 客户端失败: {e}"))
}

/// Tauri 命令：下载并安装/更新一个 skill。
///
/// - `base_url`：平台基址（如 `http://localhost:8000`），运行时可配。
/// - `skill_id` / `version`：要安装的 skill 及版本。
/// - `name`：本地目录名（`~/.claude/skills/<name>/`），与平台 `Skill.name` 对齐。
///
/// 流程：GET `{base_url}/api/skills/{skill_id}/versions/{version}/download` 拿 zip
/// → 防 zip-slip 解压到 `~/.claude/skills/<name>/` → 记录已装版本。
#[tauri::command]
pub(crate) async fn market_add_skill(
    base_url: String,
    skill_id: i64,
    version: i64,
    name: String,
    display_name: Option<String>,
) -> Result<(), String> {
    // 本地目录名也走 zip-slip 同款校验，避免 `name` 含 `..` / 绝对路径。
    let safe_name = safe_relative_path(&name).map_err(|e| e.to_string())?;
    let base = base_url.trim_end_matches('/');
    let url = format!("{base}/api/skills/{skill_id}/versions/{version}/download");

    let client = http_client()?;
    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("下载 skill 失败: {e}"))?;
    let response = response
        .error_for_status()
        .map_err(|e| format!("下载接口返回错误状态: {e}"))?;

    let bytes = response
        .bytes()
        .await
        .map_err(|e| format!("读取下载内容失败: {e}"))?;
    if bytes.len() > MAX_ZIP_BYTES {
        return Err(format!(
            "skill zip 超过大小上限 ({} > {} bytes)",
            bytes.len(),
            MAX_ZIP_BYTES
        ));
    }

    let skills_dir = skills_dir()?;
    let dest_dir = skills_dir.join(&safe_name);
    extract_zip_into(&bytes, &dest_dir)?;

    let index = read_installed_index(&skills_dir)?;
    // 新装 → 记录当前时间戳；升级 → 保留首次安装时间（旧条目无字段则保持 None）。
    let installed_at = resolve_installed_at(&index, &name, now_epoch_ms());
    let display_name = resolve_display_name(&index, &name, display_name);
    let next = upsert_installed(
        &index,
        &name,
        InstalledEntry { skill_id, version, installed_at, display_name },
    );
    write_installed_index(&skills_dir, &next)?;

    Ok(())
}

/// Tauri 命令：列出已装 skill 及版本。
/// 返回对象 `{name: {skill_id, version, installed_at}}`（installed_at 可为 null）。
#[tauri::command]
pub(crate) fn market_list_installed() -> Result<Value, String> {
    let skills_dir = skills_dir()?;
    let index = read_installed_index(&skills_dir)?;
    Ok(index_to_value(&index))
}

/// Tauri 命令：列出本地已装 skill `~/.claude/skills/<name>/` 的全量目录树。
///
/// 返回相对 skill 根的 `/` 分隔路径，按 path 排序；目录条目 size=0、is_dir=true。
#[tauri::command]
pub(crate) fn market_skill_tree(name: String) -> Result<Vec<SkillTreeEntry>, String> {
    let skills_dir = skills_dir()?;
    skill_tree_core(&skills_dir, &name)
}

/// Tauri 命令：读取本地已装 skill 内单个文本文件用于预览。
///
/// 非 UTF-8 文件报错；超 512KB 在字符边界截断（truncated=true）。
#[tauri::command]
pub(crate) fn market_skill_file(
    name: String,
    rel_path: String,
) -> Result<SkillFileContent, String> {
    let skills_dir = skills_dir()?;
    skill_file_core(&skills_dir, &name, &rel_path)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use std::path::PathBuf;

    fn temp_dir(tag: &str) -> PathBuf {
        let nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let dir = std::env::temp_dir().join(format!("skill_market_test_{tag}_{nanos}"));
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    /// 构造一个含给定 (entry_name, contents) 的内存 zip。
    fn make_zip(entries: &[(&str, &[u8])]) -> Vec<u8> {
        let mut buf = Vec::new();
        {
            let mut w = zip::ZipWriter::new(Cursor::new(&mut buf));
            let opts: zip::write::FileOptions<()> = zip::write::FileOptions::default();
            for (name, data) in entries {
                w.start_file(*name, opts).unwrap();
                w.write_all(data).unwrap();
            }
            w.finish().unwrap();
        }
        buf
    }

    // ---- safe_relative_path / zip-slip 防护 ----

    #[test]
    fn rejects_parent_dir_traversal() {
        assert!(safe_relative_path("../evil.md").is_err());
        assert!(safe_relative_path("a/../../evil.md").is_err());
        assert!(safe_relative_path("ok/../../../etc/passwd").is_err());
    }

    #[test]
    fn rejects_absolute_and_drive_paths() {
        assert!(safe_relative_path("/etc/passwd").is_err());
        assert!(safe_relative_path("\\windows\\system32").is_err());
        assert!(safe_relative_path("C:\\windows\\x.md").is_err());
        assert!(safe_relative_path("D:/x.md").is_err());
    }

    #[test]
    fn rejects_empty() {
        assert!(safe_relative_path("").is_err());
        assert!(safe_relative_path(".").is_err());
    }

    #[test]
    fn accepts_normal_nested_paths() {
        assert_eq!(
            safe_relative_path("SKILL.md").unwrap(),
            PathBuf::from("SKILL.md")
        );
        assert_eq!(
            safe_relative_path("sub/dir/file.md").unwrap(),
            PathBuf::from("sub").join("dir").join("file.md")
        );
        // 内嵌的 `.` 段被规范化掉。
        assert_eq!(
            safe_relative_path("./a/./b.md").unwrap(),
            PathBuf::from("a").join("b.md")
        );
    }

    #[test]
    fn extract_rejects_zip_slip_entry() {
        let base = temp_dir("slip");
        let dest = base.join("skills").join("evil");
        let zip = make_zip(&[("../escape.md", b"pwned")]);

        let err = extract_zip_into(&zip, &dest).unwrap_err();
        assert!(err.contains("traversal") || err.contains("unsafe"), "got: {err}");
        // 逃逸文件绝不能被写到目标目录之外。
        assert!(!base.join("skills").join("escape.md").exists());
        assert!(!base.join("escape.md").exists());

        std::fs::remove_dir_all(&base).ok();
    }

    #[test]
    fn extract_writes_single_and_nested_files() {
        let base = temp_dir("ok");
        let dest = base.join("my-skill");
        let zip = make_zip(&[
            ("SKILL.md", b"# skill body"),
            ("refs/extra.md", b"nested ref"),
        ]);

        let n = extract_zip_into(&zip, &dest).unwrap();
        assert_eq!(n, 2);
        assert_eq!(
            std::fs::read_to_string(dest.join("SKILL.md")).unwrap(),
            "# skill body"
        );
        assert_eq!(
            std::fs::read_to_string(dest.join("refs").join("extra.md")).unwrap(),
            "nested ref"
        );

        std::fs::remove_dir_all(&base).ok();
    }

    // ---- installed index 读写 ----

    #[test]
    fn installed_index_roundtrip() {
        let base = temp_dir("index");
        let skills = base.join("skills");

        // 不存在 → 空。
        assert!(read_installed_index(&skills).unwrap().is_empty());

        let entry = InstalledEntry { skill_id: 7, version: 3, installed_at: Some(1718000000000), display_name: None };
        let index = upsert_installed(&BTreeMap::new(), "劳动用工小助理", entry.clone());
        write_installed_index(&skills, &index).unwrap();

        let read = read_installed_index(&skills).unwrap();
        assert_eq!(read.get("劳动用工小助理"), Some(&entry));

        // upsert 同名覆盖版本。
        let updated = upsert_installed(
            &read,
            "劳动用工小助理",
            InstalledEntry { skill_id: 7, version: 5, installed_at: Some(1718000000000), display_name: None },
        );
        write_installed_index(&skills, &updated).unwrap();
        let read2 = read_installed_index(&skills).unwrap();
        assert_eq!(read2.get("劳动用工小助理").unwrap().version, 5);

        std::fs::remove_dir_all(&base).ok();
    }

    #[test]
    fn index_to_value_shape() {
        let mut index = BTreeMap::new();
        index.insert(
            "alpha".to_string(),
            InstalledEntry { skill_id: 1, version: 2, installed_at: None, display_name: None },
        );
        let v = index_to_value(&index);
        assert_eq!(v["alpha"]["skill_id"], Value::from(1));
        assert_eq!(v["alpha"]["version"], Value::from(2));
        assert_eq!(v["alpha"]["display_name"], Value::Null);
    }

    #[test]
    fn resolve_display_name_writes_overrides_and_preserves() {
        let mut index = BTreeMap::new();
        // 新装：写入本次提供的展示名。
        assert_eq!(
            resolve_display_name(&index, "civil", Some("民商事诉讼大师".to_string())),
            Some("民商事诉讼大师".to_string()),
        );
        // 新装但未提供 → None。
        assert_eq!(resolve_display_name(&index, "civil", None), None);
        // 空白串视为未提供。
        assert_eq!(resolve_display_name(&index, "civil", Some("  ".to_string())), None);

        index.insert(
            "civil".to_string(),
            InstalledEntry {
                skill_id: 1,
                version: 1,
                installed_at: Some(1),
                display_name: Some("旧名".to_string()),
            },
        );
        // 升级提供新名 → 覆盖（跟随平台改名）。
        assert_eq!(
            resolve_display_name(&index, "civil", Some("新名".to_string())),
            Some("新名".to_string()),
        );
        // 升级未提供 → 保留旧值。
        assert_eq!(resolve_display_name(&index, "civil", None), Some("旧名".to_string()));
    }

    #[test]
    fn installed_entry_legacy_json_without_display_name_deserializes() {
        let legacy = r#"{"civil": {"skill_id": 1, "version": 2, "installed_at": 100}}"#;
        let parsed: BTreeMap<String, InstalledEntry> = serde_json::from_str(legacy).unwrap();
        let entry = parsed.get("civil").unwrap();
        assert_eq!(entry.display_name, None);
        assert_eq!(entry.installed_at, Some(100));
    }

    #[test]
    fn read_installed_index_treats_empty_file_as_empty() {
        let base = temp_dir("emptyfile");
        let skills = base.join("skills");
        std::fs::create_dir_all(&skills).unwrap();
        std::fs::write(installed_index_path(&skills), "   ").unwrap();
        assert!(read_installed_index(&skills).unwrap().is_empty());
        std::fs::remove_dir_all(&base).ok();
    }

    // ---- installed_at 字段 ----

    #[test]
    fn new_install_gets_current_installed_at() {
        let index: BTreeMap<String, InstalledEntry> = BTreeMap::new();
        assert_eq!(resolve_installed_at(&index, "fresh", 1718000000123), Some(1718000000123));
    }

    #[test]
    fn upgrade_preserves_existing_installed_at() {
        let mut index = BTreeMap::new();
        index.insert(
            "kept".to_string(),
            InstalledEntry { skill_id: 1, version: 1, installed_at: Some(111), display_name: None },
        );
        index.insert(
            "legacy".to_string(),
            InstalledEntry { skill_id: 2, version: 1, installed_at: None, display_name: None },
        );
        // 已有时间戳 → 原样保留，不被 now 覆盖。
        assert_eq!(resolve_installed_at(&index, "kept", 999_999), Some(111));
        // 旧条目无时间戳 → 保持 None，不补造。
        assert_eq!(resolve_installed_at(&index, "legacy", 999_999), None);
    }

    #[test]
    fn legacy_index_without_installed_at_deserializes_as_none() {
        let base = temp_dir("legacyidx");
        let skills = base.join("skills");
        std::fs::create_dir_all(&skills).unwrap();
        std::fs::write(
            installed_index_path(&skills),
            r#"{"old-skill": {"skill_id": 7, "version": 3}}"#,
        )
        .unwrap();

        let read = read_installed_index(&skills).unwrap();
        let entry = read.get("old-skill").unwrap();
        assert_eq!(entry.skill_id, 7);
        assert_eq!(entry.version, 3);
        assert_eq!(entry.installed_at, None);

        std::fs::remove_dir_all(&base).ok();
    }

    #[test]
    fn index_to_value_exposes_installed_at() {
        let mut index = BTreeMap::new();
        index.insert(
            "with-ts".to_string(),
            InstalledEntry { skill_id: 1, version: 2, installed_at: Some(123), display_name: None },
        );
        index.insert(
            "without-ts".to_string(),
            InstalledEntry { skill_id: 3, version: 4, installed_at: None, display_name: None },
        );
        let v = index_to_value(&index);
        assert_eq!(v["with-ts"]["installed_at"], Value::from(123u64));
        assert_eq!(v["without-ts"]["installed_at"], Value::Null);
    }

    // ---- market_skill_tree ----

    /// 构造一个多层 skill 目录树供 tree/file 测试使用。
    fn make_skill_dir(tag: &str) -> (PathBuf, PathBuf) {
        let base = temp_dir(tag);
        let skills = base.join("skills");
        let root = skills.join("demo-skill");
        std::fs::create_dir_all(root.join("sub-skills")).unwrap();
        std::fs::create_dir_all(root.join("refs")).unwrap();
        std::fs::write(root.join("SKILL.md"), "# demo body").unwrap();
        std::fs::write(root.join("sub-skills").join("01_draft_SKILL.md"), "draft").unwrap();
        std::fs::write(root.join("refs").join("a.md"), "ref a").unwrap();
        (base, skills)
    }

    fn make_single_file_skill(tag: &str) -> (PathBuf, PathBuf) {
        let base = temp_dir(tag);
        let skills = base.join("skills");
        std::fs::create_dir_all(&skills).unwrap();
        std::fs::write(skills.join("制作PPT.md"), "# ppt body").unwrap();
        (base, skills)
    }

    #[test]
    fn skill_tree_lists_nested_entries_sorted() {
        let (base, skills) = make_skill_dir("tree");

        let entries = skill_tree_core(&skills, "demo-skill").unwrap();
        let paths: Vec<&str> = entries.iter().map(|e| e.path.as_str()).collect();
        assert_eq!(
            paths,
            vec![
                "SKILL.md",
                "refs",
                "refs/a.md",
                "sub-skills",
                "sub-skills/01_draft_SKILL.md",
            ]
        );

        let skill_md = entries.iter().find(|e| e.path == "SKILL.md").unwrap();
        assert!(!skill_md.is_dir);
        assert_eq!(skill_md.size, "# demo body".len() as u64);

        let refs_dir = entries.iter().find(|e| e.path == "refs").unwrap();
        assert!(refs_dir.is_dir);
        assert_eq!(refs_dir.size, 0);

        std::fs::remove_dir_all(&base).ok();
    }

    #[test]
    fn skill_tree_rejects_bad_names() {
        let (base, skills) = make_skill_dir("treebad");
        assert!(skill_tree_core(&skills, "").is_err());
        assert!(skill_tree_core(&skills, "..").is_err());
        assert!(skill_tree_core(&skills, "../demo-skill").is_err());
        assert!(skill_tree_core(&skills, "a/b").is_err());
        assert!(skill_tree_core(&skills, "a\\b").is_err());
        assert!(skill_tree_core(&skills, "/etc").is_err());
        std::fs::remove_dir_all(&base).ok();
    }

    #[test]
    fn skill_tree_missing_dir_errors() {
        let (base, skills) = make_skill_dir("treemiss");
        assert!(skill_tree_core(&skills, "no-such-skill").is_err());
        std::fs::remove_dir_all(&base).ok();
    }

    #[test]
    fn skill_tree_supports_top_level_md_skill() {
        let (base, skills) = make_single_file_skill("treesingle");

        let entries = skill_tree_core(&skills, "制作PPT").unwrap();
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].path, "SKILL.md");
        assert_eq!(entries[0].size, "# ppt body".len() as u64);
        assert!(!entries[0].is_dir);

        std::fs::remove_dir_all(&base).ok();
    }

    #[cfg(unix)]
    #[test]
    fn skill_tree_skips_symlinks() {
        let (base, skills) = make_skill_dir("treelink");
        let outside = base.join("outside.md");
        std::fs::write(&outside, "outside").unwrap();
        std::os::unix::fs::symlink(&outside, skills.join("demo-skill").join("link.md")).unwrap();

        let entries = skill_tree_core(&skills, "demo-skill").unwrap();
        assert!(entries.iter().all(|e| e.path != "link.md"));

        std::fs::remove_dir_all(&base).ok();
    }

    // ---- market_skill_file ----

    #[test]
    fn skill_file_reads_content() {
        let (base, skills) = make_skill_dir("fileok");

        let got = skill_file_core(&skills, "demo-skill", "refs/a.md").unwrap();
        assert_eq!(got.path, "refs/a.md");
        assert_eq!(got.content, "ref a");
        assert_eq!(got.size, "ref a".len() as u64);
        assert!(!got.truncated);

        std::fs::remove_dir_all(&base).ok();
    }

    #[test]
    fn skill_file_reads_top_level_md_skill_as_skill_md() {
        let (base, skills) = make_single_file_skill("filesingle");

        let got = skill_file_core(&skills, "制作PPT", "SKILL.md").unwrap();
        assert_eq!(got.path, "SKILL.md");
        assert_eq!(got.content, "# ppt body");
        assert_eq!(got.size, "# ppt body".len() as u64);
        assert!(!got.truncated);

        std::fs::remove_dir_all(&base).ok();
    }

    #[test]
    fn skill_file_rejects_non_skill_md_path_for_top_level_skill() {
        let (base, skills) = make_single_file_skill("filesinglebad");

        assert!(skill_file_core(&skills, "制作PPT", "refs/a.md").is_err());

        std::fs::remove_dir_all(&base).ok();
    }

    #[test]
    fn skill_file_rejects_traversal_escape() {
        let (base, skills) = make_skill_dir("fileesc");
        std::fs::write(skills.join("secret.md"), "secret").unwrap();

        assert!(skill_file_core(&skills, "demo-skill", "../secret.md").is_err());
        assert!(skill_file_core(&skills, "demo-skill", "/etc/passwd").is_err());
        assert!(skill_file_core(&skills, "../demo-skill", "SKILL.md").is_err());

        std::fs::remove_dir_all(&base).ok();
    }

    #[test]
    fn skill_file_truncates_large_text_on_char_boundary() {
        let (base, skills) = make_skill_dir("filebig");
        // "你" 为 3 字节；175000 个 = 525000 字节 > 524288，且 524288 不在字符边界上。
        let big = "你".repeat(175_000);
        std::fs::write(skills.join("demo-skill").join("big.md"), &big).unwrap();

        let got = skill_file_core(&skills, "demo-skill", "big.md").unwrap();
        assert!(got.truncated);
        assert_eq!(got.size, 525_000);
        assert!(got.content.len() <= 524_288, "content len = {}", got.content.len());
        // 截断点必须落在字符边界（524288 % 3 == 2 → 回退到 524286）。
        assert_eq!(got.content.len(), 524_286);
        assert!(got.content.chars().all(|c| c == '你'));

        std::fs::remove_dir_all(&base).ok();
    }

    #[test]
    fn skill_file_rejects_binary_content() {
        let (base, skills) = make_skill_dir("filebin");
        std::fs::write(
            skills.join("demo-skill").join("blob.bin"),
            [0x48u8, 0x49, 0xFF, 0xFE, 0x00],
        )
        .unwrap();

        let err = skill_file_core(&skills, "demo-skill", "blob.bin").unwrap_err();
        assert!(err.contains("binary") || err.contains("二进制"), "got: {err}");

        std::fs::remove_dir_all(&base).ok();
    }
}
