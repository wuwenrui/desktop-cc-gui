//! Idempotent message de-duplication, persisted in SQLite.
//!
//! Daemon calls are NOT idempotent (re-sending replays the AI turn and double
//! bills, R3). WeChat/WeClaw can redeliver the same message id on reconnect, so
//! the bridge must drop duplicates. Persistence (SQLite) means a bridge restart
//! does not forget what it already processed.

use std::sync::Mutex;

use rusqlite::Connection;

pub struct Dedup {
    conn: Mutex<Connection>,
}

impl Dedup {
    /// Open (or create) the dedup store. Use `":memory:"` in tests.
    pub fn open(path: &str) -> Result<Self, String> {
        let conn = Connection::open(path).map_err(|e| e.to_string())?;
        conn.execute(
            "CREATE TABLE IF NOT EXISTS seen_messages (
                msg_id TEXT PRIMARY KEY,
                seen_at INTEGER NOT NULL
            )",
            [],
        )
        .map_err(|e| e.to_string())?;
        Ok(Self {
            conn: Mutex::new(conn),
        })
    }

    /// Record `msg_id` as seen at `now_secs`. Returns `true` if this id is NEW
    /// (caller should process it) or `false` if it is a duplicate still within
    /// `ttl_secs`. Expired entries are treated as new and refreshed. Also purges
    /// rows older than the TTL to keep the table bounded.
    pub fn check_and_record(
        &self,
        msg_id: &str,
        now_secs: i64,
        ttl_secs: i64,
    ) -> Result<bool, String> {
        let conn = self.conn.lock().map_err(|_| "dedup lock poisoned")?;
        let cutoff = now_secs - ttl_secs;

        conn.execute("DELETE FROM seen_messages WHERE seen_at < ?1", [cutoff])
            .map_err(|e| e.to_string())?;

        let existing: Option<i64> = conn
            .query_row(
                "SELECT seen_at FROM seen_messages WHERE msg_id = ?1",
                [msg_id],
                |row| row.get(0),
            )
            .ok();

        match existing {
            Some(seen_at) if seen_at >= cutoff => Ok(false), // duplicate within TTL
            _ => {
                conn.execute(
                    "INSERT OR REPLACE INTO seen_messages (msg_id, seen_at) VALUES (?1, ?2)",
                    rusqlite::params![msg_id, now_secs],
                )
                .map_err(|e| e.to_string())?;
                Ok(true)
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const TTL: i64 = 600;

    #[test]
    fn first_sighting_is_new() {
        let d = Dedup::open(":memory:").unwrap();
        assert!(d.check_and_record("m1", 1000, TTL).unwrap());
    }

    #[test]
    fn immediate_repeat_is_duplicate() {
        let d = Dedup::open(":memory:").unwrap();
        assert!(d.check_and_record("m1", 1000, TTL).unwrap());
        assert!(!d.check_and_record("m1", 1001, TTL).unwrap());
        assert!(!d.check_and_record("m1", 1500, TTL).unwrap());
    }

    #[test]
    fn distinct_ids_are_independent() {
        let d = Dedup::open(":memory:").unwrap();
        assert!(d.check_and_record("a", 1000, TTL).unwrap());
        assert!(d.check_and_record("b", 1000, TTL).unwrap());
    }

    #[test]
    fn reappears_after_ttl_expiry() {
        let d = Dedup::open(":memory:").unwrap();
        assert!(d.check_and_record("m1", 1000, TTL).unwrap());
        // now far beyond TTL -> treated as new again
        assert!(d.check_and_record("m1", 1000 + TTL + 1, TTL).unwrap());
    }

    #[test]
    fn triple_send_processes_once() {
        // R3 acceptance: same msg_id delivered 3x -> exactly one "new".
        let d = Dedup::open(":memory:").unwrap();
        let results: Vec<bool> = (0..3)
            .map(|i| d.check_and_record("dup", 2000 + i, TTL).unwrap())
            .collect();
        assert_eq!(results.iter().filter(|x| **x).count(), 1);
    }
}
