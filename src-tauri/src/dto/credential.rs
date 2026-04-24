use serde::{Deserialize, Serialize};

/// 凭据数据传输对象 - 用于前端展示
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CredentialDto {
    pub r#type: String,
    pub name: String,
    pub app_id: String,
    pub app_secret: String,
}
