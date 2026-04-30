use crate::dto::theme::ThemeDto;
use crate::error::AppResult;
use crate::infrastructure::db::DbManager;
use crate::infrastructure::repositories::theme::ThemeRepository;
use tauri::State;

#[tauri::command]
pub async fn load_themes(db: State<'_, DbManager>) -> AppResult<Vec<ThemeDto>> {
    let repo = ThemeRepository::new(&db);
    repo.load_all().await
}

#[tauri::command]
pub async fn save_theme(
    db: State<'_, DbManager>,
    id: Option<String>,
    name: String,
    css: String,
) -> AppResult<String> {
    let repo = ThemeRepository::new(&db);
    repo.save(id, &name, &css).await
}

#[tauri::command]
pub async fn remove_theme(db: State<'_, DbManager>, id: String) -> AppResult<()> {
    let repo = ThemeRepository::new(&db);
    repo.remove(id).await
}
