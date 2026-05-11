use crate::articles::repository::ArticleRepository;
use crate::db::DbManager;
use crate::error::{AppError, AppResult};
use crate::wechat::model::UploadResponse;
use crate::wechat::repository::{CredentialRepository, UploadCacheRepository};
use base64::{Engine as _, engine::general_purpose};
use log::warn;
use regex::Regex;
use reqwest::Client;
use reqwest::multipart;
use serde_json::Value;
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};

// ========== WechatService ==========

pub struct WechatService<'a> {
    db: &'a DbManager,
}

impl<'a> WechatService<'a> {
    pub fn new(db: &'a DbManager) -> Self {
        Self { db }
    }

    pub async fn ensure_ready(&self, wechat_enabled: bool) -> AppResult<()> {
        if !wechat_enabled {
            return Err(AppError::InvalidRequest("请先在设置中启用微信图床".into()));
        }

        let repo = CredentialRepository::new(self.db);
        let cred = repo
            .get_by_type("wechat")
            .await?
            .ok_or_else(|| AppError::InvalidRequest("请先在设置中配置微信的凭据".into()))?;

        if !cred.is_complete() {
            return Err(AppError::InvalidRequest("请先在设置中配置微信的凭据".into()));
        }

        Ok(())
    }

    pub async fn get_access_token(&self) -> AppResult<String> {
        self.ensure_ready(true).await?;

        let repo = CredentialRepository::new(self.db);
        let cred = repo
            .get_by_type("wechat")
            .await?
            .ok_or_else(|| AppError::InvalidRequest("请先在设置中配置微信的凭据".into()))?;

        let now = chrono::Utc::now().timestamp_millis();
        if let (Some(token), expire_time) = (cred.access_token, cred.expire_time) {
            if now < expire_time {
                return Ok(token);
            }
        }

        let app_id = cred
            .app_id
            .ok_or_else(|| AppError::InvalidRequest("请先在设置中配置微信的凭据".into()))?;
        let app_secret = cred
            .app_secret
            .ok_or_else(|| AppError::InvalidRequest("请先在设置中配置微信的凭据".into()))?;

        let url = format!(
            "https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid={}&secret={}",
            app_id, app_secret
        );

        let resp: Value = reqwest::get(url)
            .await
            .map_err(|e| AppError::Network(e.to_string()))?
            .json()
            .await
            .map_err(|e| AppError::Network(e.to_string()))?;

        if let Some(err) = resp.get("errmsg") {
            if let Some(code) = resp.get("errcode") {
                if code.as_i64() != Some(0) {
                    return Err(AppError::Network(format!("WeChat error: {}", err)));
                }
            }
        }

        let token = resp
            .get("access_token")
            .and_then(|v| v.as_str())
            .ok_or_else(|| AppError::Network("Failed to get access token from WeChat".into()))?
            .to_string();

        let expires_in = resp
            .get("expires_in")
            .and_then(|v| v.as_i64())
            .unwrap_or(7200);
        let expire_at = now + (expires_in - 200) * 1000;

        repo.update_token("wechat", Some(token.clone()), expire_at)
            .await?;

        Ok(token)
    }

