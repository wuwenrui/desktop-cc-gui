use std::collections::{HashMap, VecDeque};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use notify::{Config as NotifyConfig, Event, RecommendedWatcher, RecursiveMode, Watcher};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};
use tokio::sync::{mpsc, oneshot, Mutex};

pub(crate) const DETACHED_EXTERNAL_FILE_CHANGE_BATCH_EVENT: &str =
    "detached-external-file-change-batch";
const DEBOUNCED_EMIT_FLUSH_MS: u64 = 100;

static DEBOUNCED_EMITTER_CELL: tokio::sync::OnceCell<DebouncedExternalChangeEmitter> =
    tokio::sync::OnceCell::const_new();

async fn debounced_emitter(app: &AppHandle) -> &'static DebouncedExternalChangeEmitter {
    DEBOUNCED_EMITTER_CELL
        .get_or_init(|| async { DebouncedExternalChangeEmitter::new(app.clone()) })
        .await
}
const POLLING_INTERVAL_MS: u64 = 1200;
const TRANSIENT_RETRY_ATTEMPTS: usize = 3;
const TRANSIENT_RETRY_BASE_DELAY_MS: u64 = 60;
const WATCHER_DUPLICATE_DEBOUNCE_MS: u64 = 280;
const MONITOR_MODE_WATCHER: &str = "watcher";
const MONITOR_MODE_POLLING: &str = "polling";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct DetachedExternalMonitorStatus {
    pub(crate) mode: String,
    pub(crate) fallback_reason: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct DetachedExternalFileChangeEvent {
    #[serde(rename = "workspaceId")]
    pub(crate) workspace_id: String,
    #[serde(rename = "normalizedPath")]
    pub(crate) normalized_path: String,
    #[serde(rename = "mtimeMs")]
    pub(crate) mtime_ms: Option<u64>,
    pub(crate) size: Option<u64>,
    #[serde(rename = "detectedAtMs")]
    pub(crate) detected_at_ms: u64,
    pub(crate) source: String,
    #[serde(rename = "eventKind")]
    pub(crate) event_kind: String,
    pub(crate) platform: String,
    #[serde(rename = "fallbackReason")]
    pub(crate) fallback_reason: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct FileSignature {
    mtime_ms: Option<u64>,
    size: Option<u64>,
}

#[derive(Debug, Clone)]
struct MonitorConfig {
    workspace_root: PathBuf,
    active_file_relative: Option<String>,
}

struct WorkspaceExternalMonitor {
    stop_tx: Option<oneshot::Sender<()>>,
    task: tokio::task::JoinHandle<()>,
}

#[derive(Default)]
pub(crate) struct DetachedExternalChangeRuntime {
    monitors: HashMap<String, WorkspaceExternalMonitor>,
}

fn now_epoch_ms() -> u64 {
    let millis = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    if millis > u64::MAX as u128 {
        u64::MAX
    } else {
        millis as u64
    }
}

fn normalize_rel_path(input: &str) -> String {
    input
        .trim()
        .replace('\\', "/")
        .trim_start_matches("./")
        .trim_start_matches('/')
        .to_string()
}

fn dedupe_key(path: &str) -> String {
    let normalized = normalize_rel_path(path);
    if cfg!(target_os = "windows") {
        normalized.to_lowercase()
    } else {
        normalized
    }
}

fn resolve_active_relative_path(
    workspace_root: &Path,
    raw_file_path: &str,
) -> Result<String, String> {
    let trimmed = raw_file_path.trim();
    if trimmed.is_empty() {
        return Err("Active file path cannot be empty.".to_string());
    }
    let normalized_trimmed = trimmed.replace('\\', "/");
    let candidate = PathBuf::from(&normalized_trimmed);
    let relative = if candidate.is_absolute() {
        candidate
            .strip_prefix(workspace_root)
            .map_err(|_| "Active file path is outside workspace root.".to_string())?
            .to_path_buf()
    } else {
        candidate
    };
    let normalized = normalize_rel_path(&relative.to_string_lossy());
    if normalized.is_empty() {
        return Err("Active file path is invalid.".to_string());
    }
    Ok(normalized)
}

fn is_path_inside_root(path: &Path, root: &Path) -> bool {
    path.starts_with(root)
}

fn resolve_relative_event_path(workspace_root: &Path, path: &Path) -> Option<String> {
    let relative = if path.is_absolute() {
        if !is_path_inside_root(path, workspace_root) {
            return None;
        }
        path.strip_prefix(workspace_root).ok()?.to_path_buf()
    } else {
        path.to_path_buf()
    };
    let normalized = normalize_rel_path(&relative.to_string_lossy());
    if normalized.is_empty() {
        return None;
    }
    Some(normalized)
}

fn is_active_file_match(active_file_relative: Option<&str>, candidate_path: &str) -> bool {
    let Some(active) = active_file_relative else {
        return true;
    };
    dedupe_key(active) == dedupe_key(candidate_path)
}

fn event_kind_label(event: &Event) -> String {
    format!("{:?}", event.kind).to_lowercase()
}

fn normalize_workspace_root(path: &str) -> Result<PathBuf, String> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err("Workspace path cannot be empty.".to_string());
    }
    let raw = PathBuf::from(trimmed);
    if !raw.is_absolute() {
        return Err("Workspace path must be absolute.".to_string());
    }
    let canonical = raw
        .canonicalize()
        .map_err(|err| format!("Failed to resolve workspace path: {err}"))?;
    if !canonical.is_dir() {
        return Err("Workspace path is not a directory.".to_string());
    }
    Ok(canonical)
}

