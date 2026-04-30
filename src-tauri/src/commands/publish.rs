use crate::application::wechat_service::WechatService;
use crate::dto::publish::WechatPublishOptions;
use crate::error::AppResult;
use crate::infrastructure::db::DbManager;
use tauri::State;

#[tauri::command]
pub async fn publish_wechat_draft(
    db: State<'_, DbManager>,
    options: WechatPublishOptions,
    wechat_enabled: bool,
) -> AppResult<String> {
    let service = WechatService::new(&db);
    service.ensure_ready(wechat_enabled).await?;
    service.publish_article(options).await
}
