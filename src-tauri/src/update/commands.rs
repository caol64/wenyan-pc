use crate::error::AppResult;
use crate::update::model::UpdateInfoDto;
use tauri::AppHandle;

#[tauri::command]
pub fn is_updater_enabled() -> bool {
    crate::update::service::UpdateService::<tauri::Wry>::is_configured()
}

#[tauri::command]
pub async fn check_for_app_update(app_handle: AppHandle) -> AppResult<Option<UpdateInfoDto>> {
    let service = crate::update::service::UpdateService::new(&app_handle);
    service.check_for_update().await
}

#[tauri::command]
pub async fn install_app_update(app_handle: AppHandle) -> AppResult<()> {
    let service = crate::update::service::UpdateService::new(&app_handle);
    service.install_update().await
}
