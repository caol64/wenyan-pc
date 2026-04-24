use crate::infrastructure::db::DbManager;
use crate::infrastructure::repositories::credential::CredentialRepository;
use crate::error::{AppResult, AppError};
use reqwest::Client;
use serde_json::Value;
use reqwest::multipart;

pub struct WechatService<'a> {
    db: &'a DbManager,
}

impl<'a> WechatService<'a> {
    pub fn new(db: &'a DbManager) -> Self {
        Self { db }
    }

    pub async fn get_access_token(&self) -> AppResult<String> {
        let repo = CredentialRepository::new(self.db);
        let cred = repo.get_by_type("wechat").await?
            .ok_or_else(|| AppError::InvalidRequest("WeChat credential not found".into()))?;

        let now = chrono::Utc::now().timestamp_millis();
        if let (Some(token), expire_time) = (cred.access_token, cred.expire_time) {
            if now < expire_time {
                return Ok(token);
            }
        }

        // Refresh token
        let app_id = cred.app_id.ok_or_else(|| AppError::InvalidRequest("AppID missing".into()))?;
        let app_secret = cred.app_secret.ok_or_else(|| AppError::InvalidRequest("AppSecret missing".into()))?;

        let url = format!(
            "https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid={}&secret={}",
            app_id, app_secret
        );

        let resp: Value = reqwest::get(url).await
            .map_err(|e| AppError::Network(e.to_string()))?
            .json().await
            .map_err(|e| AppError::Network(e.to_string()))?;

        if let Some(err) = resp.get("errmsg") {
             if let Some(code) = resp.get("errcode") {
                 if code.as_i64() != Some(0) {
                     return Err(AppError::Network(format!("WeChat error: {}", err)));
                 }
             }
        }

        let token = resp.get("access_token").and_then(|v| v.as_str())
            .ok_or_else(|| AppError::Network("Failed to get access token from WeChat".into()))?
            .to_string();
        
        let expires_in = resp.get("expires_in").and_then(|v| v.as_i64()).unwrap_or(7200);
        let expire_at = now + (expires_in - 200) * 1000; // 提前 200 秒过期

        repo.update_token("wechat", Some(token.clone()), expire_at).await?;

        Ok(token)
    }

    pub async fn upload_material(&self, media_type: &str, data: Vec<u8>, filename: &str) -> AppResult<Value> {
        let token = self.get_access_token().await?;
        let url = format!(
            "https://api.weixin.qq.com/cgi-bin/material/add_material?access_token={}&type={}",
            token, media_type
        );

        let client = Client::new();
        let part = multipart::Part::bytes(data)
            .file_name(filename.to_string())
            .mime_str(&mime_guess::from_path(filename).first_or_octet_stream().to_string())
            .map_err(|e| AppError::Internal(e.to_string()))?;

        let form = multipart::Form::new().part("media", part);

        let resp: Value = client.post(url)
            .multipart(form)
            .send().await
            .map_err(|e| AppError::Network(e.to_string()))?
            .json().await
            .map_err(|e| AppError::Network(e.to_string()))?;

        if let Some(err) = resp.get("errmsg") {
             if let Some(code) = resp.get("errcode") {
                 if code.as_i64() != Some(0) && code.as_i64().is_some() {
                      return Err(AppError::Network(format!("WeChat upload error: {}", err)));
                 }
             }
        }

        Ok(resp)
    }

    pub async fn publish_article(&self, options: crate::dto::publish::WechatPublishOptions) -> AppResult<String> {
        let token = self.get_access_token().await?;
        let url = format!(
            "https://api.weixin.qq.com/cgi-bin/draft/add?access_token={}",
            token
        );

        let client = Client::new();
        let resp: Value = client.post(url)
            .json(&options)
            .send().await
            .map_err(|e| AppError::Network(e.to_string()))?
            .json().await
            .map_err(|e| AppError::Network(e.to_string()))?;

        if let Some(err) = resp.get("errmsg") {
             if let Some(code) = resp.get("errcode") {
                 if code.as_i64() != Some(0) && code.as_i64().is_some() {
                      return Err(AppError::Network(format!("WeChat publish error: {}", err)));
                 }
             }
        }

        let media_id = resp.get("media_id").and_then(|v| v.as_str())
            .ok_or_else(|| AppError::Network("Failed to get media_id from WeChat".into()))?
            .to_string();

        Ok(media_id)
    }
}