fn is_transient_fs_error(error: &std::io::Error) -> bool {
    use std::io::ErrorKind;
    matches!(
        error.kind(),
        ErrorKind::PermissionDenied
            | ErrorKind::WouldBlock
            | ErrorKind::Interrupted
            | ErrorKind::TimedOut
    ) || error
        .to_string()
        .to_lowercase()
        .contains("sharing violation")
}

async fn read_signature_with_retry(path: &Path) -> Result<Option<FileSignature>, std::io::Error> {
    let mut delay_ms = TRANSIENT_RETRY_BASE_DELAY_MS;
    for attempt in 0..TRANSIENT_RETRY_ATTEMPTS {
        match tokio::fs::metadata(path).await {
            Ok(metadata) => {
                if metadata.is_dir() {
                    return Ok(None);
                }
                let mtime_ms = metadata
                    .modified()
                    .ok()
                    .and_then(|value| value.duration_since(UNIX_EPOCH).ok())
                    .map(|duration| {
                        let millis = duration.as_millis();
                        if millis > u64::MAX as u128 {
                            u64::MAX
                        } else {
                            millis as u64
                        }
                    });
                return Ok(Some(FileSignature {
                    mtime_ms,
                    size: Some(metadata.len()),
                }));
            }
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
                return Ok(None);
            }
            Err(error)
                if attempt + 1 < TRANSIENT_RETRY_ATTEMPTS && is_transient_fs_error(&error) =>
            {
                tokio::time::sleep(Duration::from_millis(delay_ms)).await;
                delay_ms = delay_ms.saturating_mul(2);
            }
            Err(error) => return Err(error),
        }
    }
    Ok(None)
}

fn build_event(
    workspace_id: &str,
    normalized_path: String,
    signature: Option<&FileSignature>,
    source: &str,
    event_kind: &str,
    fallback_reason: Option<String>,
) -> DetachedExternalFileChangeEvent {
    DetachedExternalFileChangeEvent {
        workspace_id: workspace_id.to_string(),
        normalized_path,
        mtime_ms: signature.and_then(|value| value.mtime_ms),
        size: signature.and_then(|value| value.size),
        detected_at_ms: now_epoch_ms(),
        source: source.to_string(),
        event_kind: event_kind.to_string(),
        platform: std::env::consts::OS.to_string(),
        fallback_reason,
    }
}

