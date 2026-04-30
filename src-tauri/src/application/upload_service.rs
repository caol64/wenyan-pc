use crate::application::wechat_service::WechatService;
use crate::dto::upload::UploadResponse;
use crate::error::AppResult;
use crate::infrastructure::db::DbManager;
use crate::infrastructure::repositories::article::ArticleRepository;
use crate::infrastructure::repositories::upload_cache::UploadCacheRepository;
use base64::{Engine as _, engine::general_purpose};
use log::warn;
use regex::Regex;
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};

pub struct UploadService<'a> {
    db: &'a DbManager,
}

pub enum ImageSource {
    Local(String),
    Network(String),
    Base64(String, String), // data, filename
    Blob(Vec<u8>, String),  // data, filename
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

        // Call WeChat API
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
