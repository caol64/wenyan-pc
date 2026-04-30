use crate::application::upload_service::{ImageSource, MarkdownProcessingOptions, UploadService};
use crate::dto::upload::UploadResponse;
use crate::error::AppResult;
use crate::infrastructure::db::DbManager;
use base64::Engine;
use serde::Deserialize;
use tauri::State;

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
    source_type: String, // "local", "network", "base64", "blob"
    data: UploadData,
    filename: Option<String>,
    auto_cache: bool,
    wechat_enabled: Option<bool>,
) -> AppResult<UploadResponse> {
    let service = UploadService::new(&db);
    let wechat_service = crate::application::wechat_service::WechatService::new(&db);
    wechat_service.ensure_ready(wechat_enabled.unwrap_or(true)).await?;

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
            // handle base64 blob if passed as string
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
