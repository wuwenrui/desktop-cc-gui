//! AlphaBox（律师网盘客户端）本地同步映射读取。
//!
//! AlphaBox 把云端「资料库」同步到本地后，映射存在
//! `~/.AlphaBoxNova/<账号>/db/common_*.db/config_sqlite.db`
//! （注意 `common_*.db` 是目录，`config_sqlite.db` 在其下），
//! 表 `folder_configs`：`local_root_path` / `remote_root_path` / `folder_status`。
//!
//! 全部只读打开；DB 缺失 / 表缺失 / 空表都返回空集合（未同步是常态）。

use rusqlite::types::ValueRef;
use rusqlite::{Connection, OpenFlags};
use serde::Serialize;
use std::path::{Path, PathBuf};

/// 一个已同步到本地的 AlphaBox 资料库。
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SyncRoot {
    /// 本地根目录（`folder_configs.local_root_path`）
    pub local_root_path: String,
    /// 云端库名（`folder_configs.remote_root_path`）
    pub remote_name: String,
    /// 同步状态（`folder_configs.folder_status`，整型/文本原样转字符串）
    pub status: String,
}

/// 扫描本机所有 AlphaBox 账号的配置库，汇总同步根目录。
pub(crate) fn collect_sync_roots() -> Vec<SyncRoot> {
    let Some(home) = dirs::home_dir() else {
        return Vec::new();
    };
    let base = home.join(".AlphaBoxNova");
    find_config_dbs(&base)
        .iter()
        .flat_map(|db| read_sync_roots_from_db(db))
        .collect()
}

/// 在 `<base>/*/db/common_*/config_sqlite.db` 处查找配置库。
///
/// `common_*.db` 是目录而非文件；任何一层不存在都安静返回已找到的部分。
pub(crate) fn find_config_dbs(base: &Path) -> Vec<PathBuf> {
    let mut found = Vec::new();
    let Ok(accounts) = std::fs::read_dir(base) else {
        return found;
    };
    for account in accounts.flatten() {
        let db_dir = account.path().join("db");
        let Ok(entries) = std::fs::read_dir(&db_dir) else {
            continue;
        };
        for entry in entries.flatten() {
            if !entry
                .file_name()
                .to_string_lossy()
                .starts_with("common_")
            {
                continue;
            }
            let candidate = entry.path().join("config_sqlite.db");
            if candidate.is_file() {
                found.push(candidate);
            }
        }
    }
    found.sort();
    found
}

/// 只读打开一个配置库并读 `folder_configs`。
///
/// 打开失败 / 表缺失 / 查询失败一律返回空（不是错误，是常态之一）。
pub(crate) fn read_sync_roots_from_db(db_path: &Path) -> Vec<SyncRoot> {
    let Ok(conn) = Connection::open_with_flags(db_path, OpenFlags::SQLITE_OPEN_READ_ONLY)
    else {
        return Vec::new();
    };
    let Ok(mut stmt) = conn.prepare(
        "SELECT local_root_path, remote_root_path, folder_status FROM folder_configs",
    ) else {
        return Vec::new();
    };
    let Ok(rows) = stmt.query_map([], |row| {
        Ok(SyncRoot {
            local_root_path: row.get::<_, String>(0).unwrap_or_default(),
            remote_name: row.get::<_, String>(1).unwrap_or_default(),
            status: row
                .get_ref(2)
                .map(value_ref_to_string)
                .unwrap_or_default(),
        })
    }) else {
        return Vec::new();
    };
    rows.flatten()
        .filter(|root| !root.local_root_path.is_empty())
        .collect()
}

/// `folder_status` 类型未知（整型或文本都可能），原样转字符串。
fn value_ref_to_string(value: ValueRef<'_>) -> String {
    match value {
        ValueRef::Null => String::new(),
        ValueRef::Integer(i) => i.to_string(),
        ValueRef::Real(f) => f.to_string(),
        ValueRef::Text(t) => String::from_utf8_lossy(t).into_owned(),
        ValueRef::Blob(_) => String::new(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_dir(tag: &str) -> PathBuf {
        let nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let dir = std::env::temp_dir().join(format!("alphabox_test_{tag}_{nanos}"));
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn create_config_db(path: &Path, rows: &[(&str, &str, i64)]) {
        let conn = Connection::open(path).unwrap();
        conn.execute_batch(
            "CREATE TABLE folder_configs (
                local_root_path TEXT,
                remote_root_path TEXT,
                sync_mode INTEGER,
                folder_status INTEGER
            )",
        )
        .unwrap();
        for (local, remote, status) in rows {
            conn.execute(
                "INSERT INTO folder_configs (local_root_path, remote_root_path, sync_mode, folder_status)
                 VALUES (?1, ?2, 1, ?3)",
                rusqlite::params![local, remote, status],
            )
            .unwrap();
        }
    }

    #[test]
    fn reads_rows_from_config_db() {
        let base = temp_dir("rows");
        let db = base.join("config_sqlite.db");
        create_config_db(
            &db,
            &[
                ("/Users/a/案件库", "案件库", 2),
                ("/Users/a/合同库", "合同库", 0),
            ],
        );

        let roots = read_sync_roots_from_db(&db);
        assert_eq!(roots.len(), 2);
        assert_eq!(roots[0].local_root_path, "/Users/a/案件库");
        assert_eq!(roots[0].remote_name, "案件库");
        assert_eq!(roots[0].status, "2");

        std::fs::remove_dir_all(&base).ok();
    }

    #[test]
    fn missing_db_or_table_yields_empty() {
        let base = temp_dir("missing");
        // 文件不存在
        assert!(read_sync_roots_from_db(&base.join("nope.db")).is_empty());
        // 库存在但无 folder_configs 表
        let db = base.join("other.db");
        let conn = Connection::open(&db).unwrap();
        conn.execute_batch("CREATE TABLE misc (x TEXT)").unwrap();
        drop(conn);
        assert!(read_sync_roots_from_db(&db).is_empty());

        std::fs::remove_dir_all(&base).ok();
    }

    #[test]
    fn empty_table_yields_empty() {
        let base = temp_dir("empty");
        let db = base.join("config_sqlite.db");
        create_config_db(&db, &[]);
        assert!(read_sync_roots_from_db(&db).is_empty());
        std::fs::remove_dir_all(&base).ok();
    }

    #[test]
    fn finds_config_dbs_under_common_dot_db_dirs() {
        let base = temp_dir("layout");
        // 命中：<base>/account1/db/common_123.db/config_sqlite.db
        let hit_dir = base.join("account1").join("db").join("common_123.db");
        std::fs::create_dir_all(&hit_dir).unwrap();
        create_config_db(&hit_dir.join("config_sqlite.db"), &[("/x", "x", 1)]);
        // 不命中：目录名不带 common_ 前缀
        let miss_dir = base.join("account1").join("db").join("other_456.db");
        std::fs::create_dir_all(&miss_dir).unwrap();
        create_config_db(&miss_dir.join("config_sqlite.db"), &[("/y", "y", 1)]);
        // 不命中：common_ 目录下没有 config_sqlite.db
        std::fs::create_dir_all(base.join("account2").join("db").join("common_789.db"))
            .unwrap();

        let dbs = find_config_dbs(&base);
        assert_eq!(dbs, vec![hit_dir.join("config_sqlite.db")]);

        std::fs::remove_dir_all(&base).ok();
    }

    #[test]
    fn missing_base_dir_yields_empty() {
        let base = temp_dir("nobase");
        assert!(find_config_dbs(&base.join("not_there")).is_empty());
        std::fs::remove_dir_all(&base).ok();
    }
}
