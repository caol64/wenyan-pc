use tauri::{AppHandle, State};
use crate::dto::article::ArticleDto;
use crate::error::AppResult;
use crate::infrastructure::db::DbManager;
use crate::infrastructure::repositories::article::ArticleRepository;
use crate::application::article_service::ArticleService;

#[tauri::command]
pub async fn load_articles(db: State<'_, DbManager>) -> AppResult<Vec<ArticleDto>> {
    let repo = ArticleRepository::new(&db);
    repo.load_all().await
}

#[tauri::command]
pub async fn open_markdown_file(db: State<'_, DbManager>, path: String) -> AppResult<String> {
    let service = ArticleService::new(&db);
    service.open_markdown_file(&path).await
}

#[tauri::command]
pub async fn get_default_article(app_handle: AppHandle, db: State<'_, DbManager>) -> AppResult<String> {
    let service = ArticleService::new(&db);
    service.get_default_article(&app_handle).await
}

#[tauri::command]
pub async fn save_article(db: State<'_, DbManager>, title: String, content: String) -> AppResult<()> {
    let repo = ArticleRepository::new(&db);
    repo.save(&title, &content).await
}

#[tauri::command]
pub async fn remove_article(db: State<'_, DbManager>, id: String) -> AppResult<()> {
    let repo = ArticleRepository::new(&db);
    let id_int = id.parse::<i32>().map_err(|_| crate::error::AppError::InvalidRequest("Invalid ID".into()))?;
    repo.remove(id_int).await
}

#[tauri::command]
pub async fn get_last_article_relative_path(db: State<'_, DbManager>) -> AppResult<Option<String>> {
    let repo = ArticleRepository::new(&db);
    let last = repo.get_last_article().await?;
    Ok(last.and_then(|a| a.relative_path))
}

#[tauri::command]
pub async fn update_last_article_path(
    db: State<'_, DbManager>,
    file_name: Option<String>,
    file_path: Option<String>,
    relative_path: Option<String>
) -> AppResult<()> {
    let repo = ArticleRepository::new(&db);
    if let Some(last) = repo.get_last_article().await? {
        repo.update_path(last.id, file_name, file_path, relative_path).await?;
    }
    Ok(())
}
