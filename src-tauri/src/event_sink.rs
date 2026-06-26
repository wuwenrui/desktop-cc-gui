use std::collections::VecDeque;
use std::env;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use serde::Serialize;
use tauri::{AppHandle, Emitter};
use tokio::time::interval;

use crate::backend::events::{AppServerEvent, EventSink, TerminalOutput};
use crate::snapshot_throttle::global_snapshot_throttle_count;

pub(crate) const APP_SERVER_EVENT_BATCH: &str = "app-server-event-batch";
pub(crate) const APP_SERVER_EVENT_BATCH_STATS: &str = "app-server-event-batch-stats";
const BATCH_FLUSH_INTERVAL_MS: u64 = 40;
const BATCH_STATS_INTERVAL_MS: u64 = 1_000;
const APP_SERVER_EVENT_BATCH_ENV: &str = "CCGUI_APP_SERVER_EVENT_BATCH";
const CRITICAL_METHODS: &[&str] = &[
    "turn/completed",
    "turn/error",
    "runtime/ended",
    "item/tool/requestUserInput",
    "approval/request",
    "collaboration/modeBlocked",
    "collaboration/modeResolved",
];

/// Single-event fallback sink. One `app.emit` per call.
#[derive(Clone)]
pub(crate) struct TauriEventSink {
    app: AppHandle,
}

impl TauriEventSink {
    pub(crate) fn new(app: AppHandle) -> Self {
        Self { app }
    }
}

impl EventSink for TauriEventSink {
    fn emit_app_server_event(&self, event: AppServerEvent) {
        let _ = self.app.emit("app-server-event", event);
    }

    fn emit_terminal_output(&self, event: TerminalOutput) {
        let _ = self.app.emit("terminal-output", event.clone());
        if event.terminal_id == "runtime-console" {
            let _ = self.app.emit("runtime-log:line-appended", event);
        }
    }
}

/// Batched sink: per-workspace `VecDeque` preserves arrival order within a
/// workspace, and a periodic 40ms flush emits one `Vec<AppServerEvent>` payload
/// per ready workspace to the `app-server-event-batch` channel.
///
/// Order preservation is mandatory: `HashMap` and `BTreeMap` iteration order
/// are not stable / not arrival order. The deque + workspace-keyed map below
/// keeps first-seen workspace order in the `workspace_order` vec.
#[derive(Clone)]
pub(crate) struct BatchedTauriEventSink {
    app: AppHandle,
    inner: Arc<Mutex<BatchedEventState>>,
}

struct BatchedEventState {
    by_workspace: std::collections::HashMap<String, VecDeque<AppServerEvent>>,
    workspace_order: VecDeque<String>,
    queued_bytes: usize,
    flush_count: u64,
    critical_bypass_count: u64,
    critical_flush_count: u64,
    last_flush_duration_ms: u64,
    last_flush_size_bytes: usize,
}

#[derive(Clone, Debug, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct BatchStats {
    queued_bytes: usize,
    dropped_count: u64,
    dropped_by_method: std::collections::HashMap<String, u64>,
    flush_count: u64,
    critical_bypass_count: u64,
    critical_flush_count: u64,
    snapshot_throttle_count: u64,
    last_flush_duration_ms: u64,
    last_flush_size_bytes: usize,
}