    pub async fn upload_material(
        &self,
        media_type: &str,
        data: Vec<u8>,
        filename: &str,
    ) -> AppResult<Value> {
        let token = self.get_access_token().await?;
        let url = format!(
            "https://api.weixin.qq.com/cgi-bin/material/add_material?access_token={}&type={}",
            token, media_type
        );

        let client = Client::new();
        let part = multipart::Part::bytes(data)
            .file_name(filename.to_string())
            .mime_str(
                &mime_guess::from_path(filename)
                    .first_or_octet_stream()
                    .to_string(),
            )
            .map_err(|e| AppError::Internal(e.to_string()))?;

        let form = multipart::Form::new().part("media", part);

        let resp: Value = client
            .post(url)
            .multipart(form)
            .send()
            .await
            .map_err(|e| AppError::Network(e.to_string()))?
            .json()
            .await
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

    pub async fn publish_article(
        &self,
        options: crate::wechat::model::WechatPublishOptions,
    ) -> AppResult<String> {
        let token = self.get_access_token().await?;
        let url = format!(
            "https://api.weixin.qq.com/cgi-bin/draft/add?access_token={}",
            token
        );

        let client = Client::new();
        let resp: Value = client
            .post(url)
            .json(&options)
            .send()
            .await
            .map_err(|e| AppError::Network(e.to_string()))?
            .json()
            .await
            .map_err(|e| AppError::Network(e.to_string()))?;

        if let Some(err) = resp.get("errmsg") {
            if let Some(code) = resp.get("errcode") {
                if code.as_i64() != Some(0) && code.as_i64().is_some() {
                    return Err(AppError::Network(format!("WeChat publish error: {}", err)));
                }
            }
        }

        let media_id = resp
            .get("media_id")
            .and_then(|v| v.as_str())
            .ok_or_else(|| AppError::Network("Failed to get media_id from WeChat".into()))?
            .to_string();

        Ok(media_id)
    }
}

// ========== UploadService ==========

pub struct UploadService<'a> {
    db: &'a DbManager,
}

pub enum ImageSource {
    Local(String),
    Network(String),
    Base64(String, String),
    Blob(Vec<u8>, String),
}

#[derive(Debug, Clone)]
pub struct MarkdownProcessingOptions {
    pub relative_to: Option<String>,
    pub auto_upload_local: bool,
    pub auto_upload_network: bool,
    pub auto_cache: bool,
}

impl<'a> UploadService<'a> {
    pub fn new(db: &'a DbManager) -> Self {
        Self { db }
    }

    pub async fn upload_image(
        &self,
        source: ImageSource,
        auto_cache: bool,
    ) -> AppResult<UploadResponse> {
        let (data, filename) = match &source {
            ImageSource::Local(path) => {
                let data = fs::read(path)?;
                let filename = Path::new(path)
                    .file_name()
                    .and_then(|s| s.to_str())
                    .unwrap_or("image.png")
                    .to_string();
                (data, filename)
            }
            ImageSource::Network(url) => {
                let response = reqwest::get(url)
                    .await
                    .map_err(|e| crate::error::AppError::Network(e.to_string()))?;
                let data = response
                    .bytes()
                    .await
                    .map_err(|e| crate::error::AppError::Network(e.to_string()))?
                    .to_vec();
                let filename = Path::new(url)
                    .file_name()
                    .and_then(|s| s.to_str())
                    .unwrap_or("image.png")
                    .to_string();
                (data, filename)
            }
            ImageSource::Base64(b64, filename) => {
                let data = if b64.starts_with("data:") {
                    let parts: Vec<&str> = b64.split(',').collect();
                    general_purpose::STANDARD.decode(parts[1]).map_err(|_| {
                        crate::error::AppError::InvalidRequest("Invalid base64".into())
                    })?
                } else {
                    general_purpose::STANDARD.decode(b64).map_err(|_| {
                        crate::error::AppError::InvalidRequest("Invalid base64".into())
                    })?
                };
                (data, filename.clone())
            }
            ImageSource::Blob(data, filename) => (data.clone(), filename.clone()),
        };

        let md5 = if auto_cache {
            let digest = md5::compute(&data);
            Some(format!("{:x}", digest))
        } else {
            None
        };

        let cache_repo = UploadCacheRepository::new(self.db);
        if let Some(md5_str) = &md5 {
            if let Some(cached) = cache_repo.get(md5_str).await? {
                return Ok(UploadResponse {
                    media_id: cached.media_id,
                    url: cached.url,
                });
            }
        }

        let wechat = WechatService::new(self.db);
        let resp = wechat.upload_material("image", data, &filename).await?;

        let media_id = resp
            .get("media_id")
            .and_then(|v| v.as_str())
            .ok_or_else(|| {
                crate::error::AppError::Network("Failed to get media_id from WeChat".into())
            })?
            .to_string();
        let url = resp
            .get("url")
            .and_then(|v| v.as_str())
            .ok_or_else(|| crate::error::AppError::Network("Failed to get url from WeChat".into()))?
            .to_string();

        if let Some(md5_str) = &md5 {
            cache_repo.set(md5_str, &media_id, &url).await?;
        }

        Ok(UploadResponse { media_id, url })
    }

