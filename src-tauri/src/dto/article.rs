use serde::{Deserialize, Serialize};

/// 文章数据传输对象 - 用于前端展示
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ArticleDto {
    pub id: String,
    pub title: String,
    pub content: String,
    pub created: i64,
}
