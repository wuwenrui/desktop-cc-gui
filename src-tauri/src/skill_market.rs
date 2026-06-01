//! Lawyer copilot: skill 市场客户端命令。
//!
//! 从 skill 托管平台下载某个公开 skill 的某个版本（zip）并解压到
//! `~/.claude/skills/<name>/`，同时在 `~/.claude/skills/.skillhub-installed.json`
//! 记录 `name -> {skill_id, version}` 以便前端做"已装 vs 最新版本"对比。
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

/// `.skillhub-installed.json` 中单条已装记录。
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub(crate) struct InstalledEntry {
    pub skill_id: i64,
    pub version: i64,
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

/// 把已装索引转换为前端友好的 `serde_json::Value`（对象：name -> {skill_id, version}）。
fn index_to_value(index: &BTreeMap<String, InstalledEntry>) -> Value {
    let mut map = Map::new();
    for (name, entry) in index {
        let mut obj = Map::new();
        obj.insert("skill_id".to_string(), Value::from(entry.skill_id));
        obj.insert("version".to_string(), Value::from(entry.version));
        map.insert(name.clone(), Value::Object(obj));
    }
    Value::Object(map)
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
    let next = upsert_installed(&index, &name, InstalledEntry { skill_id, version });
    write_installed_index(&skills_dir, &next)?;

    Ok(())
}

/// Tauri 命令：列出已装 skill 及版本。返回对象 `{name: {skill_id, version}}`。
#[tauri::command]
pub(crate) fn market_list_installed() -> Result<Value, String> {
    let skills_dir = skills_dir()?;
    let index = read_installed_index(&skills_dir)?;
    Ok(index_to_value(&index))
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

        let entry = InstalledEntry { skill_id: 7, version: 3 };
        let index = upsert_installed(&BTreeMap::new(), "劳动用工小助理", entry.clone());
        write_installed_index(&skills, &index).unwrap();

        let read = read_installed_index(&skills).unwrap();
        assert_eq!(read.get("劳动用工小助理"), Some(&entry));

        // upsert 同名覆盖版本。
        let updated = upsert_installed(
            &read,
            "劳动用工小助理",
            InstalledEntry { skill_id: 7, version: 5 },
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
            InstalledEntry { skill_id: 1, version: 2 },
        );
        let v = index_to_value(&index);
        assert_eq!(v["alpha"]["skill_id"], Value::from(1));
        assert_eq!(v["alpha"]["version"], Value::from(2));
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
}
