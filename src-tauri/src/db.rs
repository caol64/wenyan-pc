use crate::error::AppResult;
use sqlx::sqlite::{SqliteConnectOptions, SqlitePool, SqlitePoolOptions};
use std::fs;
use std::path::PathBuf;
use tauri::AppHandle;
use tauri::Manager;
use tokio::sync::OnceCell;

pub struct DbManager {
    db_path: PathBuf,
    pool: OnceCell<SqlitePool>,
}

impl DbManager {
    pub fn new(app_handle: &AppHandle) -> AppResult<Self> {
        let app_dir = app_handle.path().app_data_dir()?;
        if !app_dir.exists() {
            fs::create_dir_all(&app_dir)?;
        }

        let db_path = app_dir.join("data.db");

        Ok(Self {
            db_path,
            pool: OnceCell::const_new(),
        })
    }

    pub async fn pool(&self) -> AppResult<&SqlitePool> {
        self.pool
            .get_or_try_init(|| async {
                let options = SqliteConnectOptions::new()
                    .filename(&self.db_path)
                    .create_if_missing(true);

                let pool = SqlitePoolOptions::new()
                    .max_connections(5)
                    .connect_with(options)
                    .await
                    .map_err(|e| crate::error::AppError::Database(e.to_string()))?;

                self.init_tables(&pool).await?;
                Ok::<SqlitePool, crate::error::AppError>(pool)
            })
            .await
    }

    async fn init_tables(&self, pool: &SqlitePool) -> AppResult<()> {
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS CustomTheme (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                content TEXT NOT NULL,
                createdAt TEXT NOT NULL
            );
            "#,
        )
        .execute(pool)
        .await
        .map_err(|e| crate::error::AppError::Database(e.to_string()))?;

        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS Article (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                fileName TEXT,
                filePath TEXT,
                relativePath TEXT,
                createdAt TEXT NOT NULL
            );
            "#,
        )
        .execute(pool)
        .await
        .map_err(|e| crate::error::AppError::Database(e.to_string()))?;

        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS Credential (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                type TEXT NOT NULL,
                name TEXT,
                appId TEXT,
                appSecret TEXT,
                accessToken TEXT,
                refreshToken TEXT,
                expireTime INTEGER,
                updatedAt INTEGER,
                createdAt TEXT NOT NULL
            );
            "#,
        )
        .execute(pool)
        .await
        .map_err(|e| crate::error::AppError::Database(e.to_string()))?;

        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS UploadCache (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                md5 TEXT NOT NULL,
                mediaId TEXT NOT NULL,
                url TEXT NOT NULL,
                lastUsed TEXT NOT NULL,
                createdAt TEXT NOT NULL
            );
            "#,
        )
        .execute(pool)
        .await
        .map_err(|e| crate::error::AppError::Database(e.to_string()))?;

        Ok(())
    }
}
