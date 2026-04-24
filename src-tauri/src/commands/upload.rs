use tauri::State;
use crate::application::upload_service::{UploadService, ImageSource};
use crate::dto::upload::UploadResponse;
use crate::error::AppResult;
use crate::infrastructure::db::DbManager;
use serde::Deserialize;
use base64::Engine;

#[derive(Deserialize)]
#[serde(untagged)]
pub enum UploadData {
    String(String),
    Binary(Vec<u8>),
}

#[tauri::command]
pub async fn upload_image(
    db: State<'_, DbManager>,
    source_type: String, // "local", "network", "base64", "blob"
    data: UploadData,
    filename: Option<String>,
    auto_cache: bool
) -> AppResult<UploadResponse> {
    let service = UploadService::new(&db);
    let source = match (source_type.as_str(), data) {
        ("local", UploadData::String(path)) => ImageSource::Local(path),
        ("network", UploadData::String(url)) => ImageSource::Network(url),
        ("base64", UploadData::String(b64)) => ImageSource::Base64(b64, filename.unwrap_or_else(|| "image.png".into())),
        ("blob", UploadData::Binary(bytes)) => ImageSource::Blob(bytes, filename.unwrap_or_else(|| "image.png".into())),
        ("blob", UploadData::String(b64)) => {
            // handle base64 blob if passed as string
            let decoded = base64::engine::general_purpose::STANDARD.decode(b64)
                .map_err(|_| crate::error::AppError::InvalidRequest("Invalid blob data".into()))?;
            ImageSource::Blob(decoded, filename.unwrap_or_else(|| "image.png".into()))
        }
        _ => return Err(crate::error::AppError::InvalidRequest("Invalid source type or data format".into())),
    };
    service.upload_image(source, auto_cache).await
}
