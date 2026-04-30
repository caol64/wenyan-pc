use crate::error::AppResult;
use crate::infrastructure::db::DbManager;
use crate::infrastructure::repositories::article::ArticleRepository;
use std::fs;
use std::path::Path;
use tauri::Manager;

pub struct ArticleService<'a> {
    db: &'a DbManager,
}

impl<'a> ArticleService<'a> {
    pub fn new(db: &'a DbManager) -> Self {
        Self { db }
    }

    pub async fn open_markdown_file(&self, path: &str) -> AppResult<String> {
        let content = fs::read_to_string(path)?;
        let path_obj = Path::new(path);
        let file_name = path_obj
            .file_name()
            .and_then(|s| s.to_str())
            .map(|s| s.to_string());
        let dir = path_obj
            .parent()
            .and_then(|p| p.to_str())
            .map(|s| s.to_string());

        let repo = ArticleRepository::new(self.db);
        if let Some(last) = repo.get_last_article().await? {
            repo.update_path(last.id, file_name, Some(path.to_string()), dir)
                .await?;
        }

        Ok(content)
    }

    pub async fn get_default_article(&self, app_handle: &tauri::AppHandle) -> AppResult<String> {
        let repo = ArticleRepository::new(self.db);
        if let Some(last) = repo.get_last_article().await? {
            if !last.content.is_empty() {
                return Ok(last.content);
            }
        }

        // Fallback to example.md
        let resource_path = app_handle
            .path()
            .resolve("resources/example.md", tauri::path::BaseDirectory::Resource)?;
        let content = fs::read_to_string(resource_path)?;
        Ok(content)
    }
}
