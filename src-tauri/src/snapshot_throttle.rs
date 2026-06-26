use std::collections::{HashMap, HashSet};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{Duration, Instant};

use serde_json::Value;

const SNAPSHOT_THROTTLE_WINDOW: Duration = Duration::from_millis(32);
const SNAPSHOT_THROTTLE_ENTRY_TTL: Duration = Duration::from_secs(120);
const SNAPSHOT_THROTTLE_MAX_TRACKED_KEYS: usize = 2_048;
static GLOBAL_SNAPSHOT_THROTTLE_COUNT: AtomicU64 = AtomicU64::new(0);

#[derive(Clone, Debug, Eq, Hash, PartialEq)]
struct SnapshotKey {
    workspace_id: String,
    thread_id: String,
    item_id: String,
    kind: String,
}

#[derive(Default)]
pub(crate) struct SnapshotThrottle {
    last_emit_at: HashMap<SnapshotKey, Instant>,
    pending_snapshot: HashMap<SnapshotKey, Value>,
    throttle_count: u64,
}

impl SnapshotThrottle {
    pub(crate) fn filter_event(&mut self, workspace_id: &str, event: Value) -> Vec<Value> {
        let now = Instant::now();
        self.prune_stale(now);

        if is_terminal_event(&event) {
            let mut flushed = self.flush_all_pending_at(now);
            self.cleanup_terminal_scope(workspace_id, &event);
            flushed.push(event);
            return flushed;
        }

        let Some(key) = snapshot_key(workspace_id, &event) else {
            return vec![event];
        };
        if self
            .last_emit_at
            .get(&key)
            .map(|last_emit| now.duration_since(*last_emit) < SNAPSHOT_THROTTLE_WINDOW)
            .unwrap_or(false)
        {
            self.pending_snapshot.insert(key, event);
            self.throttle_count = self.throttle_count.saturating_add(1);
            GLOBAL_SNAPSHOT_THROTTLE_COUNT.fetch_add(1, Ordering::Relaxed);
            return Vec::new();
        }
        self.last_emit_at.insert(key, now);
        self.prune_tracked_key_cap();
        vec![event]
    }

    fn flush_all_pending_at(&mut self, now: Instant) -> Vec<Value> {
        self.pending_snapshot
            .drain()
            .map(|(key, event)| {
                self.last_emit_at.insert(key, now);
                event
            })
            .collect()
    }

    fn prune_stale(&mut self, now: Instant) {
        if self.last_emit_at.is_empty() {
            return;
        }
        let pending_keys = self.pending_keys();
        self.last_emit_at.retain(|key, last_emit| {
            pending_keys.contains(key)
                || now.saturating_duration_since(*last_emit) <= SNAPSHOT_THROTTLE_ENTRY_TTL
        });
        self.prune_tracked_key_cap();
    }

    fn prune_tracked_key_cap(&mut self) {
        let overflow = self
            .last_emit_at
            .len()
            .saturating_sub(SNAPSHOT_THROTTLE_MAX_TRACKED_KEYS);
        if overflow == 0 {
            return;
        }
        let pending_keys = self.pending_keys();
        let mut eviction_candidates: Vec<(SnapshotKey, Instant)> = self
            .last_emit_at
            .iter()
            .filter(|(key, _)| !pending_keys.contains(*key))
            .map(|(key, last_emit)| (key.clone(), *last_emit))
            .collect();
        eviction_candidates.sort_by_key(|(_, last_emit)| *last_emit);
        for (key, _) in eviction_candidates.into_iter().take(overflow) {
            self.last_emit_at.remove(&key);
        }
    }

    fn pending_keys(&self) -> HashSet<SnapshotKey> {
        self.pending_snapshot.keys().cloned().collect()
    }

