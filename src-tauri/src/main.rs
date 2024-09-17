// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::Manager;

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
        .plugin(tauri_plugin_clipboard::init())
        // .plugin(tauri_plugin_store::Builder::default().build())
        .invoke_handler(tauri::generate_handler![write_html_to_clipboard, write_text_to_clipboard])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
