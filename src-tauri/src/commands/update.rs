use crate::application::update_service::UpdateService;
use crate::dto::update::UpdateInfoDto;
use crate::error::AppResult;
use tauri::AppHandle;

#[tauri::command]
pub fn is_updater_enabled() -> bool {
    UpdateService::<tauri::Wry>::is_configured()
}

#[tauri::command]
pub async fn check_for_app_update(app_handle: AppHandle) -> AppResult<Option<UpdateInfoDto>> {
    let service = UpdateService::new(&app_handle);
    service.check_for_update().await
}

#[tauri::command]
pub async fn install_app_update(app_handle: AppHandle) -> AppResult<()> {
    let service = UpdateService::new(&app_handle);
    service.install_update().await
}
