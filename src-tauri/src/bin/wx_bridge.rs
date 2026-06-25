//! wx_bridge - WeChat ClawBot <-> cc_gui_daemon bridge.
//!
//! Self-contained binary. Lawyers drive their own local desktop (cc_gui_daemon)
//! from their personal WeChat through a transport (WeClaw) that hands normalized
//! messages to this bridge. The bridge applies dedup/policy/redaction/audit,
//! calls the daemon's JSON-RPC, and returns a lawyer-facing reply.
//!
//! Architecture (per lawyer, all loopback on their own machine):
//!   WeChat <-> WeClaw <--HTTP(OpenAI)--> wx_bridge <--JSON-RPC :4732--> cc_gui_daemon

#[path = "wx_bridge/audit.rs"]
mod audit;
#[path = "wx_bridge/daemon_link.rs"]
mod daemon_link;
#[path = "wx_bridge/dedup.rs"]
mod dedup;
#[path = "wx_bridge/entitlement.rs"]
mod entitlement;
#[path = "wx_bridge/pipeline.rs"]
mod pipeline;
#[path = "wx_bridge/policy.rs"]
mod policy;
#[path = "wx_bridge/rate_limit.rs"]
mod rate_limit;
#[path = "wx_bridge/redactor.rs"]
mod redactor;
#[path = "wx_bridge/remote_control.rs"]
mod remote_control;
#[path = "wx_bridge/server.rs"]
mod server;
#[path = "wx_bridge/session_map.rs"]
mod session_map;
#[path = "wx_bridge/types.rs"]
mod types;

use std::path::PathBuf;
use std::sync::Arc;

use dedup::Dedup;
use pipeline::{Deps, TurnLocks};
use redactor::RedactionMode;
use session_map::SessionMap;

const DEFAULT_DAEMON_HOST: &str = "127.0.0.1:4732";
const DEFAULT_LISTEN: &str = "127.0.0.1:18012";
const DEFAULT_WORKSPACE: &str = "default";
const DEDUP_TTL_SECS: i64 = 24 * 60 * 60;
const MAX_REPLY_LEN: usize = 1200;
const DEFAULT_MIN_REPLY_INTERVAL_MS: u64 = 1500;
const DEFAULT_MAX_REPLIES_PER_MINUTE: usize = 20;

struct Args {
    daemon_host: String,
    token: Option<String>,
    listen: String,
    default_workspace: String,
    data_dir: String,
    allow_full_reply: bool,
    min_reply_interval_ms: u64,
    max_replies_per_minute: usize,
}

fn default_data_dir() -> String {
    let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
    format!("{home}/.wx_bridge")
}

fn parse_args() -> Result<Args, String> {
    parse_args_from(std::env::args().skip(1))
}

fn parse_args_from<I, S>(raw_args: I) -> Result<Args, String>
where
    I: IntoIterator<Item = S>,
    S: Into<String>,
{
    let mut args = Args {
        daemon_host: DEFAULT_DAEMON_HOST.to_string(),
        token: None,
        listen: DEFAULT_LISTEN.to_string(),
        default_workspace: DEFAULT_WORKSPACE.to_string(),
        data_dir: default_data_dir(),
        allow_full_reply: true,
        min_reply_interval_ms: DEFAULT_MIN_REPLY_INTERVAL_MS,
        max_replies_per_minute: DEFAULT_MAX_REPLIES_PER_MINUTE,
    };
    let mut it = raw_args.into_iter().map(Into::into);
    while let Some(arg) = it.next() {
        match arg.as_str() {
            "--daemon-host" => {
                args.daemon_host = it.next().ok_or("--daemon-host requires a value")?
            }
            "--token" => args.token = Some(it.next().ok_or("--token requires a value")?),
            "--listen" => args.listen = it.next().ok_or("--listen requires a value")?,
            "--default-workspace" => {
                args.default_workspace = it.next().ok_or("--default-workspace requires a value")?
            }
            "--data-dir" => args.data_dir = it.next().ok_or("--data-dir requires a value")?,
            // Retained for compatibility: full WeChat replies are now the default.
            "--allow-full-reply" => args.allow_full_reply = true,
            "--min-reply-interval-ms" => {
                args.min_reply_interval_ms = it
                    .next()
                    .ok_or("--min-reply-interval-ms requires a value")?
                    .parse()
                    .map_err(|_| "--min-reply-interval-ms must be a positive integer")?;
            }
            "--max-replies-per-minute" => {
                args.max_replies_per_minute = it
                    .next()
                    .ok_or("--max-replies-per-minute requires a value")?
                    .parse()
                    .map_err(|_| "--max-replies-per-minute must be a positive integer")?;
            }
            "-h" | "--help" => {
                println!(
                    "wx_bridge - WeChat <-> cc_gui_daemon bridge\n\n\
                     --daemon-host <addr>       daemon address (default {DEFAULT_DAEMON_HOST})\n\
                     --token <token>            daemon shared token (REQUIRED in production)\n\
                     --listen <addr>            inbound HTTP listen addr (default {DEFAULT_LISTEN})\n\
                     --default-workspace <id>   workspace id for unbound lawyers\n\
                     --data-dir <path>          dedup db + audit log dir\n\
                     --min-reply-interval-ms <n> minimum interval between replies per WeChat id\n\
                     --max-replies-per-minute <n> maximum replies per minute per WeChat id\n\
                     --allow-full-reply         kept for compatibility; full WeChat replies are default"
                );
                std::process::exit(0);
            }
            other => return Err(format!("unknown argument: {other}")),
        }
    }
    Ok(args)
}

