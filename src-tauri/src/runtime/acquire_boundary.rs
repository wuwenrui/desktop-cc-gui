#![allow(dead_code)]

// Contract sentinel: this matrix is intentionally exercised by tests and
// OpenSpec evidence, not by production runtime acquisition paths.

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum RuntimeAcquireBoundary {
    Passive,
    HelperLive,
    RuntimeRequired,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) struct RuntimeAcquireBoundaryEntry {
    pub(crate) path: &'static str,
    pub(crate) boundary: RuntimeAcquireBoundary,
    pub(crate) contract: &'static str,
}

pub(crate) const RUNTIME_ACQUIRE_BOUNDARY_MATRIX: &[RuntimeAcquireBoundaryEntry] = &[
    RuntimeAcquireBoundaryEntry {
        path: "session.select_history",
        boundary: RuntimeAcquireBoundary::Passive,
        contract: "Selecting persisted history must read durable state without acquiring runtime.",
    },
    RuntimeAcquireBoundaryEntry {
        path: "session.visibility",
        boundary: RuntimeAcquireBoundary::Passive,
        contract: "Session visibility projection is catalog metadata and must not acquire runtime.",
    },
    RuntimeAcquireBoundaryEntry {
        path: "session.catalog.list_workspace_sessions",
        boundary: RuntimeAcquireBoundary::Passive,
        contract: "Workspace session catalog scans local history and metadata only.",
    },
    RuntimeAcquireBoundaryEntry {
        path: "codex.model_list",
        boundary: RuntimeAcquireBoundary::HelperLive,
        contract: "Model list may require live helper state and must use shared guarded acquire behavior.",
    },
    RuntimeAcquireBoundaryEntry {
        path: "codex.account_rate_limits",
        boundary: RuntimeAcquireBoundary::HelperLive,
        contract: "Rate-limit reads may require live helper state and must use shared guarded acquire behavior.",
    },
    RuntimeAcquireBoundaryEntry {
        path: "codex.thread_list",
        boundary: RuntimeAcquireBoundary::HelperLive,
        contract: "Live thread list may use helper runtime state but must degrade to local durable history.",
    },
    RuntimeAcquireBoundaryEntry {
        path: "runtime.ensure_ready",
        boundary: RuntimeAcquireBoundary::RuntimeRequired,
        contract: "Explicit runtime readiness is a runtime-required action.",
    },
    RuntimeAcquireBoundaryEntry {
        path: "turn.send",
        boundary: RuntimeAcquireBoundary::RuntimeRequired,
        contract: "Sending user input requires a live runtime.",
    },
    RuntimeAcquireBoundaryEntry {
        path: "turn.stop",
        boundary: RuntimeAcquireBoundary::RuntimeRequired,
        contract: "Stopping a turn targets live runtime state.",
    },
];

pub(crate) fn classify_runtime_acquire_boundary(path: &str) -> Option<RuntimeAcquireBoundary> {
    let normalized = path.trim();
    RUNTIME_ACQUIRE_BOUNDARY_MATRIX
        .iter()
        .find(|entry| entry.path == normalized)
        .map(|entry| entry.boundary)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn passive_reads_do_not_classify_as_runtime_required() {
        for path in [
            "session.select_history",
            "session.visibility",
            "session.catalog.list_workspace_sessions",
        ] {
            assert_eq!(
                classify_runtime_acquire_boundary(path),
                Some(RuntimeAcquireBoundary::Passive),
                "{path} must remain passive"
            );
        }
    }

    #[test]
    fn helper_reads_are_not_independent_runtime_required_actions() {
        for path in [
            "codex.model_list",
            "codex.account_rate_limits",
            "codex.thread_list",
        ] {
            assert_eq!(
                classify_runtime_acquire_boundary(path),
                Some(RuntimeAcquireBoundary::HelperLive),
                "{path} must go through shared helper-live guard behavior"
            );
        }
    }

    #[test]
    fn explicit_runtime_actions_remain_runtime_required() {
        for path in ["runtime.ensure_ready", "turn.send", "turn.stop"] {
            assert_eq!(
                classify_runtime_acquire_boundary(path),
                Some(RuntimeAcquireBoundary::RuntimeRequired),
                "{path} must stay explicit runtime-required work"
            );
        }
    }
}
