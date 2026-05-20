use std::sync::Arc;
use tokio::sync::Notify;

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct RuntimeAcquireToken {
    pub(crate) key: String,
    pub(crate) nonce: String,
}

#[derive(Debug, Clone)]
pub(super) struct RuntimeAcquireGateEntry {
    pub(super) notify: Arc<Notify>,
    pub(super) token: RuntimeAcquireToken,
    pub(super) started_at_ms: u64,
}

#[derive(Debug, Clone)]
pub(crate) enum RuntimeAcquireGate {
    Leader(RuntimeAcquireToken),
    Waiter(Arc<Notify>),
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) enum RuntimeAcquireDisposition {
    Leader(RuntimeAcquireToken),
    Retry,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(super) struct RuntimeReplacementToken {
    pub(super) key: String,
    pub(super) nonce: String,
}

#[derive(Debug, Clone)]
pub(super) struct RuntimeReplacementGateEntry {
    pub(super) notify: Arc<Notify>,
    pub(super) token: RuntimeReplacementToken,
}

#[derive(Debug, Clone)]
pub(super) enum RuntimeReplacementGate {
    Leader(RuntimeReplacementToken),
    Waiter(Arc<Notify>),
}
