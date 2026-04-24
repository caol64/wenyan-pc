use serde::{Deserialize, Serialize};

/// 主题数据传输对象 - 用于前端展示
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ThemeDto {
    pub id: String,
    pub name: String,
    pub css: String,
}
