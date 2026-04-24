use tauri::State;
use crate::application::wechat_service::WechatService;
use crate::dto::publish::WechatPublishOptions;
use crate::error::AppResult;
use crate::infrastructure::db::DbManager;

#[tauri::command]
pub async fn publish_wechat_draft(
    db: State<'_, DbManager>,
    options: WechatPublishOptions
) -> AppResult<String> {
    let service = WechatService::new(&db);
    service.publish_article(options).await
}
