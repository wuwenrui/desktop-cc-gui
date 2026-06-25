use std::collections::HashMap;
use std::path::Path;

use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};

const MODEL_SITE_BASE_URL: &str = "https://model.codingrui.work";
const MODEL_SITE_HOST: &str = "model.codingrui.work";
const WECHAT_BRIDGE_FEATURE_KEY: &str = "wechat_bridge";

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
pub(crate) struct NewapiFeatureEntitlement {
    pub feature_key: String,
    pub active: bool,
    pub expires_at: i64,
    pub plan_id: i64,
    pub plan_title: String,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
pub(crate) struct NewapiEntitlements {
    pub features: HashMap<String, bool>,
    pub entitlements: HashMap<String, NewapiFeatureEntitlement>,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
pub(crate) struct NewapiWechatBridgeManualSubscriptionOrder {
    pub trade_no: String,
    pub money: f64,
    pub payment_method: String,
    pub payment_name: String,
    pub qr_url: String,
    pub instructions: String,
    pub plan: Value,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
pub(crate) struct NewapiSubscriptionPlanDto {
    pub plan: Value,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct NewapiEntitlementAccount {
    pub base_url: String,
    pub has_token: bool,
    pub token_preview: Option<String>,
    pub source: String,
}

#[derive(Debug, Clone, PartialEq)]
struct ResolvedEntitlementCredentials {
    base_url: String,
    token: String,
    source: String,
}

#[derive(Debug, Deserialize)]
struct ApiEnvelope<T> {
    success: bool,
    message: Option<String>,
    data: Option<T>,
}

fn api_error(message: Option<String>) -> String {
    message
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| "模型站点返回失败".to_string())
}

async fn parse_api_response<T: for<'de> Deserialize<'de>>(
    response: reqwest::Response,
) -> Result<T, String> {
    let response = response
        .error_for_status()
        .map_err(|error| format!("模型站点返回错误状态: {error}"))?;
    let envelope: ApiEnvelope<T> = response
        .json()
        .await
        .map_err(|error| format!("解析模型站点响应失败: {error}"))?;
    if !envelope.success {
        return Err(api_error(envelope.message));
    }
    envelope
        .data
        .ok_or_else(|| "模型站点响应缺少 data".to_string())
}

fn normalize_model_site_base_url(value: &str) -> String {
    let trimmed = value.trim().trim_end_matches('/');
    if trimmed.is_empty() {
        MODEL_SITE_BASE_URL.to_string()
    } else {
        trimmed.to_string()
    }
}

fn is_model_site_base_url(value: &str) -> bool {
    let normalized = normalize_model_site_base_url(value);
    reqwest::Url::parse(&normalized)
        .ok()
        .and_then(|url| {
            url.host_str()
                .map(|host| host.eq_ignore_ascii_case(MODEL_SITE_HOST))
        })
        .unwrap_or(false)
}

fn non_empty_string(value: Option<&Value>) -> Option<String> {
    value
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(String::from)
}

fn token_preview(token: &str) -> Option<String> {
    let trimmed = token.trim();
    if trimmed.is_empty() {
        return None;
    }
    let chars = trimmed.chars().collect::<Vec<_>>();
    if chars.len() <= 8 {
        return Some("已配置".to_string());
    }
    let prefix = chars.iter().take(3).collect::<String>();
    let suffix = chars
        .iter()
        .skip(chars.len().saturating_sub(4))
        .collect::<String>();
    Some(format!("{prefix}...{suffix}"))
}

fn account_from_credentials(
    credentials: ResolvedEntitlementCredentials,
    has_token: bool,
) -> NewapiEntitlementAccount {
    NewapiEntitlementAccount {
        base_url: credentials.base_url,
        has_token,
        token_preview: token_preview(&credentials.token),
        source: credentials.source,
    }
}

fn missing_account() -> NewapiEntitlementAccount {
    NewapiEntitlementAccount {
        base_url: MODEL_SITE_BASE_URL.to_string(),
        has_token: false,
        token_preview: None,
        source: "missing".to_string(),
    }
}

fn explicit_entitlement_credentials_from_config_value(
    config: &Value,
) -> Option<ResolvedEntitlementCredentials> {
    let model_site = config.get("advancedFeatures")?.get("modelSite")?;
    let token = non_empty_string(model_site.get("apiKey"))?;
    let base_url = normalize_model_site_base_url(
        &non_empty_string(model_site.get("baseUrl"))
            .unwrap_or_else(|| MODEL_SITE_BASE_URL.to_string()),
    );
    Some(ResolvedEntitlementCredentials {
        base_url,
        token,
        source: "explicit".to_string(),
    })
}

fn provider_entitlement_credentials(provider: &Value) -> Option<ResolvedEntitlementCredentials> {
    let env = provider.get("settingsConfig")?.get("env")?.as_object()?;
    let base_url = non_empty_string(env.get("ANTHROPIC_BASE_URL"))?;
    if !is_model_site_base_url(&base_url) {
        return None;
    }
    let token = non_empty_string(env.get("ANTHROPIC_AUTH_TOKEN"))?;
    Some(ResolvedEntitlementCredentials {
        base_url: normalize_model_site_base_url(&base_url),
        token,
        source: "provider".to_string(),
    })
}

fn provider_entitlement_credentials_from_config_value(
    config: &Value,
) -> Option<ResolvedEntitlementCredentials> {
    let claude = config.get("claude")?;
    let providers = claude.get("providers")?.as_object()?;
    if let Some(current_id) = claude.get("current").and_then(Value::as_str) {
        if let Some(credentials) = providers
            .get(current_id)
            .and_then(provider_entitlement_credentials)
        {
            return Some(credentials);
        }
    }

    let mut provider_ids = providers.keys().collect::<Vec<_>>();
    provider_ids.sort();
    provider_ids
        .into_iter()
        .filter_map(|provider_id| providers.get(provider_id))
        .find_map(provider_entitlement_credentials)
}

fn entitlement_credentials_from_config_value(
    config: &Value,
) -> Option<ResolvedEntitlementCredentials> {
    explicit_entitlement_credentials_from_config_value(config)
        .or_else(|| provider_entitlement_credentials_from_config_value(config))
}

fn read_config_value_from_path(path: &Path) -> Result<Value, String> {
    if !path.exists() {
        return Ok(Value::Object(Map::new()));
    }
    let content =
        std::fs::read_to_string(path).map_err(|error| format!("读取高级功能配置失败: {error}"))?;
    if content.trim().is_empty() {
        return Ok(Value::Object(Map::new()));
    }
    serde_json::from_str(&content).map_err(|error| format!("解析高级功能配置失败: {error}"))
}

fn read_config_value() -> Result<Value, String> {
    let path = crate::app_paths::config_file_path()?;
    read_config_value_from_path(&path)
}

fn write_config_value_to_path(path: &Path, config: &Value) -> Result<(), String> {
    let content = serde_json::to_string_pretty(config)
        .map_err(|error| format!("序列化高级功能配置失败: {error}"))?;
    crate::storage::write_string_atomically(path, &content)
}

fn upsert_explicit_entitlement_credentials(config: &mut Value, base_url: &str, token: &str) {
    if !config.is_object() {
        *config = Value::Object(Map::new());
    }
    let root = config.as_object_mut().expect("config object initialized");
    let advanced_features = root
        .entry("advancedFeatures")
        .or_insert_with(|| Value::Object(Map::new()));
    if !advanced_features.is_object() {
        *advanced_features = Value::Object(Map::new());
    }
    let advanced_features = advanced_features
        .as_object_mut()
        .expect("advancedFeatures object initialized");
    advanced_features.insert(
        "modelSite".to_string(),
        serde_json::json!({
            "baseUrl": normalize_model_site_base_url(base_url),
            "apiKey": token.trim(),
        }),
    );
}

fn persist_explicit_entitlement_credentials(
    credentials: &ResolvedEntitlementCredentials,
) -> Result<(), String> {
    let path = crate::app_paths::config_file_path()?;
    crate::storage::with_storage_lock(&path, || {
        let mut config = read_config_value_from_path(&path)?;
        upsert_explicit_entitlement_credentials(
            &mut config,
            &credentials.base_url,
            &credentials.token,
        );
        write_config_value_to_path(&path, &config)
    })
}

fn claude_settings_entitlement_credentials(
) -> Result<Option<ResolvedEntitlementCredentials>, String> {
    let (base_url, token) = crate::newapi_usage::read_newapi_credentials()?;
    if !is_model_site_base_url(&base_url) {
        return Ok(None);
    }
    Ok(Some(ResolvedEntitlementCredentials {
        base_url: normalize_model_site_base_url(&base_url),
        token,
        source: "claude_settings".to_string(),
    }))
}

fn read_newapi_entitlement_credentials_resolved() -> Result<ResolvedEntitlementCredentials, String>
{
    let config = read_config_value()?;
    if let Some(credentials) = entitlement_credentials_from_config_value(&config) {
        return Ok(credentials);
    }
    match claude_settings_entitlement_credentials()? {
        Some(credentials) => Ok(credentials),
        None => Err("未配置模型站点账号 Key，请在高级功能里配置。".to_string()),
    }
}

async fn fetch_entitlements_with_credentials(
    base_url: &str,
    token: &str,
) -> Result<NewapiEntitlements, String> {
    let client = crate::newapi_usage::http_client()?;
    let response = client
        .get(format!("{base_url}/api/entitlements/self"))
        .bearer_auth(token)
        .send()
        .await
        .map_err(|error| format!("请求权益接口失败: {error}"))?;
    parse_api_response(response).await
}

pub(crate) async fn require_wechat_bridge_entitlement() -> Result<(), String> {
    let entitlements = get_newapi_entitlements().await?;
    if entitlements
        .features
        .get(WECHAT_BRIDGE_FEATURE_KEY)
        .copied()
        .unwrap_or(false)
    {
        return Ok(());
    }
    Err("微信高级功能未开通或已过期，请先在模型站点开通。".to_string())
}

pub(crate) fn read_newapi_entitlement_credentials() -> Result<(String, String), String> {
    let credentials = read_newapi_entitlement_credentials_resolved()?;
    Ok((credentials.base_url, credentials.token))
}

#[tauri::command]
pub(crate) async fn get_newapi_entitlement_account() -> Result<NewapiEntitlementAccount, String> {
    let config = read_config_value()?;
    if let Some(credentials) = explicit_entitlement_credentials_from_config_value(&config) {
        return Ok(account_from_credentials(credentials, true));
    }
    if let Some(credentials) = provider_entitlement_credentials_from_config_value(&config) {
        if let Err(error) = persist_explicit_entitlement_credentials(&credentials) {
            eprintln!("[newapi_entitlements] failed to persist provider entitlement key: {error}");
        }
        return Ok(account_from_credentials(credentials, true));
    }
    if let Some(credentials) = claude_settings_entitlement_credentials()? {
        if let Err(error) = persist_explicit_entitlement_credentials(&credentials) {
            eprintln!("[newapi_entitlements] failed to persist claude entitlement key: {error}");
        }
        return Ok(account_from_credentials(credentials, true));
    }
    Ok(missing_account())
}

#[tauri::command]
pub(crate) async fn save_newapi_entitlement_account(
    base_url: String,
    api_key: String,
) -> Result<NewapiEntitlementAccount, String> {
    let token = api_key.trim();
    if token.is_empty() {
        return Err("模型站点账号 Key 不能为空".to_string());
    }
    let credentials = ResolvedEntitlementCredentials {
        base_url: normalize_model_site_base_url(&base_url),
        token: token.to_string(),
        source: "explicit".to_string(),
    };
    persist_explicit_entitlement_credentials(&credentials)?;
    Ok(account_from_credentials(credentials, true))
}

#[tauri::command]
pub(crate) async fn get_newapi_entitlements() -> Result<NewapiEntitlements, String> {
    let (base_url, token) = read_newapi_entitlement_credentials()?;
    fetch_entitlements_with_credentials(&base_url, &token).await
}

#[tauri::command]
pub(crate) async fn get_wechat_bridge_subscription_plans(
) -> Result<Vec<NewapiSubscriptionPlanDto>, String> {
    let (base_url, token) = read_newapi_entitlement_credentials()?;
    let client = crate::newapi_usage::http_client()?;
    let response = client
        .get(format!("{base_url}/api/entitlements/wechat-bridge/plans"))
        .bearer_auth(token)
        .send()
        .await
        .map_err(|error| format!("获取微信高级功能套餐失败: {error}"))?;
    parse_api_response(response).await
}

#[tauri::command]
pub(crate) async fn create_wechat_bridge_manual_subscription_order(
    plan_id: i64,
    payment_method: String,
) -> Result<NewapiWechatBridgeManualSubscriptionOrder, String> {
    let (base_url, token) = read_newapi_entitlement_credentials()?;
    let client = crate::newapi_usage::http_client()?;
    let response = client
        .post(format!(
            "{base_url}/api/entitlements/wechat-bridge/manual-pay"
        ))
        .bearer_auth(token)
        .json(&serde_json::json!({
            "plan_id": plan_id,
            "payment_method": payment_method,
        }))
        .send()
        .await
        .map_err(|error| format!("创建微信高级功能订单失败: {error}"))?;
    parse_api_response(response).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn api_error_uses_fallback_when_message_empty() {
        assert_eq!(api_error(None), "模型站点返回失败");
        assert_eq!(api_error(Some("".to_string())), "模型站点返回失败");
        assert_eq!(api_error(Some("余额不足".to_string())), "余额不足");
    }

    #[test]
    fn entitlement_credentials_use_explicit_advanced_feature_key_first() {
        let config = json!({
            "advancedFeatures": {
                "modelSite": {
                    "baseUrl": "https://model.codingrui.work/",
                    "apiKey": "sk-explicit"
                }
            },
            "claude": {
                "providers": {
                    "new-api": {
                        "settingsConfig": {
                            "env": {
                                "ANTHROPIC_BASE_URL": "https://model.codingrui.work",
                                "ANTHROPIC_AUTH_TOKEN": "sk-provider"
                            }
                        }
                    }
                }
            }
        });

        let credentials = entitlement_credentials_from_config_value(&config).unwrap();

        assert_eq!(credentials.base_url, "https://model.codingrui.work");
        assert_eq!(credentials.token, "sk-explicit");
        assert_eq!(credentials.source, "explicit");
    }

    #[test]
    fn entitlement_credentials_detect_model_site_provider_key() {
        let config = json!({
            "claude": {
                "providers": {
                    "anthropic": {
                        "settingsConfig": {
                            "env": {
                                "ANTHROPIC_BASE_URL": "https://api.anthropic.com",
                                "ANTHROPIC_AUTH_TOKEN": "sk-anthropic"
                            }
                        }
                    },
                    "new-api": {
                        "settingsConfig": {
                            "env": {
                                "ANTHROPIC_BASE_URL": "https://model.codingrui.work",
                                "ANTHROPIC_AUTH_TOKEN": "sk-provider"
                            }
                        }
                    }
                },
                "current": "anthropic"
            }
        });

        let credentials = entitlement_credentials_from_config_value(&config).unwrap();

        assert_eq!(credentials.base_url, "https://model.codingrui.work");
        assert_eq!(credentials.token, "sk-provider");
        assert_eq!(credentials.source, "provider");
    }

    #[test]
    fn entitlement_credentials_ignore_official_anthropic_provider() {
        let config = json!({
            "claude": {
                "providers": {
                    "anthropic": {
                        "settingsConfig": {
                            "env": {
                                "ANTHROPIC_BASE_URL": "https://api.anthropic.com",
                                "ANTHROPIC_AUTH_TOKEN": "sk-anthropic"
                            }
                        }
                    }
                },
                "current": "anthropic"
            }
        });

        assert!(entitlement_credentials_from_config_value(&config).is_none());
    }

    #[test]
    fn entitlement_account_response_masks_token() {
        let account = account_from_credentials(
            ResolvedEntitlementCredentials {
                base_url: "https://model.codingrui.work".to_string(),
                token: "sk-1234567890".to_string(),
                source: "provider".to_string(),
            },
            true,
        );

        assert_eq!(account.token_preview, Some("sk-...7890".to_string()));
        assert!(account.has_token);
        assert_eq!(account.source, "provider");
    }
}
