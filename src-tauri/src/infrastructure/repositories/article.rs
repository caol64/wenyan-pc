use crate::domain::article::Article;
use crate::dto::article::ArticleDto;
use crate::error::AppResult;
use crate::infrastructure::db::DbManager;
use sqlx::Row;

pub struct ArticleRepository<'a> {
    db: &'a DbManager,
}

impl<'a> ArticleRepository<'a> {
    pub fn new(db: &'a DbManager) -> Self {
        Self { db }
    }

    pub async fn load_all(&self) -> AppResult<Vec<ArticleDto>> {
        let pool = self.db.pool().await?;
        let rows = sqlx::query(
            "SELECT id, title, content, fileName, filePath, relativePath, createdAt FROM Article ORDER BY id DESC"
        )
        .fetch_all(pool)
        .await
        .map_err(|e| crate::error::AppError::Database(e.to_string()))?;

        Ok(rows
            .into_iter()
            .map(|row| ArticleDto {
                id: row.get::<i32, _>("id").to_string(),
                title: row.get("title"),
                content: row.get("content"),
                created: chrono::DateTime::parse_from_rfc3339(row.get("createdAt"))
                    .map(|dt| dt.timestamp_millis())
                    .unwrap_or(0),
            })
            .collect())
    }

    pub async fn save(&self, title: &str, content: &str) -> AppResult<()> {
        let pool = self.db.pool().await?;
        let row = sqlx::query(
            "SELECT id FROM Article ORDER BY id DESC LIMIT 1"
        )
        .fetch_optional(pool)
        .await
        .map_err(|e| crate::error::AppError::Database(e.to_string()))?;

        let now = chrono::Utc::now().to_rfc3339();

        if let Some(r) = row {
            let id: i32 = r.get("id");
            sqlx::query(
                "UPDATE Article SET title = ?, content = ?, createdAt = ? WHERE id = ?"
            )
            .bind(title)
            .bind(content)
            .bind(now)
            .bind(id)
            .execute(pool)
            .await
            .map_err(|e| crate::error::AppError::Database(e.to_string()))?;
        } else {
            sqlx::query(
                "INSERT INTO Article (title, content, createdAt) VALUES (?, ?, ?)"
            )
            .bind(title)
            .bind(content)
            .bind(now)
            .execute(pool)
            .await
            .map_err(|e| crate::error::AppError::Database(e.to_string()))?;
        }

        Ok(())
    }

    pub async fn remove(&self, id: i32) -> AppResult<()> {
        let pool = self.db.pool().await?;
        sqlx::query(
            "DELETE FROM Article WHERE id = ?"
        )
        .bind(id)
        .execute(pool)
        .await
        .map_err(|e| crate::error::AppError::Database(e.to_string()))?;

        Ok(())
    }

    pub async fn update_path(&self, id: i32, file_name: Option<String>, file_path: Option<String>, relative_path: Option<String>) -> AppResult<()> {
        let pool = self.db.pool().await?;
        sqlx::query(
            "UPDATE Article SET fileName = ?, filePath = ?, relativePath = ? WHERE id = ?"
        )
        .bind(file_name)
        .bind(file_path)
        .bind(relative_path)
        .bind(id)
        .execute(pool)
        .await
        .map_err(|e| crate::error::AppError::Database(e.to_string()))?;

        Ok(())
    }

    pub async fn get_last_article(&self) -> AppResult<Option<Article>> {
        let pool = self.db.pool().await?;
        let row = sqlx::query(
            "SELECT id, title, content, fileName, filePath, relativePath, createdAt FROM Article ORDER BY id DESC LIMIT 1"
        )
        .fetch_optional(pool)
        .await
        .map_err(|e| crate::error::AppError::Database(e.to_string()))?;

        if let Some(r) = row {
            Ok(Some(Article {
                id: r.get("id"),
                title: r.get("title"),
                content: r.get("content"),
                file_name: r.get("fileName"),
                file_path: r.get("filePath"),
                relative_path: r.get("relativePath"),
                created_at: r.get("createdAt"),
            }))
        } else {
            Ok(None)
        }
    }
}
