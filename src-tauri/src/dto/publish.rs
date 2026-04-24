use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct WechatArticle {
    pub title: String,
    pub author: Option<String>,
    pub digest: Option<String>,
    pub content: String,
    pub content_source_url: Option<String>,
    pub thumb_media_id: String,
    pub need_open_comment: Option<i32>,
    pub only_fans_can_comment: Option<i32>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct WechatPublishOptions {
    pub articles: Vec<WechatArticle>,
}