#[tokio::main]
async fn main() {
    let args = match parse_args() {
        Ok(a) => a,
        Err(e) => {
            eprintln!("wx_bridge: {e}");
            std::process::exit(2);
        }
    };

    if let Err(e) = std::fs::create_dir_all(&args.data_dir) {
        eprintln!("wx_bridge: cannot create data dir {}: {e}", args.data_dir);
        std::process::exit(1);
    }
    let media_dir = PathBuf::from(&args.data_dir).join("media");
    if let Err(e) = std::fs::create_dir_all(&media_dir) {
        eprintln!(
            "wx_bridge: cannot create media dir {}: {e}",
            media_dir.display()
        );
        std::process::exit(1);
    }

    // G0: refuse to run against a no-auth daemon in a real deployment.
    if args.token.is_none() {
        eprintln!(
            "wx_bridge: refusing to start without --token (no-auth daemons are dev-only). \
             Generate a token in the desktop app and pass it via --token."
        );
        std::process::exit(2);
    }

    let dedup = match Dedup::open(&format!("{}/dedup.sqlite", args.data_dir)) {
        Ok(d) => d,
        Err(e) => {
            eprintln!("wx_bridge: cannot open dedup store: {e}");
            std::process::exit(1);
        }
    };

    let entitlement = match entitlement::EntitlementChecker::required_from_env() {
        Ok(checker) => Some(checker),
        Err(error) => {
            eprintln!("wx_bridge: entitlement checker error: {error}");
            std::process::exit(1);
        }
    };

    let deps = Arc::new(Deps {
        daemon_host: args.daemon_host.clone(),
        token: args.token.clone(),
        entitlement,
        default_workspace: args.default_workspace,
        redaction_mode: if args.allow_full_reply {
            RedactionMode::Full
        } else {
            RedactionMode::Summarized
        },
        max_reply_len: MAX_REPLY_LEN,
        media_dir: media_dir.to_string_lossy().to_string(),
        reply_rate_limiter: rate_limit::ReplyRateLimiter::with_config(
            rate_limit::ReplyRateLimitConfig {
                min_interval_ms: args.min_reply_interval_ms,
                max_replies: args.max_replies_per_minute,
                window_secs: 60,
            },
        ),
        dedup_ttl_secs: DEDUP_TTL_SECS,
        dedup,
        sessions: SessionMap::new(),
        turn_locks: TurnLocks::new(),
        audit: audit::Audit::new(format!("{}/audit.log", args.data_dir)),
    });

    println!(
        "wx_bridge: listening on {} -> daemon {}",
        args.listen, args.daemon_host
    );
    if let Err(e) = server::serve(deps, &args.listen).await {
        eprintln!("wx_bridge: server error: {e}");
        std::process::exit(1);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_reply_rate_limit_flags() {
        let args = parse_args_from([
            "--token",
            "tok",
            "--min-reply-interval-ms",
            "2500",
            "--max-replies-per-minute",
            "12",
        ])
        .unwrap();

        assert_eq!(args.min_reply_interval_ms, 2500);
        assert_eq!(args.max_replies_per_minute, 12);
    }

    #[test]
    fn defaults_to_full_wechat_reply() {
        let args = parse_args_from(["--token", "tok"]).unwrap();

        assert!(args.allow_full_reply);
    }
}
