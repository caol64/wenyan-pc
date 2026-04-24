// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod application;
mod commands;
mod domain;
mod dto;
mod error;
mod events;
mod infrastructure;

use log::info;
use tauri::{Emitter, Manager};

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            info!("second instance args: {:?}", argv);

            if argv.len() > 1 {
                let file = argv[1].clone();
                let _ = app.emit("open-file", file);
            }
        }))
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_os::init())
        .setup(|app| {
            let handle = app.handle().clone();
            let db_manager = infrastructure::db::DbManager::new(&handle).expect("failed to init db");
            handle.manage(db_manager);

            let args: Vec<String> = std::env::args().collect();
            if args.len() > 1 {
                let file = args[1].clone();
                let handle = app.handle();
                let _ = handle.emit("open-file", file);
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::system::get_data_md5,
            commands::system::get_file_md5,
            commands::system::read_directory,
            commands::system::unpack_file_path,
            commands::system::resolve_path,
            commands::system::save_image,
            commands::system::open_file_dialog,
            commands::system::select_dir_dialog,
            commands::system::is_absolute_path,
            commands::system::write_to_clipboard,
            commands::system::download_image,
            commands::system::fetch_text,
            commands::system::open_external,
            commands::article::load_articles,
            commands::article::save_article,
            commands::article::remove_article,
            commands::article::open_markdown_file,
            commands::article::get_default_article,
            commands::article::get_last_article_relative_path,
            commands::article::update_last_article_path,
            commands::theme::load_themes,
            commands::theme::save_theme,
            commands::theme::remove_theme,
            commands::credential::load_credentials,
            commands::credential::save_credential,
            commands::credential::update_wechat_token,
            commands::credential::get_wechat_token,
            commands::upload_cache::get_upload_cache,
            commands::upload_cache::set_upload_cache,
            commands::upload_cache::clear_upload_cache,
            commands::upload::upload_image,
            commands::publish::publish_wechat_draft,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
