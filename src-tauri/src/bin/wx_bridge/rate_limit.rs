//! Per-WeChat outbound reply rate limiting.
//!
//! This process-local guard smooths live automatic replies. Persistent
//! idempotency remains in `dedup`; this layer prevents reply bursts.

use std::collections::{HashMap, VecDeque};
use std::sync::Mutex;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ReplyRateLimitConfig {
    pub min_interval_ms: u64,
    pub max_replies: usize,
    pub window_secs: i64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ReplyRateLimitDecision {
    Allow,
    Limited { retry_after_secs: i64 },
}

pub struct ReplyRateLimiter {
    config: ReplyRateLimitConfig,
    entries: Mutex<HashMap<String, VecDeque<i64>>>,
}

impl ReplyRateLimiter {
    #[cfg(test)]
    pub fn new(max_replies: usize, window_secs: i64) -> Self {
        Self::with_config(ReplyRateLimitConfig {
            min_interval_ms: 0,
            max_replies,
            window_secs,
        })
    }

    pub fn with_config(config: ReplyRateLimitConfig) -> Self {
        Self {
            config,
            entries: Mutex::new(HashMap::new()),
        }
    }

    pub fn check_and_record(
        &self,
        wxid: &str,
        now_secs: i64,
    ) -> Result<ReplyRateLimitDecision, String> {
        let mut entries = self
            .entries
            .lock()
            .map_err(|_| "reply rate limiter lock poisoned".to_string())?;
        let window_secs = self.config.window_secs.max(1);
        let cutoff = now_secs - window_secs;
        let history = entries.entry(wxid.to_string()).or_default();
        while history.front().is_some_and(|ts| *ts <= cutoff) {
            history.pop_front();
        }

        let min_interval_secs = min_interval_secs(self.config.min_interval_ms);
        if min_interval_secs > 0 {
            if let Some(last_reply_at) = history.back() {
                let retry_after_secs = last_reply_at + min_interval_secs - now_secs;
                if retry_after_secs > 0 {
                    return Ok(ReplyRateLimitDecision::Limited { retry_after_secs });
                }
            }
        }

        if self.config.max_replies > 0 && history.len() >= self.config.max_replies {
            let oldest = history.front().copied().unwrap_or(now_secs);
            let retry_after_secs = (oldest + window_secs - now_secs).max(1);
            return Ok(ReplyRateLimitDecision::Limited { retry_after_secs });
        }

        history.push_back(now_secs);
        Ok(ReplyRateLimitDecision::Allow)
    }
}

fn min_interval_secs(min_interval_ms: u64) -> i64 {
    if min_interval_ms == 0 {
        return 0;
    }
    min_interval_ms.div_ceil(1000) as i64
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn limits_same_wxid_within_window() {
        let limiter = ReplyRateLimiter::new(1, 60);

        assert_eq!(
            limiter.check_and_record("wx-a", 1000).unwrap(),
            ReplyRateLimitDecision::Allow
        );
        assert_eq!(
            limiter.check_and_record("wx-a", 1001).unwrap(),
            ReplyRateLimitDecision::Limited {
                retry_after_secs: 59
            }
        );
    }

    #[test]
    fn tracks_wxids_independently() {
        let limiter = ReplyRateLimiter::new(1, 60);

        assert_eq!(
            limiter.check_and_record("wx-a", 1000).unwrap(),
            ReplyRateLimitDecision::Allow
        );
        assert_eq!(
            limiter.check_and_record("wx-b", 1001).unwrap(),
            ReplyRateLimitDecision::Allow
        );
    }

    #[test]
    fn supports_min_reply_interval() {
        let limiter = ReplyRateLimiter::with_config(ReplyRateLimitConfig {
            min_interval_ms: 1500,
            max_replies: 20,
            window_secs: 60,
        });

        assert_eq!(
            limiter.check_and_record("wx-a", 1000).unwrap(),
            ReplyRateLimitDecision::Allow
        );
        assert_eq!(
            limiter.check_and_record("wx-a", 1001).unwrap(),
            ReplyRateLimitDecision::Limited {
                retry_after_secs: 1
            }
        );
        assert_eq!(
            limiter.check_and_record("wx-a", 1002).unwrap(),
            ReplyRateLimitDecision::Allow
        );
    }
}
