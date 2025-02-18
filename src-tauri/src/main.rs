// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::Manager;
use window_vibrancy::{apply_blur, apply_vibrancy, NSVisualEffectMaterial};

// Learn more about Tauri commands at https://tauri.app/v1/guides/features/command
#[tauri::command]
fn write_html_to_clipboard(app: tauri::AppHandle, text: String) {
    let clipboard = app.state::<tauri_plugin_clipboard::ClipboardManager>();
    clipboard.write_html(text).unwrap();
}

#[tauri::command]
fn write_text_to_clipboard(app: tauri::AppHandle, text: String) {
    let clipboard = app.state::<tauri_plugin_clipboard::ClipboardManager>();
    clipboard.write_text(text).unwrap();
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let main_window = app.get_window("main").unwrap();
            #[cfg(target_os = "macos")]
            apply_vibrancy(&main_window, NSVisualEffectMaterial::HudWindow, None, Some(10.0))
                .expect("Unsupported platform! 'apply_vibrancy' is only supported on macOS");

            #[cfg(target_os = "windows")]
            apply_blur(&main_window, Some((18, 18, 18, 0)))
                .expect("Unsupported platform! 'apply_blur' is only supported on Windows");
            // 获取线程安全的 AppHandle
            let app_handle = app.handle();

            main_window.listen("open-about", move |_| {
                // 检查是否已经存在 ID 为 "about" 的窗口
                if app_handle.get_window("about").is_none() {
                    tauri::WindowBuilder::new(
                        &app_handle, // 使用线程安全的 app_handle
                        "about",     // 新窗口的 id
                        tauri::WindowUrl::App("about.html".into()) // 指定关于页面的路径
                    )
                    .title("关于")
                    .inner_size(350.0, 200.0)
                    .resizable(false) // 禁用窗口大小调整
                    .minimizable(false) // 禁用最小化按钮
                    .maximizable(false) // 禁用最大化按钮
                    .center() // 将窗口居中显示
                    .build()
                    .unwrap();
                }
            });
            Ok(())
        })
        .plugin(tauri_plugin_clipboard::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        // .plugin(tauri_plugin_store::Builder::default().build())
        .invoke_handler(tauri::generate_handler![write_html_to_clipboard, write_text_to_clipboard])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
