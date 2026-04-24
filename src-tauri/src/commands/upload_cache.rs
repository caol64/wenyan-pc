use tauri::State;
use crate::dto::upload_cache::UploadCacheDo;
use crate::error::AppResult;
use crate::infrastructure::db::DbManager;
use crate::infrastructure::repositories::upload_cache::UploadCacheRepository;

#[tauri::command]
pub async fn get_upload_cache(db: State<'_, DbManager>, md5: String) -> AppResult<Option<UploadCacheDo>> {
    let repo = UploadCacheRepository::new(&db);
    repo.get(&md5).await
}

#[tauri::command]
pub async fn set_upload_cache(db: State<'_, DbManager>, md5: String, media_id: String, url: String) -> AppResult<()> {
    let repo = UploadCacheRepository::new(&db);
    repo.set(&md5, &media_id, &url).await
}

#[tauri::command]
pub async fn clear_upload_cache(db: State<'_, DbManager>) -> AppResult<()> {
    let repo = UploadCacheRepository::new(&db);
    repo.clear().await
}