    fn cleanup_terminal_scope(&mut self, workspace_id: &str, event: &Value) {
        match terminal_scope(event) {
            Some(TerminalScope::Item { thread_id, item_id }) => {
                self.last_emit_at.retain(|key, _| {
                    key.workspace_id != workspace_id
                        || key.thread_id != thread_id
                        || key.item_id != item_id
                });
            }
            Some(TerminalScope::Thread { thread_id }) => {
                self.last_emit_at.retain(|key, _| {
                    key.workspace_id != workspace_id || key.thread_id != thread_id
                });
            }
            Some(TerminalScope::Workspace) => {
                self.last_emit_at
                    .retain(|key, _| key.workspace_id != workspace_id);
            }
            None => {}
        }
    }

    #[cfg(test)]
    pub(crate) fn throttle_count(&self) -> u64 {
        self.throttle_count
    }

    #[cfg(test)]
    pub(crate) fn tracked_key_count(&self) -> usize {
        self.last_emit_at.len()
    }
}

#[allow(dead_code)]
pub(crate) fn global_snapshot_throttle_count() -> u64 {
    GLOBAL_SNAPSHOT_THROTTLE_COUNT.load(Ordering::Relaxed)
}

fn method(event: &Value) -> Option<&str> {
    event.get("method").and_then(Value::as_str)
}

fn params(event: &Value) -> Option<&serde_json::Map<String, Value>> {
    event.get("params").and_then(Value::as_object)
}

fn snapshot_key(workspace_id: &str, event: &Value) -> Option<SnapshotKey> {
    if method(event) != Some("item/updated") {
        return None;
    }
    let params = params(event)?;
    let item = params.get("item").and_then(Value::as_object)?;
    if !has_text_snapshot_fields(item) && !has_text_snapshot_fields(params) {
        return None;
    }
    let kind = item
        .get("kind")
        .and_then(Value::as_str)
        .or_else(|| item.get("type").and_then(Value::as_str))
        .or_else(|| params.get("kind").and_then(Value::as_str))?;
    if !matches!(
        kind,
        "message" | "reasoning" | "commandExecution" | "fileChange"
    ) {
        return None;
    }
    let thread_id = params.get("threadId").and_then(Value::as_str)?;
    let item_id = item
        .get("id")
        .and_then(Value::as_str)
        .or_else(|| params.get("itemId").and_then(Value::as_str))?;
    Some(SnapshotKey {
        workspace_id: workspace_id.to_string(),
        thread_id: thread_id.to_string(),
        item_id: item_id.to_string(),
        kind: kind.to_string(),
    })
}

fn has_text_snapshot_fields(fields: &serde_json::Map<String, Value>) -> bool {
    ["text", "content", "output_text"]
        .iter()
        .any(|key| fields.get(*key).and_then(Value::as_str).is_some())
}

fn is_terminal_event(event: &Value) -> bool {
    matches!(
        method(event),
        Some("item/completed" | "turn/completed" | "turn/error" | "runtime/ended")
    )
}

enum TerminalScope {
    Item { thread_id: String, item_id: String },
    Thread { thread_id: String },
    Workspace,
}