/// Per-`(workspace_id, normalized_path)` debouncer that coalesces events
/// within a 100ms window and emits a single `Vec<DetachedExternalFileChangeEvent>`
/// to `DETACHED_EXTERNAL_FILE_CHANGE_BATCH_EVENT`.
///
/// Order is preserved using a `VecDeque` arrival-order queue. The mapping
/// `HashMap<key, deque_index>` allows updating the latest event for a key
/// without losing the relative order between distinct keys. `HashMap` and
/// `BTreeMap` iteration order are NOT used to claim arrival order.
#[derive(Clone)]
pub(crate) struct DebouncedExternalChangeEmitter {
    inner: Arc<Mutex<DebouncedState>>,
}

struct DebouncedState {
    by_key: HashMap<String, usize>,
    queue: VecDeque<DetachedExternalFileChangeEvent>,
}

impl DebouncedState {
    /// Submit an event for the next flush. Within a single flush window,
    /// same-key events replace the most recent slot; across windows, the
    /// previous window's `by_key` is cleared, so a same-key event in the
    /// next window starts a new coalesce cycle.
    fn submit(&mut self, event: DetachedExternalFileChangeEvent) {
        let key = format!("{}\0{}", event.workspace_id, event.normalized_path);
        if let Some(&existing_idx) = self.by_key.get(&key) {
            // Replace the most recent event for this key while preserving
            // the deque index that defines arrival order. The flush ticker
            // clears `by_key` whenever it drains the queue, so the index is
            // always valid here; the bounds check is a defensive guard.
            if let Some(slot) = self.queue.get_mut(existing_idx) {
                *slot = event;
                return;
            }
            // Stale index after a concurrent drain: drop the entry and
            // fall through to append-as-new rather than silently losing
            // the event.
            self.by_key.remove(&key);
        }
        let new_idx = self.queue.len();
        self.queue.push_back(event);
        self.by_key.insert(key, new_idx);
    }
}

impl DebouncedExternalChangeEmitter {
    pub(crate) fn new(app: AppHandle) -> Self {
        let inner = Arc::new(Mutex::new(DebouncedState {
            by_key: HashMap::new(),
            queue: VecDeque::new(),
        }));
        let inner_bg = Arc::clone(&inner);
        tokio::spawn(async move {
            let mut ticker = tokio::time::interval(Duration::from_millis(DEBOUNCED_EMIT_FLUSH_MS));
            loop {
                ticker.tick().await;
                let drained: Vec<DetachedExternalFileChangeEvent> = {
                    let mut guard = inner_bg.lock().await;
                    // Take the queue, then clear `by_key`. The queue indices
                    // captured during this window are no longer valid once
                    // the queue is drained; leaving them would cause `submit`
                    // to fall through the `if let Some(slot)` branch and
                    // silently drop the next same-key event in the next
                    // window.
                    //
                    // Semantics: a key is coalesced WITHIN a flush window
                    // only. A same-key event in the next window starts a new
                    // coalesce cycle. This matches spec
                    // `file-change-event-debounce`: "100ms 窗口内同 key 只
                    // 保留最新事件".
                    let drained: Vec<DetachedExternalFileChangeEvent> =
                        std::mem::take(&mut guard.queue).into_iter().collect();
                    guard.by_key.clear();
                    drained
                };
                if drained.is_empty() {
                    continue;
                }
                let _ = app.emit(DETACHED_EXTERNAL_FILE_CHANGE_BATCH_EVENT, drained);
            }
        });
        Self { inner }
    }

    pub(crate) async fn submit(&self, event: DetachedExternalFileChangeEvent) {
        let mut guard = self.inner.lock().await;
        guard.submit(event);
    }
}

async fn update_status(
    status: &Arc<Mutex<DetachedExternalMonitorStatus>>,
    mode: &str,
    reason: Option<String>,
) {
    let mut guard = status.lock().await;
    guard.mode = mode.to_string();
    guard.fallback_reason = reason;
}

