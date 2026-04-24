use serde::{Deserialize, Serialize};

/// 上传缓存领域对象 - 用于内部业务逻辑
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UploadCache {
    pub id: i32,
    pub md5: String,
    pub media_id: String,
    pub url: String,
    pub last_used: String,
    pub created_at: String,
}

impl UploadCache {
    /// 判断缓存是否匹配给定的 MD5
    pub fn matches_md5(&self, md5: &str) -> bool {
        self.md5 == md5
    }
}