    pub async fn upload_image_from_src(
        &self,
        src: &str,
        relative_to: Option<&str>,
        filename: Option<String>,
        auto_cache: bool,
    ) -> AppResult<UploadResponse> {
        let source = self
            .resolve_image_source(src, relative_to, filename)
            .await?;
        self.upload_image(source, auto_cache).await
    }

    pub async fn process_markdown_content(
        &self,
        markdown: &str,
        options: MarkdownProcessingOptions,
    ) -> AppResult<String> {
        if !options.auto_upload_local && !options.auto_upload_network {
            return Ok(markdown.to_string());
        }

        let relative_to = self
            .resolve_base_path(options.relative_to.as_deref())
            .await?;
        let image_regex = Regex::new(r"!\[([^\]]*)\]\(([^)]+)\)")
            .map_err(|err| crate::error::AppError::Internal(err.to_string()))?;

        let mut replace_map = HashMap::new();
        for captures in image_regex.captures_iter(markdown) {
            let Some(src_match) = captures.get(2) else {
                continue;
            };

            let src = src_match.as_str();
            if replace_map.contains_key(src) || !should_process_markdown_image(src, &options) {
                continue;
            }

            match self
                .upload_image_from_src(src, relative_to.as_deref(), None, options.auto_cache)
                .await
            {
                Ok(response) => {
                    replace_map.insert(src.to_string(), response.url);
                }
                Err(err) => {
                    warn!("Image upload failed for markdown source {src}: {err}");
                }
            }
        }

        if replace_map.is_empty() {
            return Ok(markdown.to_string());
        }

        let mut result = String::with_capacity(markdown.len());
        let mut last_end = 0;

        for captures in image_regex.captures_iter(markdown) {
            let Some(src_match) = captures.get(2) else {
                continue;
            };

            result.push_str(&markdown[last_end..src_match.start()]);
            if let Some(new_url) = replace_map.get(src_match.as_str()) {
                result.push_str(new_url);
            } else {
                result.push_str(src_match.as_str());
            }
            last_end = src_match.end();
        }

        result.push_str(&markdown[last_end..]);
        Ok(result)
    }

    async fn resolve_image_source(
        &self,
        src: &str,
        relative_to: Option<&str>,
        filename: Option<String>,
    ) -> AppResult<ImageSource> {
        if is_network_src(src) {
            return Ok(ImageSource::Network(src.to_string()));
        }

        if src.starts_with("data:") {
            return Ok(ImageSource::Base64(
                src.to_string(),
                filename.unwrap_or_else(|| "image.png".into()),
            ));
        }

        let resolved_path =
            resolve_image_path(src, self.resolve_base_path(relative_to).await?.as_deref());
        Ok(ImageSource::Local(
            resolved_path.to_string_lossy().to_string(),
        ))
    }

    async fn resolve_base_path(&self, relative_to: Option<&str>) -> AppResult<Option<String>> {
        if let Some(value) = relative_to {
            return Ok(Some(value.to_string()));
        }

        Ok(ArticleRepository::new(self.db)
            .get_last_article()
            .await?
            .and_then(|article| article.relative_path))
    }
}

fn is_network_src(src: &str) -> bool {
    src.starts_with("http")
}

fn should_process_markdown_image(src: &str, options: &MarkdownProcessingOptions) -> bool {
    if src.starts_with("data:") {
        return false;
    }

    if is_network_src(src) {
        return options.auto_upload_network;
    }

    options.auto_upload_local
}

fn resolve_image_path(path: &str, base: Option<&str>) -> PathBuf {
    if Path::new(path).is_absolute() {
        return PathBuf::from(path);
    }

    if let Some(base_path) = base {
        return PathBuf::from(base_path).join(path);
    }

    PathBuf::from(path)
}