impl BatchedTauriEventSink {
    pub(crate) fn new(app: AppHandle) -> Self {
        let inner = Arc::new(Mutex::new(BatchedEventState {
            by_workspace: std::collections::HashMap::new(),
            workspace_order: VecDeque::new(),
            queued_bytes: 0,
            flush_count: 0,
            critical_bypass_count: 0,
            critical_flush_count: 0,
            last_flush_duration_ms: 0,
            last_flush_size_bytes: 0,
        }));
        let app_clone = app.clone();
        let inner_clone = Arc::clone(&inner);
        tokio::spawn(async move {
            let mut ticker = interval(Duration::from_millis(BATCH_FLUSH_INTERVAL_MS));
            loop {
                ticker.tick().await;
                let drained_batches: Vec<Vec<AppServerEvent>> = {
                    // Take the state out into a local, drop the lock, then
                    // emit. We hold the lock for microseconds so a sync mutex
                    // is appropriate here.
                    let mut guard = inner_clone.lock().expect(
                        "BatchedTauriEventSink inner mutex poisoned; the background flush task panicked",
                    );
                    guard.drain_all_workspace_batches()
                };
                for drained in drained_batches {
                    let _ = app_clone.emit(APP_SERVER_EVENT_BATCH, drained);
                }
            }
        });
        let stats_app = app.clone();
        let stats_inner = Arc::clone(&inner);
        tokio::spawn(async move {
            let mut ticker = interval(Duration::from_millis(BATCH_STATS_INTERVAL_MS));
            loop {
                ticker.tick().await;
                let stats = {
                    let guard = stats_inner.lock().expect(
                        "BatchedTauriEventSink inner mutex poisoned; the stats task panicked",
                    );
                    guard.stats()
                };
                let _ = stats_app.emit(APP_SERVER_EVENT_BATCH_STATS, stats);
            }
        });
        Self { app, inner }
    }
}

impl BatchedEventState {
    /// Submit an event into the per-workspace batch buffer. Same workspace
    /// events append in arrival order; first-seen workspace order is
    /// preserved via `workspace_order`. Callers MUST hold the lock.
    fn submit(&mut self, event: AppServerEvent) {
        let workspace_id = event.workspace_id.clone();
        self.queued_bytes = self
            .queued_bytes
            .saturating_add(estimate_event_bytes(&event));
        if !self.by_workspace.contains_key(&workspace_id) {
            self.workspace_order.push_back(workspace_id.clone());
        }
        self.by_workspace
            .entry(workspace_id)
            .or_insert_with(VecDeque::new)
            .push_back(event);
    }

    #[cfg(test)]
    fn drain_workspace_batch(&mut self, workspace_id: &str) -> Option<Vec<AppServerEvent>> {
        let started_at = Instant::now();
        let queue = self.by_workspace.remove(workspace_id)?;
        self.workspace_order
            .retain(|queued_id| queued_id != workspace_id);
        let batch: Vec<AppServerEvent> = queue.into_iter().collect();
        if batch.is_empty() {
            None
        } else {
            self.record_flush(&batch, started_at, true);
            Some(batch)
        }
    }

    fn drain_all_workspace_batches(&mut self) -> Vec<Vec<AppServerEvent>> {
        let started_at = Instant::now();
        let order: Vec<String> = self.workspace_order.drain(..).collect();
        let mut batches = Vec::new();
        for workspace_id in order {
            if let Some(queue) = self.by_workspace.remove(&workspace_id) {
                let batch: Vec<AppServerEvent> = queue.into_iter().collect();
                if !batch.is_empty() {
                    batches.push(batch);
                }
            }
        }
        if !batches.is_empty() {
            let total_bytes = batches
                .iter()
                .flatten()
                .map(estimate_event_bytes)
                .sum::<usize>();
            self.flush_count = self.flush_count.saturating_add(batches.len() as u64);
            self.last_flush_duration_ms = started_at.elapsed().as_millis() as u64;
            self.last_flush_size_bytes = total_bytes;
            self.queued_bytes = self.queued_bytes.saturating_sub(total_bytes);
        }
        batches
    }

    #[cfg(test)]
    fn record_flush(&mut self, batch: &[AppServerEvent], started_at: Instant, critical: bool) {
        let bytes = batch.iter().map(estimate_event_bytes).sum::<usize>();
        self.flush_count = self.flush_count.saturating_add(1);
        if critical {
            self.critical_flush_count = self.critical_flush_count.saturating_add(1);
        }
        self.last_flush_duration_ms = started_at.elapsed().as_millis() as u64;
        self.last_flush_size_bytes = bytes;
        self.queued_bytes = self.queued_bytes.saturating_sub(bytes);
    }

    fn record_critical_bypass(&mut self) {
        self.critical_bypass_count = self.critical_bypass_count.saturating_add(1);
    }

