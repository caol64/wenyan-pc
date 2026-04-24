use serde::{Deserialize, Serialize};

/// 文章领域对象 - 用于内部业务逻辑
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
    /// 判断是否有文件关联
    pub fn has_file(&self) -> bool {
        self.file_path.is_some()
    }

    /// 更新文件路径信息
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