fn create_workspace_watcher(
    workspace_root: &Path,
) -> Result<
    (
        RecommendedWatcher,
        mpsc::UnboundedReceiver<notify::Result<Event>>,
    ),
    String,
> {
    let (event_tx, event_rx) = mpsc::unbounded_channel::<notify::Result<Event>>();
    let mut watcher = RecommendedWatcher::new(
        move |result| {
            let _ = event_tx.send(result);
        },
        NotifyConfig::default(),
    )
    .map_err(|err| format!("Failed to initialize watcher: {err}"))?;
    watcher
        .watch(workspace_root, RecursiveMode::Recursive)
        .map_err(|err| format!("Failed to watch workspace path: {err}"))?;
    Ok((watcher, event_rx))
}

async fn handle_watcher_event(
    app: &AppHandle,
    workspace_id: &str,
    workspace_root: &Path,
    active_file_relative: Option<&str>,
    event: Event,
    snapshots: &mut HashMap<String, Option<FileSignature>>,
    last_emit_at: &mut HashMap<String, u64>,
) {
    let event_kind = event_kind_label(&event);
    for path in &event.paths {
        let Some(normalized_path) = resolve_relative_event_path(workspace_root, path) else {
            continue;
        };
        if !is_active_file_match(active_file_relative, &normalized_path) {
            continue;
        }
        let absolute_path = workspace_root.join(&normalized_path);
        let signature = match read_signature_with_retry(&absolute_path).await {
            Ok(value) => value,
            Err(error) => {
                eprintln!(
                    "[external_changes] workspace_id={} source=watcher event_kind={} path={} read_error={}",
                    workspace_id, event_kind, normalized_path, error
                );
                continue;
            }
        };
        let key = dedupe_key(&normalized_path);
        let previous = snapshots.get(&key).cloned();
        let now_ms = now_epoch_ms();
        let emitted_recently = last_emit_at
            .get(&key)
            .map(|value| now_ms.saturating_sub(*value) <= WATCHER_DUPLICATE_DEBOUNCE_MS)
            .unwrap_or(false);
        if previous == Some(signature.clone()) && emitted_recently {
            continue;
        }
        if previous == Some(signature.clone()) {
            continue;
        }
        snapshots.insert(key.clone(), signature.clone());
        last_emit_at.insert(key, now_ms);
        let payload = build_event(
            workspace_id,
            normalized_path,
            signature.as_ref(),
            MONITOR_MODE_WATCHER,
            &event_kind,
            None,
        );
        debounced_emitter(app).await.submit(payload.clone()).await;
    }
}

async fn handle_polling_tick(
    app: &AppHandle,
    workspace_id: &str,
    config: &Arc<Mutex<MonitorConfig>>,
    snapshots: &mut HashMap<String, Option<FileSignature>>,
) {
    let current = config.lock().await.clone();
    let Some(active_file_relative) = current.active_file_relative else {
        return;
    };
    let key = dedupe_key(&active_file_relative);
    let absolute_path = current.workspace_root.join(&active_file_relative);
    let signature = match read_signature_with_retry(&absolute_path).await {
        Ok(value) => value,
        Err(error) => {
            eprintln!(
                "[external_changes] workspace_id={} source=polling event_kind=read-error path={} read_error={}",
                workspace_id, active_file_relative, error
            );
            return;
        }
    };
    let previous = snapshots.get(&key).cloned();
    if previous.is_none() {
        snapshots.insert(key, signature);
        return;
    }
    if previous == Some(signature.clone()) {
        return;
    }
    snapshots.insert(key, signature.clone());
    let payload = build_event(
        workspace_id,
        active_file_relative,
        signature.as_ref(),
        MONITOR_MODE_POLLING,
        "polling-detected",
        None,
    );
    debounced_emitter(app).await.submit(payload.clone()).await;
}

