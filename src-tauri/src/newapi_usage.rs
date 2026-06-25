//! Lawyer copilot: read new-api balance/usage for the configured provider.
//!
//! Reads `env.ANTHROPIC_BASE_URL` / `env.ANTHROPIC_AUTH_TOKEN` from
//! `~/.claude/settings.json` (written by the first-run onboarding wizard),
//! then queries the new-api `GET {base_url}/api/usage/token` endpoint and
//! converts quota units into CNY.
//!
//! New file (fork-friendly): no upstream module is modified here. Only the
//! `mod` declaration in `lib.rs` and the handler list in `command_registry.rs`
//! reference this module.

use std::path::PathBuf;
use std::time::Duration;

use serde::Serialize;
use serde_json::Value;

/// Default quota-per-unit divisor (new-api convention: 500000 quota == 1 USD).
const DEFAULT_QUOTA_PER_UNIT: f64 = 500_000.0;
/// Default USD -> CNY exchange rate fallback when `/api/status` is unavailable.
const DEFAULT_USD_EXCHANGE_RATE: f64 = 7.3;

/// Balance/usage snapshot returned to the frontend. All monetary fields are CNY.
#[derive(Debug, Clone, Serialize, PartialEq)]
pub(crate) struct NewapiUsage {
    /// Total granted quota converted to CNY.
    pub granted_cny: f64,
    /// Already used quota converted to CNY.
    pub used_cny: f64,
    /// Remaining available quota converted to CNY.
    pub available_cny: f64,
    /// True when the token has an unlimited quota (granted is non-positive / sentinel).
    pub unlimited: bool,
}

/// Convert a raw quota value to CNY.
///
/// `CNY = quota / quota_per_unit * usd_exchange_rate`.
/// A non-positive (or zero) `quota_per_unit` falls back to the default to avoid
/// division by zero.
fn quota_to_cny(quota: f64, quota_per_unit: f64, usd_exchange_rate: f64) -> f64 {
    let per_unit = if quota_per_unit > 0.0 {
        quota_per_unit
    } else {
        DEFAULT_QUOTA_PER_UNIT
    };
    quota / per_unit * usd_exchange_rate
}

fn claude_settings_path() -> Result<PathBuf, String> {
    let home = dirs::home_dir().ok_or_else(|| "Cannot determine home directory".to_string())?;
    Ok(home.join(".claude").join("settings.json"))
}

/// Read `(base_url, auth_token)` from `~/.claude/settings.json` `env` block.
/// Returns the "未配置 new-api" error when either value is missing/empty.
pub(crate) fn read_newapi_credentials() -> Result<(String, String), String> {
    let path = claude_settings_path()?;
    if !path.exists() {
        return Err("未配置 new-api".to_string());
    }
    let content =
        std::fs::read_to_string(&path).map_err(|e| format!("读取 settings.json 失败: {e}"))?;
    if content.trim().is_empty() {
        return Err("未配置 new-api".to_string());
    }
    let value: Value =
        serde_json::from_str(&content).map_err(|e| format!("解析 settings.json 失败: {e}"))?;

    let env = value.get("env").and_then(|v| v.as_object());
    let base_url = env
        .and_then(|env| env.get("ANTHROPIC_BASE_URL"))
        .and_then(|v| v.as_str())
        .map(str::trim)
        .filter(|s| !s.is_empty());
    let token = env
        .and_then(|env| env.get("ANTHROPIC_AUTH_TOKEN"))
        .and_then(|v| v.as_str())
        .map(str::trim)
        .filter(|s| !s.is_empty());

    match (base_url, token) {
        (Some(base_url), Some(token)) => Ok((
            base_url.trim_end_matches('/').to_string(),
            token.to_string(),
        )),
        _ => Err("未配置 new-api".to_string()),
    }
}

pub(crate) fn http_client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(10))
        .timeout(Duration::from_secs(20))
        .build()
        .map_err(|e| format!("创建 HTTP 客户端失败: {e}"))
}

