use std::time::Duration;

use serde::Deserialize;

const WECHAT_BRIDGE_FEATURE_KEY: &str = "wechat_bridge";

#[derive(Clone)]
pub struct EntitlementChecker {
    base_url: String,
    token: String,
    client: reqwest::Client,
}

#[derive(Debug, Deserialize)]
struct EntitlementEnvelope {
    success: bool,
    message: Option<String>,
    data: Option<EntitlementData>,
}

#[derive(Debug, Deserialize)]
struct EntitlementData {
    features: std::collections::HashMap<String, bool>,
}

impl EntitlementChecker {
    fn with_credentials(base_url: String, token: String) -> Result<Self, String> {
        let client = reqwest::Client::builder()
            .connect_timeout(Duration::from_secs(10))
            .timeout(Duration::from_secs(20))
            .build()
            .map_err(|error| format!("create entitlement client: {error}"))?;
        Ok(Self {
            base_url,
            token,
            client,
        })
    }

    pub fn required_from_env() -> Result<Self, String> {
        Self::from_env()?.ok_or_else(|| "missing entitlement credentials".to_string())
    }

    pub fn from_env() -> Result<Option<Self>, String> {
        let base_url = std::env::var("NEWAPI_BASE_URL")
            .ok()
            .map(|value| value.trim().trim_end_matches('/').to_string())
            .filter(|value| !value.is_empty());
        let token = std::env::var("NEWAPI_AUTH_TOKEN")
            .ok()
            .map(|value| value.trim().to_string())
            .filter(|value| !value.is_empty());
        match (base_url, token) {
            (Some(base_url), Some(token)) => Ok(Some(Self::with_credentials(base_url, token)?)),
            _ => Ok(None),
        }
    }

    #[cfg(test)]
    pub(crate) fn for_test(base_url: String, token: String) -> Result<Self, String> {
        Self::with_credentials(base_url, token)
    }

    pub async fn has_wechat_bridge(&self) -> Result<bool, String> {
        let response = self
            .client
            .get(format!("{}/api/entitlements/self", self.base_url))
            .bearer_auth(&self.token)
            .send()
            .await
            .map_err(|error| format!("request entitlement: {error}"))?
            .error_for_status()
            .map_err(|error| format!("entitlement status: {error}"))?;
        let envelope: EntitlementEnvelope = response
            .json()
            .await
            .map_err(|error| format!("parse entitlement: {error}"))?;
        if !envelope.success {
            return Err(envelope
                .message
                .filter(|value| !value.trim().is_empty())
                .unwrap_or_else(|| "entitlement rejected".to_string()));
        }
        Ok(envelope
            .data
            .and_then(|data| data.features.get(WECHAT_BRIDGE_FEATURE_KEY).copied())
            .unwrap_or(false))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn from_env_returns_none_when_credentials_missing() {
        std::env::remove_var("NEWAPI_BASE_URL");
        std::env::remove_var("NEWAPI_AUTH_TOKEN");
        assert!(EntitlementChecker::from_env().unwrap().is_none());
    }

    #[test]
    fn required_from_env_errors_when_credentials_missing() {
        std::env::remove_var("NEWAPI_BASE_URL");
        std::env::remove_var("NEWAPI_AUTH_TOKEN");

        let err = match EntitlementChecker::required_from_env() {
            Ok(_) => panic!("expected missing entitlement credentials"),
            Err(err) => err,
        };

        assert!(err.contains("missing entitlement credentials"));
    }
}