async fn emit_watcher_fallback(
    app: &AppHandle,
    workspace_id: &str,
    normalized_path: String,
    fallback_reason: String,
) {
    let payload = build_event(
        workspace_id,
        normalized_path,
        None,
        MONITOR_MODE_POLLING,
        "watcher-fallback",
        Some(fallback_reason),
    );
    debounced_emitter(app).await.submit(payload.clone()).await;
}

async fn run_workspace_monitor_loop(
    app: AppHandle,
    workspace_id: String,
    config: Arc<Mutex<MonitorConfig>>,
    status: Arc<Mutex<DetachedExternalMonitorStatus>>,
    mut stop_rx: oneshot::Receiver<()>,
    mut watcher: Option<RecommendedWatcher>,
    mut watcher_rx: Option<mpsc::UnboundedReceiver<notify::Result<Event>>>,
) {
    let mut snapshots: HashMap<String, Option<FileSignature>> = HashMap::new();
    let mut last_emit_at: HashMap<String, u64> = HashMap::new();
    let mut interval = tokio::time::interval(Duration::from_millis(POLLING_INTERVAL_MS));
    interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Delay);

    loop {
        let mode = status.lock().await.mode.clone();
        if mode == MONITOR_MODE_WATCHER {
            tokio::select! {
                _ = &mut stop_rx => {
                    break;
                }
                maybe_event = async {
                    if let Some(rx) = watcher_rx.as_mut() {
                        rx.recv().await
                    } else {
                        None
                    }
                } => {
                    match maybe_event {
                        Some(Ok(event)) => {
                            let current_config = config.lock().await.clone();
                            handle_watcher_event(
                                &app,
                                &workspace_id,
                                &current_config.workspace_root,
                                current_config.active_file_relative.as_deref(),
                                event,
                                &mut snapshots,
                                &mut last_emit_at,
                            ).await;
                        }
                        Some(Err(error)) => {
                            let fallback_reason = format!("watcher-delivery-error: {error}");
                            let active_path = config
                                .lock()
                                .await
                                .active_file_relative
                                .clone()
                                .unwrap_or_default();
                            update_status(&status, MONITOR_MODE_POLLING, Some(fallback_reason.clone()))
                                .await;
                            emit_watcher_fallback(&app, &workspace_id, active_path, fallback_reason).await;
                            watcher = None;
                            watcher_rx = None;
                        }
                        None => {
                            let fallback_reason = "watcher-channel-closed".to_string();
                            let active_path = config
                                .lock()
                                .await
                                .active_file_relative
                                .clone()
                                .unwrap_or_default();
                            update_status(&status, MONITOR_MODE_POLLING, Some(fallback_reason.clone()))
                                .await;
                            emit_watcher_fallback(&app, &workspace_id, active_path, fallback_reason).await;
                            watcher = None;
                            watcher_rx = None;
                        }
                    }
                }
            }
        } else {
            tokio::select! {
                _ = &mut stop_rx => {
                    break;
                }
                _ = interval.tick() => {
                    handle_polling_tick(
                        &app,
                        &workspace_id,
                        &config,
                        &mut snapshots,
                    ).await;
                }
            }
        }
    }
    drop(watcher);
}

async fn shutdown_monitor(monitor: WorkspaceExternalMonitor) {
    if let Some(stop_tx) = monitor.stop_tx {
        let _ = stop_tx.send(());
    }
    monitor.task.abort();
    let _ = monitor.task.await;
}