    fn critical_bypass_batch(&mut self, event: AppServerEvent) -> Vec<AppServerEvent> {
        self.record_critical_bypass();
        self.flush_count = self.flush_count.saturating_add(1);
        self.critical_flush_count = self.critical_flush_count.saturating_add(1);
        self.last_flush_size_bytes = estimate_event_bytes(&event);
        self.last_flush_duration_ms = 0;
        vec![event]
    }

    fn stats(&self) -> BatchStats {
        BatchStats {
            queued_bytes: self.queued_bytes,
            dropped_count: 0,
            dropped_by_method: std::collections::HashMap::new(),
            flush_count: self.flush_count,
            critical_bypass_count: self.critical_bypass_count,
            critical_flush_count: self.critical_flush_count,
            snapshot_throttle_count: global_snapshot_throttle_count(),
            last_flush_duration_ms: self.last_flush_duration_ms,
            last_flush_size_bytes: self.last_flush_size_bytes,
        }
    }
}

fn app_server_event_method(event: &AppServerEvent) -> Option<&str> {
    event
        .message
        .get("method")
        .and_then(|method| method.as_str())
}

fn is_critical_app_server_event(event: &AppServerEvent) -> bool {
    app_server_event_method(event)
        .map(|method| CRITICAL_METHODS.contains(&method))
        .unwrap_or(false)
}

fn estimate_event_bytes(event: &AppServerEvent) -> usize {
    serde_json::to_vec(event)
        .map(|bytes| bytes.len())
        .unwrap_or(0)
}

impl EventSink for BatchedTauriEventSink {
    fn emit_app_server_event(&self, event: AppServerEvent) {
        // We are inside a sync trait method. The critical section is just a
        // HashMap insert + VecDeque push (microseconds), so a sync mutex is
        // appropriate and never blocks on async I/O. There is no silent
        // fallback to the single-event channel: under lock contention we
        // briefly serialize, but the event is always batched, never
        // double-emitted.
        if is_critical_app_server_event(&event) {
            let mut guard = self.inner.lock().expect(
                "BatchedTauriEventSink inner mutex poisoned; the background flush task panicked",
            );
            let batch = guard.critical_bypass_batch(event);
            drop(guard);
            let _ = self.app.emit(APP_SERVER_EVENT_BATCH, batch);
            return;
        }
        let mut guard = self.inner.lock().expect(
            "BatchedTauriEventSink inner mutex poisoned; the background flush task panicked",
        );
        guard.submit(event);
    }

    fn emit_terminal_output(&self, event: TerminalOutput) {
        // Terminal output keeps the original per-event emit path.
        let _ = self.app.emit("terminal-output", event.clone());
        if event.terminal_id == "runtime-console" {
            let _ = self.app.emit("runtime-log:line-appended", event);
        }
    }
}

/// Returns true when the batched sink should be used. Source of truth is the
/// `CCGUI_APP_SERVER_EVENT_BATCH` environment variable. Default is `1` (on).
/// Tests and dev can opt out by setting it to `0`.
fn parse_app_server_event_batch_enabled(value: Option<&str>) -> bool {
    match value {
        Some(value) => !matches!(
            value.trim().to_ascii_lowercase().as_str(),
            "0" | "false" | "off" | "no"
        ),
        None => true,
    }
}

pub(crate) fn app_server_event_batch_enabled() -> bool {
    parse_app_server_event_batch_enabled(env::var(APP_SERVER_EVENT_BATCH_ENV).ok().as_deref())
}

/// Build the appropriate event sink for the runtime configuration.
///
/// Returns a concrete enum so the caller can stay generic over `impl EventSink`
/// without paying for a `dyn EventSink` indirection.
pub(crate) enum AppServerEventSink {
    Batched(BatchedTauriEventSink),
    Single(TauriEventSink),
}

