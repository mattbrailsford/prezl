mod commands;

use commands::ProjectRoot;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(ProjectRoot::default())
        .invoke_handler(tauri::generate_handler![
            commands::load_project,
            commands::read_project_file,
            commands::list_project_files,
            commands::close_project,
            commands::list_recents,
            commands::remember_recent,
            commands::forget_recent,
        ])
        .setup(|_app| Ok(()))
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