pub(crate) async fn configure_detached_external_change_monitor_inner(
    app: AppHandle,
    runtime: &Mutex<DetachedExternalChangeRuntime>,
    workspace_id: String,
    workspace_path: String,
    active_file_path: String,
    watcher_enabled: bool,
) -> Result<DetachedExternalMonitorStatus, String> {
    let workspace_root = normalize_workspace_root(&workspace_path)?;
    let active_file_relative = resolve_active_relative_path(&workspace_root, &active_file_path)?;

    let removed = {
        let mut runtime_guard = runtime.lock().await;
        runtime_guard.monitors.remove(workspace_id.as_str())
    };
    if let Some(monitor) = removed {
        shutdown_monitor(monitor).await;
    }

    let (watcher, watcher_rx, status) = if watcher_enabled {
        match create_workspace_watcher(&workspace_root) {
            Ok((watcher, watcher_rx)) => (
                Some(watcher),
                Some(watcher_rx),
                DetachedExternalMonitorStatus {
                    mode: MONITOR_MODE_WATCHER.to_string(),
                    fallback_reason: None,
                },
            ),
            Err(error) => (
                None,
                None,
                DetachedExternalMonitorStatus {
                    mode: MONITOR_MODE_POLLING.to_string(),
                    fallback_reason: Some(format!("watcher-init-failed: {error}")),
                },
            ),
        }
    } else {
        (
            None,
            None,
            DetachedExternalMonitorStatus {
                mode: MONITOR_MODE_POLLING.to_string(),
                fallback_reason: Some("watcher-disabled-by-setting".to_string()),
            },
        )
    };

    let monitor_config = Arc::new(Mutex::new(MonitorConfig {
        workspace_root,
        active_file_relative: Some(active_file_relative.clone()),
    }));
    let monitor_status = Arc::new(Mutex::new(status.clone()));
    let (stop_tx, stop_rx) = oneshot::channel();
    let task = tokio::spawn(run_workspace_monitor_loop(
        app.clone(),
        workspace_id.clone(),
        monitor_config,
        monitor_status.clone(),
        stop_rx,
        watcher,
        watcher_rx,
    ));

    {
        let mut runtime_guard = runtime.lock().await;
        runtime_guard.monitors.insert(
            workspace_id.clone(),
            WorkspaceExternalMonitor {
                stop_tx: Some(stop_tx),
                task,
            },
        );
    }

    if let Some(reason) = status.fallback_reason.clone() {
        emit_watcher_fallback(&app, &workspace_id, active_file_relative, reason).await;
    }

    Ok(status)
}