impl EventSink for AppServerEventSink {
    fn emit_app_server_event(&self, event: AppServerEvent) {
        match self {
            AppServerEventSink::Batched(sink) => sink.emit_app_server_event(event),
            AppServerEventSink::Single(sink) => sink.emit_app_server_event(event),
        }
    }
    fn emit_terminal_output(&self, event: TerminalOutput) {
        match self {
            AppServerEventSink::Batched(sink) => sink.emit_terminal_output(event),
            AppServerEventSink::Single(sink) => sink.emit_terminal_output(event),
        }
    }
}

impl Clone for AppServerEventSink {
    fn clone(&self) -> Self {
        match self {
            AppServerEventSink::Batched(sink) => AppServerEventSink::Batched(sink.clone()),
            AppServerEventSink::Single(sink) => AppServerEventSink::Single(sink.clone()),
        }
    }
}

pub(crate) fn build_event_sink(app: AppHandle) -> AppServerEventSink {
    if app_server_event_batch_enabled() {
        AppServerEventSink::Batched(BatchedTauriEventSink::new(app))
    } else {
        AppServerEventSink::Single(TauriEventSink::new(app))
    }
}

#[cfg(test)]
mod tests {
    use super::{
        is_critical_app_server_event, parse_app_server_event_batch_enabled, BatchedEventState,
        BATCH_FLUSH_INTERVAL_MS,
    };
    use crate::backend::events::AppServerEvent;
    use serde_json::json;
    use std::collections::VecDeque;

    fn make_event(workspace_id: &str, seq: u32) -> AppServerEvent {
        make_method_event(workspace_id, "item/agentMessage/delta", seq)
    }

    fn make_method_event(workspace_id: &str, method: &str, seq: u32) -> AppServerEvent {
        AppServerEvent {
            workspace_id: workspace_id.to_string(),
            message: json!({ "method": method, "seq": seq }),
        }
    }

    fn new_state() -> BatchedEventState {
        BatchedEventState {
            by_workspace: std::collections::HashMap::new(),
            workspace_order: VecDeque::new(),
            queued_bytes: 0,
            flush_count: 0,
            critical_bypass_count: 0,
            critical_flush_count: 0,
            last_flush_duration_ms: 0,
            last_flush_size_bytes: 0,
        }
    }

    /// Per-workspace buffering: events for the same workspace append in
    /// arrival order, and the first-seen workspace order is preserved in
    /// `workspace_order` so the flush emits workspaces in the order they
    /// were first touched.
    #[test]
    fn batched_event_state_per_workspace_arrival_order() {
        let mut state = new_state();
        state.submit(make_event("ws0", 1));
        state.submit(make_event("ws1", 2));
        state.submit(make_event("ws0", 3));
        state.submit(make_event("ws1", 4));

        assert_eq!(state.workspace_order.len(), 2);
        assert_eq!(state.workspace_order[0], "ws0");
        assert_eq!(state.workspace_order[1], "ws1");

        let ws0_seq: Vec<u32> = state
            .by_workspace
            .get("ws0")
            .unwrap()
            .iter()
            .map(|e| e.message.get("seq").unwrap().as_u64().unwrap() as u32)
            .collect();
        assert_eq!(ws0_seq, vec![1, 3]);

        let ws1_seq: Vec<u32> = state
            .by_workspace
            .get("ws1")
            .unwrap()
            .iter()
            .map(|e| e.message.get("seq").unwrap().as_u64().unwrap() as u32)
            .collect();
        assert_eq!(ws1_seq, vec![2, 4]);
    }

    /// Single-workspace behaviour: a burst of events for one workspace
    /// stays in one deque and the flush window never has to drain more
    /// than one workspace's events at a time.
    #[test]
    fn batched_event_state_burst_single_workspace() {
        let mut state = new_state();
        for i in 0..1000 {
            state.submit(make_event("ws0", i));
        }
        assert_eq!(state.workspace_order.len(), 1);
        assert_eq!(state.by_workspace.get("ws0").unwrap().len(), 1000);
        // Sanity check: the configured flush window is in the spec's
        // 32-50ms range (this guards against silent drift of the
        // cadence knob).
        assert!(
            (32..=50).contains(&BATCH_FLUSH_INTERVAL_MS),
            "BATCH_FLUSH_INTERVAL_MS must be in [32, 50] per spec"
        );
    }

