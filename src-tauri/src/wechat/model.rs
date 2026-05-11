use serde::{Deserialize, Serialize};

// ========== 凭据 ==========

/// 凭据数据对象
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
    pub fn is_token_expired(&self) -> bool {
        let now = chrono::Utc::now().timestamp_millis();
        now >= self.expire_time
    }

    pub fn has_valid_token(&self) -> bool {
        self.access_token.is_some() && !self.is_token_expired()
    }

    pub fn is_complete(&self) -> bool {
        self.app_id.is_some() && self.app_secret.is_some()
    }
}

/// 凭据数据传输对象 - 用于前端展示
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CredentialDto {
    pub r#type: String,
    pub name: String,
    pub app_id: String,
    pub app_secret: String,
}

// ========== 微信发布 ==========

#[derive(Debug, Serialize, Deserialize)]
pub struct WechatArticle {
    pub title: String,
    pub author: Option<String>,
    pub digest: Option<String>,
    pub content: String,
    pub content_source_url: Option<String>,
    pub thumb_media_id: String,
    pub need_open_comment: Option<i32>,
    pub only_fans_can_comment: Option<i32>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct WechatPublishOptions {
    pub articles: Vec<WechatArticle>,
}

// ========== 上传缓存 ==========

/// 上传缓存数据对象
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UploadCache {
    pub id: i32,
    pub md5: String,
    pub media_id: String,
    pub url: String,
    pub last_used: String,
    pub created_at: String,
}

impl UploadCache {
    pub fn matches_md5(&self, md5: &str) -> bool {
        self.md5 == md5
    }
}

/// 上传缓存数据传输对象
pub type UploadCacheDo = UploadCache;

// ========== 上传响应 ==========

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UploadResponse {
    pub media_id: String,
    pub url: String,
}