pub(crate) async fn clear_detached_external_change_monitor_inner(
    runtime: &Mutex<DetachedExternalChangeRuntime>,
    workspace_id: String,
) -> Result<(), String> {
    let removed = {
        let mut runtime_guard = runtime.lock().await;
        runtime_guard.monitors.remove(workspace_id.as_str())
    };
    if let Some(monitor) = removed {
        shutdown_monitor(monitor).await;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{
        dedupe_key, is_active_file_match, normalize_rel_path, resolve_active_relative_path,
        DebouncedState, DetachedExternalFileChangeEvent,
    };
    use std::collections::{HashMap, VecDeque};
    use std::path::Path;

    #[test]
    fn external_changes_normalize_rel_path_basic() {
        assert_eq!(normalize_rel_path("./src\\main.ts"), "src/main.ts");
        assert_eq!(normalize_rel_path("src/main.ts"), "src/main.ts");
    }

    #[test]
    fn external_changes_resolve_active_relative_path() {
        let workspace = Path::new("/repo/demo");
        let result = resolve_active_relative_path(workspace, "src/main.ts").expect("relative path");
        assert_eq!(result, "src/main.ts");
    }

    #[test]
    fn external_changes_active_file_match_normalizes_path_shape() {
        assert!(is_active_file_match(Some("src\\main.ts"), "src/main.ts"));
        assert!(!is_active_file_match(Some("src/main.ts"), "src/other.ts"));
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn external_changes_dedupe_key_is_case_insensitive_on_windows() {
        assert_eq!(dedupe_key("SRC/Main.ts"), "src/main.ts");
    }

    #[cfg(not(target_os = "windows"))]
    #[test]
    fn external_changes_dedupe_key_preserves_case_on_non_windows() {
        assert_eq!(dedupe_key("SRC/Main.ts"), "SRC/Main.ts");
    }

    fn make_event(
        workspace_id: &str,
        normalized_path: &str,
        detected_at_ms: u64,
    ) -> DetachedExternalFileChangeEvent {
        DetachedExternalFileChangeEvent {
            workspace_id: workspace_id.to_string(),
            normalized_path: normalized_path.to_string(),
            mtime_ms: None,
            size: None,
            detected_at_ms,
            source: "test".to_string(),
            event_kind: "modified".to_string(),
            platform: "test".to_string(),
            fallback_reason: None,
        }
    }

    /// Within a single flush window, multiple submissions of the same
    /// `(workspace_id, normalized_path)` key MUST coalesce to a single
    /// queue entry. The latest event wins.
    #[test]
    fn external_changes_debouncer_same_path_coalesce() {
        let mut state = DebouncedState {
            by_key: HashMap::new(),
            queue: VecDeque::new(),
        };
        state.submit(make_event("ws0", "src/a.ts", 1));
        state.submit(make_event("ws0", "src/a.ts", 2));
        state.submit(make_event("ws0", "src/a.ts", 3));
        assert_eq!(
            state.queue.len(),
            1,
            "same-key events must coalesce to 1 entry"
        );
        assert_eq!(state.queue[0].detected_at_ms, 3, "latest event must win");
    }

    /// Different `(workspace_id, normalized_path)` keys within a single
    /// window MUST each be represented, in arrival order.
    #[test]
    fn external_changes_debouncer_cross_path_preserved() {
        let mut state = DebouncedState {
            by_key: HashMap::new(),
            queue: VecDeque::new(),
        };
        state.submit(make_event("ws0", "src/a.ts", 1));
        state.submit(make_event("ws0", "src/b.ts", 2));
        state.submit(make_event("ws1", "src/c.ts", 3));
        assert_eq!(state.queue.len(), 3, "distinct keys must each appear");
        let order: Vec<String> = state
            .queue
            .iter()
            .map(|e| format!("{}/{}", e.workspace_id, e.normalized_path))
            .collect();
        assert_eq!(order, vec!["ws0/src/a.ts", "ws0/src/b.ts", "ws1/src/c.ts"]);
    }

    /// Regression test: after a flush (which clears `by_key`), the next
    /// same-key event MUST start a new coalesce cycle, NOT be silently
    /// dropped. Earlier this function fell through the `if let Some(slot)`
    /// branch when the cached index was out of bounds, losing the event.
    #[test]
    fn external_changes_debouncer_same_key_after_flush_is_not_dropped() {
        let mut state = DebouncedState {
            by_key: HashMap::new(),
            queue: VecDeque::new(),
        };
        state.submit(make_event("ws0", "src/a.ts", 1));
        // Simulate the flush path: drain queue and clear by_key.
        let drained: Vec<DetachedExternalFileChangeEvent> =
            std::mem::take(&mut state.queue).into_iter().collect();
        state.by_key.clear();
        assert_eq!(drained.len(), 1);

        // Second window: same key. The bug would drop this event.
        state.submit(make_event("ws0", "src/a.ts", 2));
        assert_eq!(
            state.queue.len(),
            1,
            "same-key event in the next window must be queued, not dropped"
        );
        assert_eq!(state.queue[0].detected_at_ms, 2);
    }

    /// When nothing has been submitted, the flush path MUST NOT emit a
    /// batch payload. We model the no-op by leaving the queue and by_key
    /// empty and asserting that no spurious entries appear after a
    /// flush-style drain.
    #[test]
    fn external_changes_debouncer_no_empty_batch_emit() {
        let mut state = DebouncedState {
            by_key: HashMap::new(),
            queue: VecDeque::new(),
        };
        let drained: Vec<DetachedExternalFileChangeEvent> =
            std::mem::take(&mut state.queue).into_iter().collect();
        state.by_key.clear();
        assert!(drained.is_empty(), "no events submitted => no batch emit");
        assert!(state.by_key.is_empty());
        assert!(state.queue.is_empty());
    }
}
