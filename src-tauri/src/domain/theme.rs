use serde::{Deserialize, Serialize};

/// 主题领域对象 - 用于内部业务逻辑
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Theme {
    pub id: i32,
    pub name: String,
    pub content: String,
    pub created_at: String,
}

impl Theme {
    /// 创建新主题
    pub fn new(name: String, content: String, created_at: String) -> Self {
        Self {
            id: 0, // 未持久化时 id 为 0
            name,
            content,
            created_at,
        }
    }

    /// 更新主题内容
    pub fn update(&mut self, name: String, content: String) {
        self.name = name;
        self.content = content;
    }
}
