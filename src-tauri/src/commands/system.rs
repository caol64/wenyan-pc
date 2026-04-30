use crate::error::AppResult;
use crate::infrastructure::db::DbManager;
use crate::infrastructure::repositories::article::ArticleRepository;
use base64::{Engine as _, engine::general_purpose};
use reqwest::header::CONTENT_TYPE;
use serde::Serialize;
use std::collections::{HashMap, VecDeque};
use std::fs::{self, File};
use std::io::Read;
use std::path::{Path, PathBuf};
use std::sync::{LazyLock, Mutex};
use tauri::State;

const IMAGE_BASE64_CACHE_SIZE: usize = 100;
static IMAGE_BASE64_CACHE: LazyLock<Mutex<FifoCache<String, String>>> =
    LazyLock::new(|| Mutex::new(FifoCache::new(IMAGE_BASE64_CACHE_SIZE)));

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DirEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
}

struct FifoCache<K, V> {
    entries: HashMap<K, V>,
    keys: VecDeque<K>,
    max_size: usize,
}

impl<K, V> FifoCache<K, V>
where
    K: std::cmp::Eq + std::hash::Hash + Clone,
    V: Clone,
{
    fn new(max_size: usize) -> Self {
        Self {
            entries: HashMap::new(),
            keys: VecDeque::new(),
            max_size,
        }
    }

    fn get(&self, key: &K) -> Option<V> {
        self.entries.get(key).cloned()
    }

    fn set(&mut self, key: K, value: V) {
        if self.entries.contains_key(&key) {
            self.keys.retain(|existing| existing != &key);
        } else if self.keys.len() >= self.max_size {
            if let Some(oldest_key) = self.keys.pop_front() {
                self.entries.remove(&oldest_key);
            }
        }

        self.keys.push_back(key.clone());
        self.entries.insert(key, value);
    }
}

#[tauri::command]
pub fn read_directory(path: String) -> AppResult<Vec<DirEntry>> {
    let mut entries = Vec::new();
    for entry in fs::read_dir(path)? {
        let entry = entry?;
        let path = entry.path();
        entries.push(DirEntry {
            name: entry.file_name().to_string_lossy().to_string(),
            path: path.to_string_lossy().to_string(),
            is_dir: path.is_dir(),
        });
    }
    Ok(entries)
}

#[tauri::command]
pub fn unpack_file_path(path: String) -> (String, String) {
    let path = Path::new(&path);
    let file_name = path
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("")
        .to_string();
    let dir = path
        .parent()
        .and_then(|p| p.to_str())
        .unwrap_or("")
        .to_string();
    (file_name, dir)
}

#[tauri::command]
pub async fn save_image(
    app_handle: tauri::AppHandle,
    data: Vec<u8>,
    default_path: Option<String>,
) -> AppResult<Option<String>> {
    use tauri_plugin_dialog::DialogExt;

    let (tx, rx) = tokio::sync::oneshot::channel();
    app_handle
        .dialog()
        .file()
        .set_title("保存导出的图片")
        .add_filter("Image", &["png"])
        .set_file_name(default_path.unwrap_or_else(|| "wenyan-export.png".into()))
        .save_file(move |path| {
            let _ = tx.send(path);
        });
    let result = rx.await.unwrap_or(None);

    if let Some(path) = result {
        let path_str = path.to_string();
        fs::write(path_str.clone(), data)?;
        Ok(Some(path_str))
    } else {
        Ok(None)
    }
}

#[tauri::command]
pub async fn open_file_dialog(app_handle: tauri::AppHandle) -> AppResult<Option<String>> {
    use tauri_plugin_dialog::DialogExt;

    let (tx, rx) = tokio::sync::oneshot::channel();
    app_handle
        .dialog()
        .file()
        .add_filter("Markdown", &["md"])
        .pick_file(move |path| {
            let _ = tx.send(path);
        });
    let result = rx.await.unwrap_or(None);

    Ok(result.map(|p| p.to_string()))
}

#[tauri::command]
pub async fn select_dir_dialog(app_handle: tauri::AppHandle) -> AppResult<Option<String>> {
    use tauri_plugin_dialog::DialogExt;

    let (tx, rx) = tokio::sync::oneshot::channel();
    app_handle.dialog().file().pick_folder(move |path| {
        let _ = tx.send(path);
    });
    let result = rx.await.unwrap_or(None);

    Ok(result.map(|p| p.to_string()))
}

#[tauri::command]
pub fn resolve_path(path: String, base: Option<String>) -> String {
    if let Some(base_path) = base {
        let mut p = PathBuf::from(base_path);
        p.push(path);
        p.to_string_lossy().to_string()
    } else {
        Path::new(&path).to_string_lossy().to_string()
    }
}

#[tauri::command]
pub fn is_absolute_path(path: String) -> bool {
    Path::new(&path).is_absolute()
}

#[tauri::command]
pub async fn write_to_clipboard(
    app_handle: tauri::AppHandle,
    text: String,
    html: Option<String>,
) -> AppResult<()> {
    use tauri_plugin_clipboard_manager::ClipboardExt;
    if let Some(h) = html {
        app_handle
            .clipboard()
            .write_html(h, Some(text))
            .map_err(|e| crate::error::AppError::Internal(e.to_string()))?;
    } else {
        app_handle
            .clipboard()
            .write_text(text)
            .map_err(|e| crate::error::AppError::Internal(e.to_string()))?;
    }
    Ok(())
}

