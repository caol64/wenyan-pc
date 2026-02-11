// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use log::info;
use tauri::Emitter;
use std::fs::File;
use std::io::Read;

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
            let args: Vec<String> = std::env::args().collect();
            if args.len() > 1 {
                let file = args[1].clone();
                let handle = app.handle();
                let _ = handle.emit("open-file", file);
            }
            // if let Some(main_window) = app.get_webview_window("main") {
            //     // 获取线程安全的 AppHandle
            //     let app_handle = app.handle().clone();
            //     main_window.listen("open-about", move |_| {
            //         handle_open_about(&app_handle);
            //     });
            // } else {
            //     error!("Failed to get main window");
            // }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_data_md5,
            get_file_md5,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

// fn handle_open_about(app_handle: &tauri::AppHandle) {
//     if let Some(about_window) = app_handle.get_webview_window("about") {
//         if let Err(e) = about_window.set_focus() {
//             error!("Failed to set focus to about window: {}", e);
//         }
//     } else {
//         match create_about_window(app_handle) {
//             Ok(_) => info!("About window created successfully"),
//             Err(e) => error!("Failed to create about window: {}", e),
//         }
//     }
// }

// fn create_about_window(app_handle: &tauri::AppHandle) -> Result<(), Box<dyn std::error::Error>> {
//     tauri::WebviewWindowBuilder::new(app_handle, "about", WebviewUrl::App("/about".into()))
//         .title("关于")
//         .inner_size(350.0, 200.0)
//         .resizable(false) // 禁用窗口大小调整
//         .minimizable(false) // 禁用最小化按钮
//         .maximizable(false) // 禁用最大化按钮
//         .center() // 将窗口居中显示
//         .build()?;
//     Ok(())
// }

#[tauri::command]
fn get_file_md5(path: String) -> Result<String, String> {
    // 1. 打开文件
    let mut file = File::open(&path).map_err(|e| format!("无法打开文件: {}", e))?;

    // 2. 初始化 MD5 上下文
    let mut context = md5::Context::new();

    // 3. 增大缓冲区到 8KB 或更大 (通常 8*1024 或 64*1024 都不错)
    let mut buffer = [0; 8 * 1024];

    loop {
        // 阻塞读取是安全的，因为我们在普通 fn 中 (Tauri 会在独立线程运行它)
        let count = file.read(&mut buffer).map_err(|e| format!("读取文件失败: {}", e))?;

        if count == 0 {
            break;
        }

        context.consume(&buffer[..count]);
    }

    let digest = context.finalize();
    Ok(format!("{:x}", digest))
}

#[tauri::command]
fn get_data_md5(data: Vec<u8>) -> String {
    // 对于已经在内存中的数据，直接使用 compute 即可
    // md5::compute 接收 &[u8]
    let digest = md5::compute(&data);
    format!("{:x}", digest)
}
