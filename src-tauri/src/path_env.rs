use std::sync::mpsc;
use std::time::Duration;

const STARTUP_PATH_ENV_TIMEOUT: Duration = Duration::from_millis(1500);

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum PathEnvSyncOutcome {
    Synced,
    Failed(String),
    TimedOut,
}

pub fn run_path_env_fix_with_timeout<F>(fix: F, timeout: Duration) -> PathEnvSyncOutcome
where
    F: FnOnce() -> Result<(), String> + Send + 'static,
{
    let (tx, rx) = mpsc::channel();
    std::thread::spawn(move || {
        let _ = tx.send(fix());
    });

    match rx.recv_timeout(timeout) {
        Ok(Ok(())) => PathEnvSyncOutcome::Synced,
        Ok(Err(error)) => PathEnvSyncOutcome::Failed(error),
        Err(mpsc::RecvTimeoutError::Timeout) => PathEnvSyncOutcome::TimedOut,
        Err(mpsc::RecvTimeoutError::Disconnected) => {
            PathEnvSyncOutcome::Failed("PATH sync worker disconnected".to_string())
        }
    }
}

pub fn sync_path_env_at_startup() {
    match run_path_env_fix_with_timeout(
        || fix_path_env::fix().map_err(|error| error.to_string()),
        STARTUP_PATH_ENV_TIMEOUT,
    ) {
        PathEnvSyncOutcome::Synced => {}
        PathEnvSyncOutcome::Failed(error) => {
            eprintln!("Failed to sync PATH from shell: {error}");
        }
        PathEnvSyncOutcome::TimedOut => {
            eprintln!("Timed out syncing PATH from shell; continuing startup.");
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::Duration;

    #[test]
    fn path_env_sync_reports_success() {
        let outcome = run_path_env_fix_with_timeout(|| Ok(()), Duration::from_millis(50));

        assert_eq!(outcome, PathEnvSyncOutcome::Synced);
    }

    #[test]
    fn path_env_sync_reports_error() {
        let outcome = run_path_env_fix_with_timeout(
            || Err("shell failed".to_string()),
            Duration::from_millis(50),
        );

        assert_eq!(
            outcome,
            PathEnvSyncOutcome::Failed("shell failed".to_string())
        );
    }

    #[test]
    fn path_env_sync_times_out_without_blocking_startup() {
        let outcome = run_path_env_fix_with_timeout(
            || {
                std::thread::sleep(Duration::from_millis(200));
                Ok(())
            },
            Duration::from_millis(10),
        );

        assert_eq!(outcome, PathEnvSyncOutcome::TimedOut);
    }
}