    #[test]
    fn batched_event_state_drain_all_keeps_workspace_batches_isolated() {
        let mut state = new_state();
        state.submit(make_event("ws0", 1));
        state.submit(make_event("ws1", 2));
        state.submit(make_event("ws0", 3));

        let drained = state.drain_all_workspace_batches();
        assert_eq!(drained.len(), 2);

        let first_batch_seq: Vec<u32> = drained[0]
            .iter()
            .map(|event| event.message.get("seq").unwrap().as_u64().unwrap() as u32)
            .collect();
        assert_eq!(first_batch_seq, vec![1, 3]);
        assert!(drained[0].iter().all(|event| event.workspace_id == "ws0"));

        let second_batch_seq: Vec<u32> = drained[1]
            .iter()
            .map(|event| event.message.get("seq").unwrap().as_u64().unwrap() as u32)
            .collect();
        assert_eq!(second_batch_seq, vec![2]);
        assert!(drained[1].iter().all(|event| event.workspace_id == "ws1"));

        assert!(state.by_workspace.is_empty());
        assert!(state.workspace_order.is_empty());
    }

    #[test]
    fn critical_event_methods_are_classified_for_bypass() {
        let terminal = make_method_event("ws0", "turn/completed", 3);
        let approval = make_method_event("ws0", "approval/request", 4);
        let normal = make_event("ws0", 5);
        assert!(is_critical_app_server_event(&terminal));
        assert!(is_critical_app_server_event(&approval));
        assert!(!is_critical_app_server_event(&normal));
    }

    #[test]
    fn critical_bypass_state_preserves_burst_queue_and_emits_one_event_batches() {
        let mut state = new_state();
        for seq in 0..1024 {
            state.submit(make_event("ws0", seq));
        }

        let critical_batches: Vec<Vec<AppServerEvent>> = (0..50)
            .map(|seq| state.critical_bypass_batch(make_method_event("ws0", "turn/completed", seq)))
            .collect();

        assert_eq!(critical_batches.len(), 50);
        assert!(critical_batches.iter().all(|batch| batch.len() == 1));
        assert!(critical_batches
            .iter()
            .flatten()
            .all(is_critical_app_server_event));
        assert_eq!(state.by_workspace.get("ws0").unwrap().len(), 1024);
        assert_eq!(state.critical_bypass_count, 50);
        assert_eq!(state.critical_flush_count, 50);
        assert_eq!(state.flush_count, 50);
    }

    #[test]
    fn batched_event_state_drain_workspace_keeps_other_workspaces_queued() {
        let mut state = new_state();
        state.submit(make_event("ws0", 1));
        state.submit(make_event("ws1", 2));
        state.submit(make_event("ws0", 3));

        let ws0_batch = state
            .drain_workspace_batch("ws0")
            .expect("workspace should drain immediately");
        let ws0_seq: Vec<u32> = ws0_batch
            .iter()
            .map(|event| event.message.get("seq").unwrap().as_u64().unwrap() as u32)
            .collect();
        assert_eq!(ws0_seq, vec![1, 3]);
        assert!(state.by_workspace.get("ws0").is_none());
        assert_eq!(state.workspace_order.len(), 1);
        assert_eq!(state.workspace_order[0], "ws1");
        assert_eq!(state.by_workspace.get("ws1").unwrap().len(), 1);
    }

    #[test]
    fn app_server_event_batch_flag_defaults_on_and_accepts_explicit_opt_out() {
        assert!(parse_app_server_event_batch_enabled(None));
        assert!(parse_app_server_event_batch_enabled(Some("1")));
        assert!(parse_app_server_event_batch_enabled(Some("true")));
        assert!(!parse_app_server_event_batch_enabled(Some("0")));
        assert!(!parse_app_server_event_batch_enabled(Some("false")));
        assert!(!parse_app_server_event_batch_enabled(Some("off")));
        assert!(!parse_app_server_event_batch_enabled(Some("no")));
    }
}
