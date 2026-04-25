mod commands;

use commands::ProjectRoot;
use tauri::{Emitter, Manager};
use tauri_plugin_deep_link::DeepLinkExt;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default();

    // Single-instance must be the first plugin registered (per Tauri docs).
    // When a second `prezl://` invocation lands while the app is running,
    // single-instance forwards the args to the live instance — single-instance
    // brings the window forward, deep-link delivers the URL via on_open_url.
    #[cfg(any(target_os = "macos", target_os = "windows", target_os = "linux"))]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
            }
        }));
    }

    builder
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .manage(ProjectRoot::default())
        .invoke_handler(tauri::generate_handler![
            commands::load_project,
            commands::read_project_file,
            commands::list_project_files,
            commands::close_project,
            commands::list_recents,
            commands::remember_recent,
            commands::forget_recent,
            commands::read_preferences,
            commands::write_preferences,
            commands::is_portable_mode,
            commands::register_protocol,
            commands::unregister_protocol,
            commands::is_protocol_registered,
            commands::return_to_presentation,
            commands::save_deck_link_file,
        ])
        .setup(|app| {
            // Forward every deep-link URL (cold-start + while running) to the
            // frontend. The frontend hook parses it and routes the open.
            let handle = app.handle().clone();
            app.deep_link().on_open_url(move |event| {
                let urls: Vec<String> = event.urls().iter().map(|u| u.to_string()).collect();
                let _ = handle.emit("prezl://deep-link", urls);
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
