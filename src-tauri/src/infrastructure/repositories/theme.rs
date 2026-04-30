use crate::domain::theme::Theme;
use crate::dto::theme::ThemeDto;
use crate::error::AppResult;
use crate::infrastructure::db::DbManager;
use sqlx::Row;

pub struct ThemeRepository<'a> {
    db: &'a DbManager,
}

impl<'a> ThemeRepository<'a> {
    pub fn new(db: &'a DbManager) -> Self {
        Self { db }
    }

    pub async fn load_all(&self) -> AppResult<Vec<ThemeDto>> {
        let pool = self.db.pool().await?;
        let rows = sqlx::query("SELECT id, name, content, createdAt FROM CustomTheme")
            .fetch_all(pool)
            .await
            .map_err(|e| crate::error::AppError::Database(e.to_string()))?;

        Ok(rows
            .into_iter()
            .map(|row| ThemeDto {
                id: row.get::<i32, _>("id").to_string(),
                name: row.get("name"),
                css: row.get("content"),
            })
            .collect())
    }

    pub async fn save(&self, id: Option<String>, name: &str, css: &str) -> AppResult<String> {
        let now = chrono::Utc::now().to_rfc3339();
        let pool = self.db.pool().await?;

        if let Some(id_str) = id {
            let id_int = id_str
                .parse::<i32>()
                .map_err(|_| crate::error::AppError::InvalidRequest("Invalid ID".into()))?;
            sqlx::query("UPDATE CustomTheme SET content = ?, createdAt = ? WHERE id = ?")
                .bind(css)
                .bind(now)
                .bind(id_int)
                .execute(pool)
                .await
                .map_err(|e| crate::error::AppError::Database(e.to_string()))?;
            Ok(id_str)
        } else {
            let result =
                sqlx::query("INSERT INTO CustomTheme (name, content, createdAt) VALUES (?, ?, ?)")
                    .bind(name)
                    .bind(css)
                    .bind(now)
                    .execute(pool)
                    .await
                    .map_err(|e| crate::error::AppError::Database(e.to_string()))?;

            Ok(result.last_insert_rowid().to_string())
        }
    }

    pub async fn remove(&self, id: String) -> AppResult<()> {
        let pool = self.db.pool().await?;
        let id_int = id
            .parse::<i32>()
            .map_err(|_| crate::error::AppError::InvalidRequest("Invalid ID".into()))?;
        sqlx::query("DELETE FROM CustomTheme WHERE id = ?")
            .bind(id_int)
            .execute(pool)
            .await
            .map_err(|e| crate::error::AppError::Database(e.to_string()))?;

        Ok(())
    }

    #[allow(dead_code)]
    pub async fn get(&self, id: i32) -> AppResult<Option<Theme>> {
        let pool = self.db.pool().await?;
        let row = sqlx::query("SELECT id, name, content, createdAt FROM CustomTheme WHERE id = ?")
            .bind(id)
            .fetch_optional(pool)
            .await
            .map_err(|e| crate::error::AppError::Database(e.to_string()))?;

        if let Some(r) = row {
            Ok(Some(Theme {
                id: r.get("id"),
                name: r.get("name"),
                content: r.get("content"),
                created_at: r.get("createdAt"),
            }))
        } else {
            Ok(None)
        }
    }
}
