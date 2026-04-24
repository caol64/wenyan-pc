use serde::{Deserialize, Serialize};

/// 凭据领域对象 - 用于内部业务逻辑
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Credential {
    pub id: i32,
    pub r#type: String,
    pub name: Option<String>,
    pub app_id: Option<String>,
    pub app_secret: Option<String>,
    pub access_token: Option<String>,
    pub refresh_token: Option<String>,
    pub expire_time: i64,
    pub updated_at: i64,
    pub created_at: String,
}

impl Credential {
    /// 判断 token 是否过期
    pub fn is_token_expired(&self) -> bool {
        let now = chrono::Utc::now().timestamp_millis();
        now >= self.expire_time
    }

    /// 判断是否有有效的 token
    pub fn has_valid_token(&self) -> bool {
        self.access_token.is_some() && !self.is_token_expired()
    }

    /// 判断凭据是否完整（有 appId 和 appSecret）
    pub fn is_complete(&self) -> bool {
        self.app_id.is_some() && self.app_secret.is_some()
    }
}