/// Read `quota_per_unit` / `usd_exchange_rate` from `GET {base_url}/api/status`.
/// Any failure falls back to the defaults; this endpoint is best-effort only.
async fn fetch_conversion_rates(client: &reqwest::Client, base_url: &str) -> (f64, f64) {
    let url = format!("{base_url}/api/status");
    let parsed: Option<Value> = match client.get(&url).send().await {
        Ok(resp) => resp.json().await.ok(),
        Err(_) => None,
    };

    let data = parsed.as_ref().and_then(|v| v.get("data"));
    let quota_per_unit = data
        .and_then(|d| d.get("quota_per_unit"))
        .and_then(serde_json::Value::as_f64)
        .filter(|v| *v > 0.0)
        .unwrap_or(DEFAULT_QUOTA_PER_UNIT);
    let usd_exchange_rate = data
        .and_then(|d| d.get("usd_exchange_rate"))
        .and_then(serde_json::Value::as_f64)
        .filter(|v| *v > 0.0)
        .unwrap_or(DEFAULT_USD_EXCHANGE_RATE);

    (quota_per_unit, usd_exchange_rate)
}

/// Fetch balance/usage from new-api and convert to CNY.
#[tauri::command]
pub(crate) async fn get_newapi_usage() -> Result<NewapiUsage, String> {
    let (base_url, token) = read_newapi_credentials()?;
    let client = http_client()?;

    let (quota_per_unit, usd_exchange_rate) = fetch_conversion_rates(&client, &base_url).await;

    let url = format!("{base_url}/api/usage/token");
    let response = client
        .get(&url)
        .bearer_auth(&token)
        .send()
        .await
        .map_err(|e| format!("请求用量接口失败: {e}"))?;

    let response = response
        .error_for_status()
        .map_err(|e| format!("用量接口返回错误状态: {e}"))?;

    let body: Value = response
        .json()
        .await
        .map_err(|e| format!("解析用量响应失败: {e}"))?;

    // new-api may wrap the figures under `data` or return them at the top level.
    let payload = body.get("data").unwrap_or(&body);

    let total_granted = payload
        .get("total_granted")
        .and_then(serde_json::Value::as_f64)
        .unwrap_or(0.0);
    let total_used = payload
        .get("total_used")
        .and_then(serde_json::Value::as_f64)
        .unwrap_or(0.0);
    let total_available = payload
        .get("total_available")
        .and_then(serde_json::Value::as_f64)
        .unwrap_or(0.0);

    // new-api 用 `unlimited_quota` 布尔字段标识无限额度 token；
    // total_granted 在无限时可能为 0/正数，不能用它判断。
    let unlimited = payload
        .get("unlimited_quota")
        .and_then(serde_json::Value::as_bool)
        .unwrap_or(false);

    Ok(NewapiUsage {
        granted_cny: quota_to_cny(total_granted, quota_per_unit, usd_exchange_rate),
        used_cny: quota_to_cny(total_used, quota_per_unit, usd_exchange_rate),
        available_cny: quota_to_cny(total_available, quota_per_unit, usd_exchange_rate),
        unlimited,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn converts_quota_with_default_rates() {
        // 500000 quota / 500000 per-unit * 7.3 == 7.3 CNY
        let cny = quota_to_cny(500_000.0, DEFAULT_QUOTA_PER_UNIT, DEFAULT_USD_EXCHANGE_RATE);
        assert!((cny - 7.3).abs() < 1e-9, "expected 7.3, got {cny}");
    }

    #[test]
    fn converts_quota_with_dynamic_rates() {
        // 1_000_000 quota / 1_000_000 per-unit * 7.0 == 7.0 CNY
        let cny = quota_to_cny(1_000_000.0, 1_000_000.0, 7.0);
        assert!((cny - 7.0).abs() < 1e-9, "expected 7.0, got {cny}");
    }

    #[test]
    fn converts_partial_quota() {
        // 250000 quota / 500000 per-unit * 7.3 == 3.65 CNY
        let cny = quota_to_cny(250_000.0, DEFAULT_QUOTA_PER_UNIT, DEFAULT_USD_EXCHANGE_RATE);
        assert!((cny - 3.65).abs() < 1e-9, "expected 3.65, got {cny}");
    }

    #[test]
    fn zero_quota_is_zero_cny() {
        let cny = quota_to_cny(0.0, DEFAULT_QUOTA_PER_UNIT, DEFAULT_USD_EXCHANGE_RATE);
        assert_eq!(cny, 0.0);
    }

    #[test]
    fn non_positive_per_unit_falls_back_to_default() {
        // per_unit <= 0 must fall back to DEFAULT_QUOTA_PER_UNIT (no div-by-zero).
        let cny = quota_to_cny(500_000.0, 0.0, DEFAULT_USD_EXCHANGE_RATE);
        assert!((cny - 7.3).abs() < 1e-9, "expected 7.3, got {cny}");
    }
}
