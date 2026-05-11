use serde::{Deserialize, Serialize};

/// 文章数据对象
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Article {
    pub id: i32,
    pub title: String,
    pub content: String,
    pub file_name: Option<String>,
    pub file_path: Option<String>,
    pub relative_path: Option<String>,
    pub created_at: String,
}

impl Article {
    pub fn has_file(&self) -> bool {
        self.file_path.is_some()
    }

    pub fn update_file_info(
        &mut self,
        file_name: Option<String>,
        file_path: Option<String>,
        relative_path: Option<String>,
    ) {
        self.file_name = file_name;
        self.file_path = file_path;
        self.relative_path = relative_path;
    }
}

/// 文章数据传输对象 - 用于前端展示
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ArticleDto {
    pub id: String,
    pub title: String,
    pub content: String,
    pub created: i64,
}