#[tauri::command]
pub async fn download_image(url: String) -> AppResult<Vec<u8>> {
    let resp = reqwest::get(url)
        .await
        .map_err(|e| crate::error::AppError::Network(e.to_string()))?;
    let bytes = resp
        .bytes()
        .await
        .map_err(|e| crate::error::AppError::Network(e.to_string()))?;
    Ok(bytes.to_vec())
}

#[tauri::command]
pub async fn path_to_base64(db: State<'_, DbManager>, path: String) -> AppResult<Option<String>> {
    if path.starts_with("data:") {
        return Ok(Some(path));
    }

    let relative_path = ArticleRepository::new(&db)
        .get_last_article()
        .await?
        .and_then(|article| article.relative_path);

    let (cache_key, data, mime_type) =
        if path.starts_with("http://") || path.starts_with("https://") {
            let resp = reqwest::get(&path)
                .await
                .map_err(|e| crate::error::AppError::Network(e.to_string()))?;
            let mime_type = resp
                .headers()
                .get(CONTENT_TYPE)
                .and_then(|value| value.to_str().ok())
                .and_then(|value| value.split(';').next())
                .unwrap_or("application/octet-stream")
                .to_string();
            let bytes = resp
                .bytes()
                .await
                .map_err(|e| crate::error::AppError::Network(e.to_string()))?;
            (path, bytes.to_vec(), mime_type)
        } else {
            let resolved_path = resolve_image_path(&path, relative_path.as_deref());
            let cache_key = resolved_path.to_string_lossy().to_string();

            if let Some(cached) = get_cached_base64(&cache_key)? {
                return Ok(Some(cached));
            }

            let bytes = fs::read(&resolved_path)?;
            let mime_type = mime_guess::from_path(&resolved_path)
                .first_or_octet_stream()
                .to_string();
            (cache_key, bytes, mime_type)
        };

    if let Some(cached) = get_cached_base64(&cache_key)? {
        return Ok(Some(cached));
    }

    let encoded = format!(
        "data:{};base64,{}",
        mime_type,
        general_purpose::STANDARD.encode(data)
    );
    set_cached_base64(cache_key, encoded.clone())?;

    Ok(Some(encoded))
}

#[tauri::command]
pub async fn fetch_text(url: String) -> AppResult<String> {
    let resp = reqwest::get(url)
        .await
        .map_err(|e| crate::error::AppError::Network(e.to_string()))?;
    let text = resp
        .text()
        .await
        .map_err(|e| crate::error::AppError::Network(e.to_string()))?;
    Ok(text)
}

#[tauri::command]
pub fn open_external(app_handle: tauri::AppHandle, url: String) -> AppResult<()> {
    use tauri_plugin_opener::OpenerExt;
    app_handle
        .opener()
        .open_url(url, None::<&str>)
        .map_err(|e| crate::error::AppError::Internal(e.to_string()))?;
    Ok(())
}

#[tauri::command]
pub fn os_type() -> AppResult<String> {
    let os_type = tauri_plugin_os::type_();
    Ok(os_type.to_string())
}

#[tauri::command]
pub fn get_file_md5(path: String) -> Result<String, String> {
    // 1. 打开文件
    let mut file = File::open(&path).map_err(|e| format!("无法打开文件: {}", e))?;

    // 2. 初始化 MD5 上下文
    let mut context = md5::Context::new();

    // 3. 增大缓冲区到 8KB 或更大 (通常 8*1024 或 64*1024 都不错)
    let mut buffer = [0; 8 * 1024];

    loop {
        // 阻塞读取是安全的，因为我们在普通 fn 中 (Tauri 会在独立线程运行它)
        let count = file
            .read(&mut buffer)
            .map_err(|e| format!("读取文件失败: {}", e))?;

        if count == 0 {
            break;
        }

        context.consume(&buffer[..count]);
    }

    let digest = context.finalize();
    Ok(format!("{:x}", digest))
}

#[tauri::command]
pub fn get_data_md5(data: Vec<u8>) -> String {
    // 对于已经在内存中的数据，直接使用 compute 即可
    // md5::compute 接收 &[u8]
    let digest = md5::compute(&data);
    format!("{:x}", digest)
}

fn resolve_image_path(path: &str, base: Option<&str>) -> PathBuf {
    if Path::new(path).is_absolute() {
        return PathBuf::from(path);
    }

    if let Some(base_path) = base {
        return PathBuf::from(base_path).join(path);
    }

    PathBuf::from(path)
}

fn get_cached_base64(cache_key: &str) -> AppResult<Option<String>> {
    let cache = IMAGE_BASE64_CACHE
        .lock()
        .map_err(|err| crate::error::AppError::Internal(err.to_string()))?;
    Ok(cache.get(&cache_key.to_string()))
}

fn set_cached_base64(cache_key: String, value: String) -> AppResult<()> {
    let mut cache = IMAGE_BASE64_CACHE
        .lock()
        .map_err(|err| crate::error::AppError::Internal(err.to_string()))?;
    cache.set(cache_key, value);
    Ok(())
}
