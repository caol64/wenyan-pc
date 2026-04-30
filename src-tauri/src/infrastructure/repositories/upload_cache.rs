use crate::domain::upload_cache::UploadCache;
use crate::error::AppResult;
use crate::infrastructure::db::DbManager;
use sqlx::{Row, query};

pub struct UploadCacheRepository<'a> {
    db: &'a DbManager,
}

impl<'a> UploadCacheRepository<'a> {
    pub fn new(db: &'a DbManager) -> Self {
        Self { db }
    }

    pub async fn get(&self, md5: &str) -> AppResult<Option<UploadCache>> {
        let pool = self.db.pool().await?;
        let row = sqlx::query(
            r#"SELECT id, md5, mediaId as media_id, url, lastUsed as last_used, createdAt as created_at FROM UploadCache WHERE md5 = ?"#
        )
        .bind(md5)
        .fetch_optional(pool)
        .await
        .map_err(|e| crate::error::AppError::Database(e.to_string()))?;

        if let Some(r) = row {
            Ok(Some(UploadCache {
                id: r.get("id"),
                md5: r.get("md5"),
                media_id: r.get("media_id"),
                url: r.get("url"),
                last_used: r.get("last_used"),
                created_at: r.get("created_at"),
            }))
        } else {
            Ok(None)
        }
    }

    pub async fn set(&self, md5: &str, media_id: &str, url: &str) -> AppResult<()> {
        let now = chrono::Utc::now().to_rfc3339();
        let existing = self.get(md5).await?;
        let pool = self.db.pool().await?;

        if let Some(r) = existing {
            query(r#"UPDATE UploadCache SET mediaId = ?, url = ?, lastUsed = ? WHERE id = ?"#)
                .bind(media_id)
                .bind(url)
                .bind(&now)
                .bind(r.id)
                .execute(pool)
                .await
                .map_err(|e| crate::error::AppError::Database(e.to_string()))?;
        } else {
            query(
                r#"INSERT INTO UploadCache (md5, mediaId, url, lastUsed, createdAt) VALUES (?, ?, ?, ?, ?)"#
            )
            .bind(md5)
            .bind(media_id)
            .bind(url)
            .bind(&now)
            .bind(&now)
            .execute(pool)
            .await
            .map_err(|e| crate::error::AppError::Database(e.to_string()))?;
        }

        Ok(())
    }

    pub async fn clear(&self) -> AppResult<()> {
        let pool = self.db.pool().await?;
        query(r#"DELETE FROM UploadCache"#)
            .execute(pool)
            .await
            .map_err(|e| crate::error::AppError::Database(e.to_string()))?;

        Ok(())
    }
}
