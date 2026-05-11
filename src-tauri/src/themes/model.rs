use serde::{Deserialize, Serialize};

/// 主题数据对象
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Theme {
    pub id: i32,
    pub name: String,
    pub content: String,
    pub created_at: String,
}

impl Theme {
    pub fn new(name: String, content: String, created_at: String) -> Self {
        Self {
            id: 0,
            name,
            content,
            created_at,
        }
    }

    pub fn update(&mut self, name: String, content: String) {
        self.name = name;
        self.content = content;
    }
}

/// 主题数据传输对象 - 用于前端展示
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ThemeDto {
    pub id: String,
    pub name: String,
    pub css: String,
}
