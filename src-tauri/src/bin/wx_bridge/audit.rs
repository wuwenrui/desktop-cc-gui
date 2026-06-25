//! Append-only audit trail (R-Audit). Records who/when/which-method/which-
//! workspace/decision — never the message body or any secret. Bodies are
//! referenced only by a short hash so the log is traceable but not disclosive.

use std::fs::OpenOptions;
use std::io::Write;
use std::sync::Mutex;

/// One audit record. No message body, no token.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AuditEntry {
    pub ts_secs: i64,
    pub wxid: String,
    pub method: String,
    pub workspace: String,
    pub decision: String,
    /// Short, non-reversible fingerprint of the request body for correlation.
    pub body_hash: String,
}

/// Cheap, dependency-free fingerprint (FNV-1a, 64-bit) rendered as hex.
/// Not a security primitive — only for log correlation, never reversible to text.
pub fn body_fingerprint(body: &str) -> String {
    let mut hash: u64 = 0xcbf29ce484222325;
    for byte in body.as_bytes() {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(0x100000001b3);
    }
    format!("{hash:016x}")
}

/// Render one audit line. Stable, parseable, body-free.
pub fn format_entry(entry: &AuditEntry) -> String {
    format!(
        "ts={} wxid={} method={} workspace={} decision={} body={}",
        entry.ts_secs, entry.wxid, entry.method, entry.workspace, entry.decision, entry.body_hash
    )
}

pub struct Audit {
    path: String,
    lock: Mutex<()>,
}

impl Audit {
    pub fn new(path: impl Into<String>) -> Self {
        Self {
            path: path.into(),
            lock: Mutex::new(()),
        }
    }

    /// Append an entry. Best-effort: an audit write failure must not crash the
    /// bridge, but is reported to the caller for logging.
    pub fn append(&self, entry: &AuditEntry) -> Result<(), String> {
        let _guard = self.lock.lock().map_err(|_| "audit lock poisoned")?;
        let line = format_entry(entry);
        let mut file = OpenOptions::new()
            .create(true)
            .append(true)
            .open(&self.path)
            .map_err(|e| e.to_string())?;
        writeln!(file, "{line}").map_err(|e| e.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample() -> AuditEntry {
        AuditEntry {
            ts_secs: 1718000000,
            wxid: "wx-a".into(),
            method: "engine_send_message_sync".into(),
            workspace: "ws-1".into(),
            decision: "allow".into(),
            body_hash: body_fingerprint("起草一份租赁合同 token sk-secret"),
        }
    }

    #[test]
    fn entry_line_has_no_body_or_secret() {
        let line = format_entry(&sample());
        assert!(line.contains("wxid=wx-a"));
        assert!(line.contains("method=engine_send_message_sync"));
        assert!(line.contains("decision=allow"));
        // the raw body / secret must never appear
        assert!(!line.contains("租赁合同"));
        assert!(!line.contains("sk-secret"));
    }

    #[test]
    fn fingerprint_is_stable_and_opaque() {
        let a = body_fingerprint("hello");
        let b = body_fingerprint("hello");
        let c = body_fingerprint("hellp");
        assert_eq!(a, b);
        assert_ne!(a, c);
        assert_eq!(a.len(), 16);
        assert!(!a.contains("hello"));
    }

    #[test]
    fn append_writes_line_to_file() {
        let dir = std::env::temp_dir();
        let path = dir.join(format!(
            "wx_bridge_audit_test_{}.log",
            body_fingerprint("p")
        ));
        let path = path.to_string_lossy().to_string();
        let _ = std::fs::remove_file(&path);
        let audit = Audit::new(path.clone());
        audit.append(&sample()).unwrap();
        audit.append(&sample()).unwrap();
        let contents = std::fs::read_to_string(&path).unwrap();
        assert_eq!(contents.lines().count(), 2);
        assert!(!contents.contains("租赁合同"));
        let _ = std::fs::remove_file(&path);
    }
}
