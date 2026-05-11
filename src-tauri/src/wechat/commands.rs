use crate::db::DbManager;
use crate::error::AppResult;
use crate::wechat::model::{
    Credential, CredentialDto, UploadCacheDo, UploadResponse, WechatPublishOptions,
};
use crate::wechat::repository::{CredentialRepository, UploadCacheRepository};
use crate::wechat::service::{ImageSource, MarkdownProcessingOptions, UploadService, WechatService};
use base64::Engine;
use serde::Deserialize;
use tauri::State;

// ========== 凭据命令 ==========

#[tauri::command]
pub async fn load_credentials(db: State<'_, DbManager>) -> AppResult<Vec<CredentialDto>> {
    let repo = CredentialRepository::new(&db);
    repo.load_all().await
}

#[tauri::command]
pub async fn save_credential(
    db: State<'_, DbManager>,
    r#type: String,
    name: Option<String>,
    app_id: Option<String>,
    app_secret: Option<String>,
) -> AppResult<()> {
    let repo = CredentialRepository::new(&db);
    repo.save(&r#type, name, app_id, app_secret).await
}

#[tauri::command]
pub async fn update_wechat_token(
    db: State<'_, DbManager>,
    access_token: Option<String>,
    expire_time: i64,
) -> AppResult<()> {
    let repo = CredentialRepository::new(&db);
    repo.update_token("wechat", access_token, expire_time).await
}

#[tauri::command]
pub async fn get_wechat_token(db: State<'_, DbManager>) -> AppResult<Option<Credential>> {
    let repo = CredentialRepository::new(&db);
    repo.get_by_type("wechat").await
}

// ========== 上传缓存命令 ==========

#[tauri::command]
pub async fn get_upload_cache(
    db: State<'_, DbManager>,
    md5: String,
) -> AppResult<Option<UploadCacheDo>> {
    let repo = UploadCacheRepository::new(&db);
    repo.get(&md5).await
}

#[tauri::command]
pub async fn set_upload_cache(
    db: State<'_, DbManager>,
    md5: String,
    media_id: String,
    url: String,
) -> AppResult<()> {
    let repo = UploadCacheRepository::new(&db);
    repo.set(&md5, &media_id, &url).await
}

#[tauri::command]
pub async fn clear_upload_cache(db: State<'_, DbManager>) -> AppResult<()> {
    let repo = UploadCacheRepository::new(&db);
    repo.clear().await
}

// ========== 上传命令 ==========

#[derive(Deserialize)]
#[serde(untagged)]
pub enum UploadData {
    String(String),
    Binary(Vec<u8>),
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcessMarkdownOptions {
    pub relative_to: Option<String>,
    pub auto_upload_local: bool,
    pub auto_upload_network: bool,
    pub auto_cache: bool,
}

#[tauri::command]
pub async fn upload_image(
    db: State<'_, DbManager>,
    source_type: String,
    data: UploadData,
    filename: Option<String>,
    auto_cache: bool,
    wechat_enabled: Option<bool>,
) -> AppResult<UploadResponse> {
    let service = UploadService::new(&db);
    let wechat_service = WechatService::new(&db);
    wechat_service
        .ensure_ready(wechat_enabled.unwrap_or(true))
        .await?;

    if source_type == "auto" {
        let UploadData::String(src) = data else {
            return Err(crate::error::AppError::InvalidRequest(
                "Auto source type requires string data".into(),
            ));
        };
        return service
            .upload_image_from_src(&src, None, filename, auto_cache)
            .await;
    }

    let source = match (source_type.as_str(), data) {
        ("local", UploadData::String(path)) => ImageSource::Local(path),
        ("network", UploadData::String(url)) => ImageSource::Network(url),
        ("base64", UploadData::String(b64)) => {
            ImageSource::Base64(b64, filename.unwrap_or_else(|| "image.png".into()))
        }
        ("blob", UploadData::Binary(bytes)) => {
            ImageSource::Blob(bytes, filename.unwrap_or_else(|| "image.png".into()))
        }
        ("blob", UploadData::String(b64)) => {
            let decoded = base64::engine::general_purpose::STANDARD
                .decode(b64)
                .map_err(|_| crate::error::AppError::InvalidRequest("Invalid blob data".into()))?;
            ImageSource::Blob(decoded, filename.unwrap_or_else(|| "image.png".into()))
        }
        _ => {
            return Err(crate::error::AppError::InvalidRequest(
                "Invalid source type or data format".into(),
            ));
        }
    };
    service.upload_image(source, auto_cache).await
}

#[tauri::command]
pub async fn process_markdown_content(
    db: State<'_, DbManager>,
    content: String,
    options: ProcessMarkdownOptions,
) -> AppResult<String> {
    UploadService::new(&db)
        .process_markdown_content(
            &content,
            MarkdownProcessingOptions {
                relative_to: options.relative_to,
                auto_upload_local: options.auto_upload_local,
                auto_upload_network: options.auto_upload_network,
                auto_cache: options.auto_cache,
            },
        )
        .await
}

// ========== 发布命令 ==========

#[tauri::command]
pub async fn publish_wechat_draft(
    db: State<'_, DbManager>,
    options: WechatPublishOptions,
    wechat_enabled: bool,
) -> AppResult<String> {
    let service = WechatService::new(&db);
    service.ensure_ready(wechat_enabled).await?;
    service.publish_article(options).await
}
