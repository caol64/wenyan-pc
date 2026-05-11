// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod articles;
mod db;
mod error;
mod system;
mod themes;
mod update;
mod wechat;

use log::info;
use tauri::{Emitter, Manager};

fn main() {
    let mut updater_builder = tauri_plugin_updater::Builder::new();
    if let Some(pubkey) = option_env!("WENYAN_UPDATER_PUBKEY")
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        updater_builder = updater_builder.pubkey(pubkey.replace("\\n", "\n"));
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            info!("second instance args: {:?}", argv);

            if argv.len() > 1 {
                let file = argv[1].clone();
                let _ = app.emit("open-file", file);
            }
        }))
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(updater_builder.build())
        .setup(|app| {
            let handle = app.handle().clone();
            let db_manager = db::DbManager::new(&handle).expect("failed to init db");
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
            system::commands::get_data_md5,
            system::commands::get_file_md5,
            system::commands::read_directory,
            system::commands::unpack_file_path,
            system::commands::resolve_path,
            system::commands::save_image,
            system::commands::open_file_dialog,
            system::commands::select_dir_dialog,
            system::commands::is_absolute_path,
            system::commands::write_to_clipboard,
            system::commands::download_image,
            system::commands::path_to_base64,
            system::commands::fetch_text,
            system::commands::open_external,
            system::commands::os_type,
            articles::commands::load_articles,
            articles::commands::save_article,
            articles::commands::remove_article,
            articles::commands::open_markdown_file,
            articles::commands::open_markdown_file_processed,
            articles::commands::get_default_article,
            articles::commands::get_last_article_relative_path,
            articles::commands::update_last_article_path,
            themes::commands::load_themes,
            themes::commands::save_theme,
            themes::commands::remove_theme,
            wechat::commands::load_credentials,
            wechat::commands::save_credential,
            wechat::commands::update_wechat_token,
            wechat::commands::get_wechat_token,
            wechat::commands::get_upload_cache,
            wechat::commands::set_upload_cache,
            wechat::commands::clear_upload_cache,
            wechat::commands::upload_image,
            wechat::commands::process_markdown_content,
            wechat::commands::publish_wechat_draft,
            update::commands::is_updater_enabled,
            update::commands::check_for_app_update,
            update::commands::install_app_update,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
