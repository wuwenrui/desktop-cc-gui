#![allow(dead_code)]

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::fs::File;
use std::hash::Hash;
use std::io::{BufRead, BufReader, Seek, SeekFrom};
use std::path::Path;
use std::sync::{Mutex, MutexGuard};
use std::time::Duration;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ScanCacheKeySignature {
    pub(crate) root_hash: String,
    pub(crate) provider_identity: String,
    pub(crate) scan_options_hash: String,
    pub(crate) source_signature: String,
}

impl ScanCacheKeySignature {
    pub(crate) fn new(
        root_identity: &str,
        provider_identity: &str,
        scan_options: &str,
        source_signature: &str,
    ) -> Self {
        Self {
            root_hash: stable_hash(root_identity),
            provider_identity: provider_identity.to_string(),
            scan_options_hash: stable_hash(scan_options),
            source_signature: source_signature.to_string(),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub(crate) enum ScanCacheState {
    Hit,
    Miss,
    Invalidated,
    Unsupported,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ScanCacheEvidence {
    pub(crate) cache_state: ScanCacheState,
    pub(crate) invalidation_reason: Option<String>,
    pub(crate) key: ScanCacheKeySignature,
}

#[derive(Debug, Clone)]
struct ScanCacheEntry<V> {
    signature: ScanCacheKeySignature,
    value: V,
}

#[derive(Debug)]
pub(crate) struct ScanCache<K, V> {
    entries: Mutex<HashMap<K, ScanCacheEntry<V>>>,
}

impl<K, V> Default for ScanCache<K, V>
where
    K: Eq + Hash,
{
    fn default() -> Self {
        Self {
            entries: Mutex::new(HashMap::new()),
        }
    }
}

impl<K, V> ScanCache<K, V>
where
    K: Clone + Eq + Hash,
    V: Clone,
{
    fn lock_entries(&self) -> MutexGuard<'_, HashMap<K, ScanCacheEntry<V>>> {
        self.entries
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
    }

    pub(crate) fn get_or_compute<F>(
        &self,
        key: K,
        signature: ScanCacheKeySignature,
        compute: F,
    ) -> (V, ScanCacheEvidence)
    where
        F: FnOnce() -> V,
    {
        let existing_entry = {
            let entries = self.lock_entries();
            entries.get(&key).cloned()
        };
        if let Some(entry) = existing_entry.as_ref() {
            if entry.signature == signature {
                return (
                    entry.value.clone(),
                    ScanCacheEvidence {
                        cache_state: ScanCacheState::Hit,
                        invalidation_reason: None,
                        key: signature,
                    },
                );
            }
        }
        let invalidation_reason = existing_entry
            .as_ref()
            .map(|_| "source-signature-changed".to_string());
        let cache_state = if invalidation_reason.is_some() {
            ScanCacheState::Invalidated
        } else {
            ScanCacheState::Miss
        };
        let value = compute();
        let mut entries = self.lock_entries();
        entries.insert(
            key,
            ScanCacheEntry {
                signature: signature.clone(),
                value: value.clone(),
            },
        );
        (
            value,
            ScanCacheEvidence {
                cache_state,
                invalidation_reason,
                key: signature,
            },
        )
    }

    pub(crate) fn get_or_compute_with_signatures<FCurrent, FStored, FCompute>(
        &self,
        key: K,
        current_signature: FCurrent,
        stored_signature: FStored,
        compute: FCompute,
    ) -> (V, ScanCacheEvidence)
    where
        FCurrent: FnOnce(&V) -> ScanCacheKeySignature,
        FStored: FnOnce(&V) -> ScanCacheKeySignature,
        FCompute: FnOnce() -> V,
    {
        let existing_entry = {
            let entries = self.lock_entries();
            entries.get(&key).cloned()
        };
        if let Some(entry) = existing_entry.as_ref() {
            let signature = current_signature(&entry.value);
            if entry.signature == signature {
                return (
                    entry.value.clone(),
                    ScanCacheEvidence {
                        cache_state: ScanCacheState::Hit,
                        invalidation_reason: None,
                        key: signature,
                    },
                );
            }
        }
        let invalidation_reason = existing_entry
            .as_ref()
            .map(|_| "source-signature-changed".to_string());
        let cache_state = if invalidation_reason.is_some() {
            ScanCacheState::Invalidated
        } else {
            ScanCacheState::Miss
        };
        let value = compute();
        let signature = stored_signature(&value);
        let mut entries = self.lock_entries();
        entries.insert(
            key,
            ScanCacheEntry {
                signature: signature.clone(),
                value: value.clone(),
            },
        );
        (
            value,
            ScanCacheEvidence {
                cache_state,
                invalidation_reason,
                key: signature,
            },
        )
    }

    pub(crate) fn invalidate(&self, key: &K) -> bool {
        self.lock_entries().remove(key).is_some()
    }

    pub(crate) fn invalidate_matching<F>(&self, predicate: F) -> usize
    where
        F: Fn(&K) -> bool,
    {
        let mut entries = self.lock_entries();
        let before = entries.len();
        entries.retain(|key, _| !predicate(key));
        before - entries.len()
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct PayloadBudgetMetadata {
    pub(crate) command: String,
    pub(crate) surface_id: String,
    pub(crate) item_count: usize,
    pub(crate) estimated_bytes: usize,
    pub(crate) partial: bool,
    pub(crate) truncated: bool,
    pub(crate) cache_state: ScanCacheState,
    pub(crate) evidence_class: String,
}

pub(crate) fn estimate_json_payload_bytes<T: Serialize>(value: &T) -> usize {
    serde_json::to_vec(value)
        .map(|bytes| bytes.len())
        .unwrap_or(0)
}

pub(crate) fn stable_hash(value: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(value.as_bytes());
    let digest = hasher.finalize();
    format!("{digest:x}")
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct JsonlAppendCursor {
    pub(crate) offset: u64,
    pub(crate) len: u64,
    pub(crate) modified_ms: Option<u128>,
    pub(crate) source_id: Option<u64>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) enum JsonlAppendState {
    AppendOnly,
    FullRescan,
    CorruptFallback,
}

#[derive(Debug)]
pub(crate) struct JsonlAppendRead<T> {
    pub(crate) state: JsonlAppendState,
    pub(crate) cursor: JsonlAppendCursor,
    pub(crate) records: Vec<T>,
}

fn file_modified_ms(path: &Path) -> Option<u128> {
    path.metadata()
        .ok()
        .and_then(|metadata| metadata.modified().ok())
        .and_then(|modified| modified.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|duration| duration.as_millis())
}

#[cfg(unix)]
fn metadata_source_id(metadata: &std::fs::Metadata) -> Option<u64> {
    use std::os::unix::fs::MetadataExt;
    Some(metadata.ino())
}

#[cfg(not(unix))]
fn metadata_source_id(metadata: &std::fs::Metadata) -> Option<u64> {
    Some(metadata.len())
}

#[cfg(unix)]
fn is_append_cursor_compatible(
    cursor: &JsonlAppendCursor,
    len: u64,
    _modified_ms: Option<u128>,
    source_id: Option<u64>,
) -> bool {
    cursor.offset <= len && cursor.len <= len && cursor.source_id == source_id
}

#[cfg(not(unix))]
fn is_append_cursor_compatible(
    cursor: &JsonlAppendCursor,
    len: u64,
    modified_ms: Option<u128>,
    source_id: Option<u64>,
) -> bool {
    cursor.offset <= len
        && cursor.len <= len
        && cursor.source_id == source_id
        && cursor.modified_ms == modified_ms
}

pub(crate) fn read_jsonl_append_only<T>(
    path: &Path,
    previous: Option<&JsonlAppendCursor>,
) -> Result<JsonlAppendRead<T>, String>
where
    T: for<'de> Deserialize<'de>,
{
    let metadata = path
        .metadata()
        .map_err(|error| format!("failed to stat jsonl file: {error}"))?;
    let len = metadata.len();
    let modified_ms = file_modified_ms(path);
    let source_id = metadata_source_id(&metadata);
    let mut state = JsonlAppendState::AppendOnly;
    let start_offset = match previous {
        Some(cursor) if is_append_cursor_compatible(cursor, len, modified_ms, source_id) => {
            cursor.offset
        }
        Some(_) => {
            state = JsonlAppendState::FullRescan;
            0
        }
        None => {
            state = JsonlAppendState::FullRescan;
            0
        }
    };

    let mut file =
        File::open(path).map_err(|error| format!("failed to open jsonl file: {error}"))?;
    file.seek(SeekFrom::Start(start_offset))
        .map_err(|error| format!("failed to seek jsonl file: {error}"))?;
    let reader = BufReader::new(file);
    let mut records = Vec::new();
    for line in reader.lines() {
        let line = line.map_err(|error| format!("failed to read jsonl line: {error}"))?;
        if line.trim().is_empty() {
            continue;
        }
        match serde_json::from_str::<T>(&line) {
            Ok(record) => records.push(record),
            Err(_) if start_offset > 0 => {
                return read_jsonl_append_only::<T>(path, None).map(|mut full| {
                    full.state = JsonlAppendState::CorruptFallback;
                    full
                });
            }
            Err(error) => return Err(format!("failed to parse jsonl line: {error}")),
        }
    }

    Ok(JsonlAppendRead {
        state,
        cursor: JsonlAppendCursor {
            offset: len,
            len,
            modified_ms,
            source_id,
        },
        records,
    })
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) enum BlockingWorkState {
    Completed,
    TimeoutPartial,
    JoinError,
}

#[derive(Debug)]
pub(crate) struct BlockingWorkResult<T> {
    pub(crate) state: BlockingWorkState,
    pub(crate) value: Option<T>,
}

pub(crate) async fn run_blocking_with_timeout<T, F>(
    timeout_duration: Duration,
    fallback: T,
    work: F,
) -> BlockingWorkResult<T>
where
    T: Send + 'static,
    F: FnOnce() -> T + Send + 'static,
{
    match tokio::time::timeout(timeout_duration, tokio::task::spawn_blocking(work)).await {
        Ok(Ok(value)) => BlockingWorkResult {
            state: BlockingWorkState::Completed,
            value: Some(value),
        },
        Ok(Err(_)) => BlockingWorkResult {
            state: BlockingWorkState::JoinError,
            value: Some(fallback),
        },
        Err(_) => BlockingWorkResult {
            state: BlockingWorkState::TimeoutPartial,
            value: Some(fallback),
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::Value;
    use std::fs;
    use std::io::Write;
    use std::time::Duration;

    #[test]
    fn scan_cache_reports_hit_miss_and_invalidation() {
        let cache = ScanCache::<String, Vec<String>>::default();
        let key = "workspace:claude".to_string();
        let signature_v1 =
            ScanCacheKeySignature::new("/secret/root", "claude", "limit=10", "mtime=1");
        let signature_v2 =
            ScanCacheKeySignature::new("/secret/root", "claude", "limit=10", "mtime=2");

        let (first, first_evidence) =
            cache.get_or_compute(key.clone(), signature_v1.clone(), || vec!["a".to_string()]);
        assert_eq!(first, vec!["a".to_string()]);
        assert_eq!(first_evidence.cache_state, ScanCacheState::Miss);
        assert_ne!(first_evidence.key.root_hash, "/secret/root");

        let (second, second_evidence) =
            cache.get_or_compute(key.clone(), signature_v1, || vec!["b".to_string()]);
        assert_eq!(second, vec!["a".to_string()]);
        assert_eq!(second_evidence.cache_state, ScanCacheState::Hit);

        let (third, third_evidence) =
            cache.get_or_compute(key.clone(), signature_v2, || vec!["c".to_string()]);
        assert_eq!(third, vec!["c".to_string()]);
        assert_eq!(third_evidence.cache_state, ScanCacheState::Invalidated);
        assert_eq!(
            third_evidence.invalidation_reason.as_deref(),
            Some("source-signature-changed")
        );

        assert!(cache.invalidate(&key));
        assert_eq!(
            cache.invalidate_matching(|candidate| candidate.starts_with("workspace")),
            0
        );
    }

    #[test]
    fn jsonl_append_reader_handles_append_truncate_and_corrupt_fallback() {
        let dir = std::env::temp_dir().join(format!("ccgui-backend-budget-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).expect("create tempdir");
        let path = dir.join("events.jsonl");
        fs::write(&path, "{\"id\":1}\n").expect("write initial");

        let first = read_jsonl_append_only::<Value>(&path, None).expect("initial read");
        assert_eq!(first.state, JsonlAppendState::FullRescan);
        assert_eq!(first.records.len(), 1);

        fs::OpenOptions::new()
            .append(true)
            .open(&path)
            .expect("open append")
            .write_all(b"{\"id\":2}\n")
            .expect("append");
        let second =
            read_jsonl_append_only::<Value>(&path, Some(&first.cursor)).expect("append read");
        assert_eq!(second.state, JsonlAppendState::AppendOnly);
        assert_eq!(second.records.len(), 1);

        fs::write(&path, "{\"id\":3}\n").expect("truncate rewrite");
        let third =
            read_jsonl_append_only::<Value>(&path, Some(&second.cursor)).expect("truncate read");
        assert_eq!(third.state, JsonlAppendState::FullRescan);
        assert_eq!(third.records.len(), 1);

        fs::OpenOptions::new()
            .append(true)
            .open(&path)
            .expect("open corrupt append")
            .write_all(b"{bad-json}\n")
            .expect("corrupt append");
        let error = read_jsonl_append_only::<Value>(&path, None).expect_err("corrupt full parse");
        assert!(error.contains("failed to parse jsonl line"));
        let _ = fs::remove_dir_all(&dir);
    }

    #[tokio::test]
    async fn blocking_helper_returns_partial_fallback_on_timeout() {
        let result = run_blocking_with_timeout(Duration::from_millis(1), "partial", || {
            std::thread::sleep(Duration::from_millis(25));
            "complete"
        })
        .await;

        assert_eq!(result.state, BlockingWorkState::TimeoutPartial);
        assert_eq!(result.value, Some("partial"));
    }
}
