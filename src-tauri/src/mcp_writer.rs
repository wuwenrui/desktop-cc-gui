//! Write/merge MCP server entries into the user's `~/.claude.json` file.
//!
//! Used to register the court-crawler SSE MCP server while preserving any
//! existing `mcpServers` entries and other top-level keys (incremental upsert).

use serde_json::{json, Map, Value};
use std::path::Path;

/// Insert or update a single MCP server entry under `mcpServers` in the JSON
/// file at `path`. Existing top-level keys and other `mcpServers` entries are
/// preserved. The file (and its parent dir) is created if missing.
pub fn upsert_mcp_at(path: &Path, name: &str, url: &str) -> Result<(), String> {
    let mut root: Map<String, Value> = if path.exists() {
        serde_json::from_str(&std::fs::read_to_string(path).map_err(|e| e.to_string())?)
            .unwrap_or_default()
    } else {
        Map::new()
    };
    let servers = root
        .entry("mcpServers")
        .or_insert_with(|| Value::Object(Map::new()));
    if let Value::Object(m) = servers {
        m.insert(name.to_string(), json!({ "type": "sse", "url": url }));
    }
    if let Some(p) = path.parent() {
        std::fs::create_dir_all(p).ok();
    }
    std::fs::write(
        path,
        serde_json::to_string_pretty(&Value::Object(root)).unwrap(),
    )
    .map_err(|e| e.to_string())
}

/// Tauri command: register the `court-crawler` SSE MCP server (pointing at
/// `url`) into `~/.claude.json`.
#[tauri::command]
pub fn write_court_crawler_mcp(url: String) -> Result<(), String> {
    let home = dirs::home_dir().ok_or("no home")?;
    upsert_mcp_at(&home.join(".claude.json"), "court-crawler", &url)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::Value;
    use std::fs;
    use std::path::PathBuf;

    fn temp_file(tag: &str) -> PathBuf {
        let nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let dir = std::env::temp_dir().join(format!("mcp_writer_test_{tag}_{nanos}"));
        fs::create_dir_all(&dir).unwrap();
        dir.join(".claude.json")
    }

    #[test]
    fn writes_court_crawler_into_fresh_file() {
        let path = temp_file("fresh");
        assert!(!path.exists());

        upsert_mcp_at(&path, "court-crawler", "http://127.0.0.1:8765/sse").unwrap();

        let v: Value = serde_json::from_str(&fs::read_to_string(&path).unwrap()).unwrap();
        let entry = &v["mcpServers"]["court-crawler"];
        assert_eq!(entry["type"], "sse");
        assert_eq!(entry["url"], "http://127.0.0.1:8765/sse");

        fs::remove_dir_all(path.parent().unwrap()).ok();
    }

    #[test]
    fn preserves_existing_keys_and_servers_on_upsert() {
        let path = temp_file("merge");
        // Pre-existing file with another top-level key and another MCP server.
        let initial = serde_json::json!({
            "someTopLevel": "keep-me",
            "mcpServers": {
                "existing-server": { "type": "stdio", "command": "foo" }
            }
        });
        fs::write(&path, serde_json::to_string_pretty(&initial).unwrap()).unwrap();

        upsert_mcp_at(&path, "court-crawler", "http://localhost:9000/sse").unwrap();

        let v: Value = serde_json::from_str(&fs::read_to_string(&path).unwrap()).unwrap();
        // Unrelated top-level key preserved.
        assert_eq!(v["someTopLevel"], "keep-me");
        // Pre-existing server preserved.
        assert_eq!(v["mcpServers"]["existing-server"]["command"], "foo");
        // New server present and correct.
        assert_eq!(v["mcpServers"]["court-crawler"]["type"], "sse");
        assert_eq!(
            v["mcpServers"]["court-crawler"]["url"],
            "http://localhost:9000/sse"
        );

        fs::remove_dir_all(path.parent().unwrap()).ok();
    }

    #[test]
    fn updates_url_when_court_crawler_already_present() {
        let path = temp_file("update");
        upsert_mcp_at(&path, "court-crawler", "http://old/sse").unwrap();
        upsert_mcp_at(&path, "court-crawler", "http://new/sse").unwrap();

        let v: Value = serde_json::from_str(&fs::read_to_string(&path).unwrap()).unwrap();
        assert_eq!(v["mcpServers"]["court-crawler"]["url"], "http://new/sse");

        fs::remove_dir_all(path.parent().unwrap()).ok();
    }
}
