// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{Listener, Manager, WebviewUrl};
use log::{info, error};

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_os::init())
        .setup(|app| {
            if let Some(main_window) = app.get_webview_window("main") {
                // 获取线程安全的 AppHandle
                let app_handle = app.handle().clone();
                main_window.listen("open-about", move |_| {
                    handle_open_about(&app_handle);
                });
            } else {
                error!("Failed to get main window");
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn handle_open_about(app_handle: &tauri::AppHandle) {
    if let Some(about_window) = app_handle.get_webview_window("about") {
        if let Err(e) = about_window.set_focus() {
            error!("Failed to set focus to about window: {}", e);
        }
    } else {
        match create_about_window(app_handle) {
            Ok(_) => info!("About window created successfully"),
            Err(e) => error!("Failed to create about window: {}", e),
        }
    }
}

fn create_about_window(app_handle: &tauri::AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    tauri::WebviewWindowBuilder::new(
        app_handle,
        "about",
        WebviewUrl::App("about.html".into()),
    )
    .title("关于")
    .inner_size(350.0, 200.0)
    .resizable(false) // 禁用窗口大小调整
    .minimizable(false) // 禁用最小化按钮
    .maximizable(false) // 禁用最大化按钮
    .center() // 将窗口居中显示
    .build()?;
    Ok(())
}