fn terminal_scope(event: &Value) -> Option<TerminalScope> {
    match method(event)? {
        "item/completed" => {
            let params = params(event)?;
            let thread_id = params.get("threadId").and_then(Value::as_str)?;
            let item_id = params
                .get("item")
                .and_then(Value::as_object)
                .and_then(|item| item.get("id").and_then(Value::as_str))
                .or_else(|| params.get("itemId").and_then(Value::as_str))?;
            Some(TerminalScope::Item {
                thread_id: thread_id.to_string(),
                item_id: item_id.to_string(),
            })
        }
        "turn/completed" | "turn/error" => {
            let params = params(event)?;
            let thread_id = params.get("threadId").and_then(Value::as_str)?;
            Some(TerminalScope::Thread {
                thread_id: thread_id.to_string(),
            })
        }
        "runtime/ended" => Some(TerminalScope::Workspace),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn throttles_only_item_updated_text_snapshots() {
        let mut throttle = SnapshotThrottle::default();
        let first = json!({
            "method": "item/updated",
            "params": {
                "threadId": "thread-1",
                "item": { "id": "item-1", "type": "message", "text": "a" }
            }
        });
        let second = json!({
            "method": "item/updated",
            "params": {
                "threadId": "thread-1",
                "item": { "id": "item-1", "type": "message", "text": "b" }
            }
        });
        assert_eq!(throttle.filter_event("ws-1", first).len(), 1);
        assert!(throttle.filter_event("ws-1", second).is_empty());
        assert_eq!(throttle.throttle_count(), 1);
    }

    #[test]
    fn terminal_event_flushes_pending_snapshot_before_terminal() {
        let mut throttle = SnapshotThrottle::default();
        let first = json!({
            "method": "item/updated",
            "params": {
                "threadId": "thread-1",
                "item": { "id": "item-1", "type": "message", "text": "a" }
            }
        });
        let second = json!({
            "method": "item/updated",
            "params": {
                "threadId": "thread-1",
                "item": { "id": "item-1", "type": "message", "text": "b" }
            }
        });
        let completed = json!({
            "method": "item/completed",
            "params": { "threadId": "thread-1", "item": { "id": "item-1" } }
        });
        assert_eq!(throttle.filter_event("ws-1", first).len(), 1);
        assert!(throttle.filter_event("ws-1", second).is_empty());
        let flushed = throttle.filter_event("ws-1", completed);
        assert_eq!(flushed.len(), 2);
        assert_eq!(flushed[0]["params"]["item"]["text"].as_str(), Some("b"));
        assert_eq!(flushed[1]["method"].as_str(), Some("item/completed"));
        assert_eq!(throttle.tracked_key_count(), 0);
    }

    #[test]
    fn output_delta_and_lifecycle_events_are_never_throttled() {
        let mut throttle = SnapshotThrottle::default();
        let output_delta = json!({
            "method": "item/commandExecution/outputDelta",
            "params": { "threadId": "thread-1", "itemId": "item-1", "delta": "x" }
        });
        let started = json!({
            "method": "item/started",
            "params": { "threadId": "thread-1", "item": { "id": "item-1" } }
        });
        assert_eq!(throttle.filter_event("ws-1", output_delta).len(), 1);
        assert_eq!(throttle.filter_event("ws-1", started).len(), 1);
    }

    #[test]
    fn tracked_keys_remain_capped_for_long_running_unique_items() {
        let mut throttle = SnapshotThrottle::default();
        for index in 0..(SNAPSHOT_THROTTLE_MAX_TRACKED_KEYS + 100) {
            let event = json!({
                "method": "item/updated",
                "params": {
                    "threadId": "thread-1",
                    "item": {
                        "id": format!("item-{index}"),
                        "type": "message",
                        "text": "snapshot"
                    }
                }
            });
            assert_eq!(throttle.filter_event("ws-1", event).len(), 1);
        }
        assert_eq!(
            throttle.tracked_key_count(),
            SNAPSHOT_THROTTLE_MAX_TRACKED_KEYS
        );
    }

    #[test]
    fn turn_terminal_cleans_thread_scope() {
        let mut throttle = SnapshotThrottle::default();
        for index in 0..2 {
            let event = json!({
                "method": "item/updated",
                "params": {
                    "threadId": "thread-1",
                    "item": {
                        "id": format!("item-{index}"),
                        "type": "message",
                        "text": "snapshot"
                    }
                }
            });
            assert_eq!(throttle.filter_event("ws-1", event).len(), 1);
        }
        let terminal = json!({
            "method": "turn/completed",
            "params": { "threadId": "thread-1", "turnId": "turn-1" }
        });
        let flushed = throttle.filter_event("ws-1", terminal);
        assert_eq!(flushed.len(), 1);
        assert_eq!(flushed[0]["method"].as_str(), Some("turn/completed"));
        assert_eq!(throttle.tracked_key_count(), 0);
    }
}
