use crate::infrastructure::db::DbManager;
use crate::infrastructure::repositories::upload_cache::UploadCacheRepository;
use crate::error::AppResult;
use crate::dto::upload::UploadResponse;
use crate::application::wechat_service::WechatService;
use std::fs;
use base64::{Engine as _, engine::general_purpose};
use std::path::Path;

pub struct UploadService<'a> {
    db: &'a DbManager,
}

pub enum ImageSource {
    Local(String),
    Network(String),
    Base64(String, String), // data, filename
    Blob(Vec<u8>, String), // data, filename
}

impl<'a> UploadService<'a> {
    pub fn new(db: &'a DbManager) -> Self {
        Self { db }
    }

    pub async fn upload_image(&self, source: ImageSource, auto_cache: bool) -> AppResult<UploadResponse> {
        let (data, filename) = match &source {
            ImageSource::Local(path) => {
                let data = fs::read(path)?;
                let filename = Path::new(path).file_name()
                    .and_then(|s| s.to_str())
                    .unwrap_or("image.png")
                    .to_string();
                (data, filename)
            }
            ImageSource::Network(url) => {
                let response = reqwest::get(url).await
                    .map_err(|e| crate::error::AppError::Network(e.to_string()))?;
                let data = response.bytes().await
                    .map_err(|e| crate::error::AppError::Network(e.to_string()))?
                    .to_vec();
                let filename = Path::new(url).file_name()
                    .and_then(|s| s.to_str())
                    .unwrap_or("image.png")
                    .to_string();
                (data, filename)
            }
            ImageSource::Base64(b64, filename) => {
                let data = if b64.starts_with("data:") {
                    let parts: Vec<&str> = b64.split(',').collect();
                    general_purpose::STANDARD.decode(parts[1])
                        .map_err(|_| crate::error::AppError::InvalidRequest("Invalid base64".into()))?
                } else {
                    general_purpose::STANDARD.decode(b64)
                        .map_err(|_| crate::error::AppError::InvalidRequest("Invalid base64".into()))?
                };
                (data, filename.clone())
            }
            ImageSource::Blob(data, filename) => {
                (data.clone(), filename.clone())
            }
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

        // Call WeChat API
        let wechat = WechatService::new(self.db);
        let resp = wechat.upload_material("image", data, &filename).await?;

        let media_id = resp.get("media_id").and_then(|v| v.as_str())
            .ok_or_else(|| crate::error::AppError::Network("Failed to get media_id from WeChat".into()))?
            .to_string();
        let url = resp.get("url").and_then(|v| v.as_str())
            .ok_or_else(|| crate::error::AppError::Network("Failed to get url from WeChat".into()))?
            .to_string();

        if let Some(md5_str) = &md5 {
            cache_repo.set(md5_str, &media_id, &url).await?;
        }

        Ok(UploadResponse {
            media_id,
            url,
        })
    }
}
