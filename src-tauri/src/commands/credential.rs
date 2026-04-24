use tauri::State;
use crate::domain::credential::Credential;
use crate::dto::credential::CredentialDto;
use crate::error::AppResult;
use crate::infrastructure::db::DbManager;
use crate::infrastructure::repositories::credential::CredentialRepository;

#[tauri::command]
pub async fn load_credentials(db: State<'_, DbManager>) -> AppResult<Vec<CredentialDto>> {
    let repo = CredentialRepository::new(&db);
    repo.load_all().await
}

#[tauri::command]
pub async fn save_credential(
    db: State<'_, DbManager>,
    r#type: String,
    name: Option<String>,
    app_id: Option<String>,
    app_secret: Option<String>
) -> AppResult<()> {
    let repo = CredentialRepository::new(&db);
    repo.save(&r#type, name, app_id, app_secret).await
}

#[tauri::command]
pub async fn update_wechat_token(
    db: State<'_, DbManager>,
    access_token: Option<String>,
    expire_time: i64
) -> AppResult<()> {
    let repo = CredentialRepository::new(&db);
    repo.update_token("wechat", access_token, expire_time).await
}

#[tauri::command]
pub async fn get_wechat_token(db: State<'_, DbManager>) -> AppResult<Option<Credential>> {
    let repo = CredentialRepository::new(&db);
    repo.get_by_type("wechat").await
}
