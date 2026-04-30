use crate::domain::credential::Credential;
use crate::dto::credential::CredentialDto;
use crate::error::AppResult;
use crate::infrastructure::db::DbManager;
use sqlx::Row;

pub struct CredentialRepository<'a> {
    db: &'a DbManager,
}

impl<'a> CredentialRepository<'a> {
    pub fn new(db: &'a DbManager) -> Self {
        Self { db }
    }

    pub async fn load_all(&self) -> AppResult<Vec<CredentialDto>> {
        let pool = self.db.pool().await?;
        let rows = sqlx::query(
            "SELECT id, type, name, appId, appSecret, accessToken, refreshToken, expireTime, updatedAt, createdAt FROM Credential"
        )
        .fetch_all(pool)
        .await
        .map_err(|e| crate::error::AppError::Database(e.to_string()))?;

        Ok(rows
            .into_iter()
            .map(|row| CredentialDto {
                r#type: row.get("type"),
                name: row.get::<Option<String>, _>("name").unwrap_or_default(),
                app_id: row.get::<Option<String>, _>("appId").unwrap_or_default(),
                app_secret: row
                    .get::<Option<String>, _>("appSecret")
                    .unwrap_or_default(),
            })
            .collect())
    }

    pub async fn save(
        &self,
        r#type: &str,
        name: Option<String>,
        app_id: Option<String>,
        app_secret: Option<String>,
    ) -> AppResult<()> {
        let pool = self.db.pool().await?;
        let row = sqlx::query("SELECT id FROM Credential WHERE type = ?")
            .bind(r#type)
            .fetch_optional(pool)
            .await
            .map_err(|e| crate::error::AppError::Database(e.to_string()))?;

        let now_millis = chrono::Utc::now().timestamp_millis();
        let now_iso = chrono::Utc::now().to_rfc3339();

        if let Some(r) = row {
            let id: i32 = r.get("id");
            sqlx::query(
                "UPDATE Credential SET name = ?, appId = ?, appSecret = ?, updatedAt = ? WHERE id = ?"
            )
            .bind(name)
            .bind(app_id)
            .bind(app_secret)
            .bind(now_millis)
            .bind(id)
            .execute(pool)
            .await
            .map_err(|e| crate::error::AppError::Database(e.to_string()))?;
        } else {
            sqlx::query(
                "INSERT INTO Credential (type, name, appId, appSecret, accessToken, refreshToken, expireTime, updatedAt, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
            )
            .bind(r#type)
            .bind(name)
            .bind(app_id)
            .bind(app_secret)
            .bind(None::<String>)
            .bind(None::<String>)
            .bind(0i64)
            .bind(now_millis)
            .bind(now_iso)
            .execute(pool)
            .await
            .map_err(|e| crate::error::AppError::Database(e.to_string()))?;
        }

        Ok(())
    }

    pub async fn get_by_type(&self, r#type: &str) -> AppResult<Option<Credential>> {
        let pool = self.db.pool().await?;
        let row = sqlx::query(
            "SELECT id, type, name, appId, appSecret, accessToken, refreshToken, expireTime, updatedAt, createdAt FROM Credential WHERE type = ?"
        )
        .bind(r#type)
        .fetch_optional(pool)
        .await
        .map_err(|e| crate::error::AppError::Database(e.to_string()))?;

        if let Some(r) = row {
            Ok(Some(Credential {
                id: r.get("id"),
                r#type: r.get("type"),
                name: r.get("name"),
                app_id: r.get("appId"),
                app_secret: r.get("appSecret"),
                access_token: r.get("accessToken"),
                refresh_token: r.get("refreshToken"),
                expire_time: r.get("expireTime"),
                updated_at: r.get("updatedAt"),
                created_at: r.get("createdAt"),
            }))
        } else {
            Ok(None)
        }
    }

    pub async fn update_token(
        &self,
        r#type: &str,
        access_token: Option<String>,
        expire_time: i64,
    ) -> AppResult<()> {
        let pool = self.db.pool().await?;
        let now_millis = chrono::Utc::now().timestamp_millis();
        sqlx::query(
            "UPDATE Credential SET accessToken = ?, expireTime = ?, updatedAt = ? WHERE type = ?",
        )
        .bind(access_token)
        .bind(expire_time)
        .bind(now_millis)
        .bind(r#type)
        .execute(pool)
        .await
        .map_err(|e| crate::error::AppError::Database(e.to_string()))?;

        Ok(())
    }
}
