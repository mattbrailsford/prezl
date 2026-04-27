use std::fs;
use std::path::{Component, Path, PathBuf};
use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, State};
use tauri_plugin_deep_link::DeepLinkExt;
use thiserror::Error;

#[derive(Default)]
pub struct ProjectRoot(pub Mutex<Option<PathBuf>>);

#[derive(Debug, Error, Serialize)]
#[serde(tag = "kind", content = "message", rename_all = "kebab-case")]
pub enum CommandError {
    #[error("no project is currently loaded")]
    NoActiveProject,
    #[error("selected folder is missing prezl.yaml")]
    MissingManifest,
    #[error("path {0} escapes the project root")]
    PathEscape(String),
    #[error("file not found: {0}")]
    NotFound(String),
    #[error("io error: {0}")]
    Io(String),
}

impl From<std::io::Error> for CommandError {
    fn from(e: std::io::Error) -> Self {
        match e.kind() {
            std::io::ErrorKind::NotFound => CommandError::NotFound(e.to_string()),
            _ => CommandError::Io(e.to_string()),
        }
    }
}

#[derive(Serialize)]
pub struct ProjectLoad {
    pub root: String,
    pub manifest: String,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct RecentEntry {
    pub path: String,
    pub name: Option<String>,
    pub last_opened_ms: u64,
}

const RECENTS_FILE: &str = "recents.json";
const PREFERENCES_FILE: &str = "preferences.json";
const MAX_RECENTS: usize = 5;

fn normalise_relative(rel: &str) -> Result<PathBuf, CommandError> {
    let candidate = Path::new(rel);
    if candidate.is_absolute() {
        return Err(CommandError::PathEscape(rel.to_string()));
    }
    let mut normalised = PathBuf::new();
    for comp in candidate.components() {
        match comp {
            Component::CurDir => {}
            Component::ParentDir => return Err(CommandError::PathEscape(rel.to_string())),
            Component::Normal(part) => normalised.push(part),
            Component::Prefix(_) | Component::RootDir => {
                return Err(CommandError::PathEscape(rel.to_string()))
            }
        }
    }
    Ok(normalised)
}

fn joined_within_root(root: &Path, rel: &str) -> Result<PathBuf, CommandError> {
    let norm = normalise_relative(rel)?;
    let full = root.join(&norm);
    // Double-check via canonicalisation when the path exists.
    if full.exists() {
        let canonical_root = fs::canonicalize(root)?;
        let canonical_full = fs::canonicalize(&full)?;
        if !canonical_full.starts_with(&canonical_root) {
            return Err(CommandError::PathEscape(rel.to_string()));
        }
    }
    Ok(full)
}

#[tauri::command]
pub fn load_project(
    path: String,
    state: State<ProjectRoot>,
) -> Result<ProjectLoad, CommandError> {
    let root = PathBuf::from(&path);
    if !root.is_dir() {
        return Err(CommandError::NotFound(path));
    }
    // .yaml is the documented extension; .yml is accepted silently in case
    // someone reaches for the wrong one out of habit.
    let manifest_path = ["prezl.yaml", "prezl.yml"]
        .iter()
        .map(|name| root.join(name))
        .find(|p| p.is_file())
        .ok_or(CommandError::MissingManifest)?;
    let manifest = fs::read_to_string(&manifest_path)?;
    let canonical = fs::canonicalize(&root)?;
    *state.0.lock().unwrap() = Some(canonical.clone());
    Ok(ProjectLoad {
        root: display_path(&canonical),
        manifest,
    })
}

/// Render a canonical path in a form the webview / asset protocol can use.
/// On Windows, `fs::canonicalize` produces `\\?\D:\...` (UNC extended-length
/// form); strip that prefix so `convertFileSrc` and external tools see a
/// regular drive path.
fn display_path(p: &Path) -> String {
    let s = p.to_string_lossy();
    #[cfg(windows)]
    {
        if let Some(rest) = s.strip_prefix(r"\\?\") {
            return rest.to_string();
        }
    }
    s.into_owned()
}

const IGNORED_DIR_NAMES: &[&str] = &[
    ".git",
    ".svn",
    ".hg",
    "node_modules",
    "target",
    "bin",
    "obj",
    "dist",
    ".idea",
    ".vscode",
];

/// Walk <project>/files recursively and return every file path relative to it,
/// using forward slashes. Skips dotfiles and common build-output directories.
#[tauri::command]
pub fn list_project_files(state: State<ProjectRoot>) -> Result<Vec<String>, CommandError> {
    let root = {
        let guard = state.0.lock().unwrap();
        guard.clone().ok_or(CommandError::NoActiveProject)?
    };
    let files_root = root.join("files");
    if !files_root.is_dir() {
        return Ok(Vec::new());
    }

    let mut results: Vec<String> = Vec::new();
    walk(&files_root, &files_root, &mut results)?;
    results.sort();
    Ok(results)
}

fn walk(base: &Path, dir: &Path, out: &mut Vec<String>) -> Result<(), CommandError> {
    for entry in fs::read_dir(dir)? {
        let entry = entry?;
        let name = entry.file_name();
        let name_str = name.to_string_lossy();
        // Skip hidden / common noise directories.
        if name_str.starts_with('.') {
            continue;
        }
        let file_type = entry.file_type()?;
        if file_type.is_dir() {
            if IGNORED_DIR_NAMES.contains(&name_str.as_ref()) {
                continue;
            }
            walk(base, &entry.path(), out)?;
        } else if file_type.is_file() {
            let full = entry.path();
            let rel = full.strip_prefix(base).map_err(|e| CommandError::Io(e.to_string()))?;
            let mut parts: Vec<String> = Vec::new();
            for c in rel.components() {
                if let Component::Normal(part) = c {
                    parts.push(part.to_string_lossy().into_owned());
                }
            }
            out.push(parts.join("/"));
        }
    }
    Ok(())
}

#[tauri::command]
pub fn read_project_file(
    rel_path: String,
    state: State<ProjectRoot>,
) -> Result<String, CommandError> {
    let root = {
        let guard = state.0.lock().unwrap();
        guard.clone().ok_or(CommandError::NoActiveProject)?
    };
    // Files referenced by branches live under `files/`. Rooting here also
    // prevents the webview from reading prezl.yaml or other sibling files via
    // this command.
    let files_root = root.join("files");
    let full = joined_within_root(&files_root, &rel_path)?;
    let contents = fs::read_to_string(&full)?;
    Ok(contents)
}

#[tauri::command]
pub fn close_project(state: State<ProjectRoot>) {
    *state.0.lock().unwrap() = None;
}

/// Filename-based portable detection: if the executable's name contains
/// "portable" (case-insensitive), store config + recents in a `data/` folder
/// next to the binary instead of the host's AppData / XDG config dir. The
/// portable Windows release ships as `Prezl-portable.exe`, so dropping that
/// one file anywhere — USB stick, borrowed laptop — is enough to run with
/// state that travels with it.
fn portable_data_dir() -> Option<PathBuf> {
    let exe = std::env::current_exe().ok()?;
    let stem = exe.file_stem()?.to_string_lossy().to_lowercase();
    if !stem.contains("portable") {
        return None;
    }
    Some(exe.parent()?.join("data"))
}

/// True when the running binary is the portable build (filename contains
/// "portable"). The frontend uses this to decide whether to expose the
/// register/unregister protocol toggle — installed builds get scheme
/// registration from the bundler at install time, so the toggle is hidden.
#[tauri::command]
pub fn is_portable_mode() -> bool {
    portable_data_dir().is_some()
}

const DEEP_LINK_SCHEME: &str = "prezl";

#[tauri::command]
pub fn register_protocol(app: AppHandle) -> Result<(), CommandError> {
    app.deep_link()
        .register(DEEP_LINK_SCHEME)
        .map_err(|e| CommandError::Io(e.to_string()))
}

#[tauri::command]
pub fn unregister_protocol(app: AppHandle) -> Result<(), CommandError> {
    app.deep_link()
        .unregister(DEEP_LINK_SCHEME)
        .map_err(|e| CommandError::Io(e.to_string()))
}

#[tauri::command]
pub fn is_protocol_registered(app: AppHandle) -> Result<bool, CommandError> {
    app.deep_link()
        .is_registered(DEEP_LINK_SCHEME)
        .map_err(|e| CommandError::Io(e.to_string()))
}

/// Write a clickable shortcut file containing a `prezl://` URL. Used by
/// the status-bar "Save as shortcut" action so presenters can drop the
/// link into tools (WPS, web slides) that hijack hyperlinks instead of
/// using `ShellExecute`. Format is picked from the target path's
/// extension so the JS side can open a platform-appropriate save dialog
/// (`.url` on Windows, `.webloc` on macOS, `.desktop` on Linux).
#[tauri::command]
pub fn save_deck_link_file(
    target_path: String,
    url: String,
    title: Option<String>,
) -> Result<(), CommandError> {
    let path = PathBuf::from(&target_path);
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();
    let display = title.unwrap_or_else(|| "Open in Prezl".to_string());
    let content = match ext.as_str() {
        "url" => format!("[InternetShortcut]\r\nURL={url}\r\n"),
        "webloc" => format!(
            "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n\
             <!DOCTYPE plist PUBLIC \"-//Apple//DTD PLIST 1.0//EN\" \"http://www.apple.com/DTDs/PropertyList-1.0.dtd\">\n\
             <plist version=\"1.0\">\n\
             <dict>\n\
             \t<key>URL</key>\n\
             \t<string>{}</string>\n\
             </dict>\n\
             </plist>\n",
            xml_escape(&url),
        ),
        "desktop" => format!(
            "[Desktop Entry]\nType=Link\nName={}\nURL={}\nIcon=text-x-generic\n",
            display, url,
        ),
        _ => {
            return Err(CommandError::Io(format!(
                "unsupported shortcut extension: {ext}"
            )))
        }
    };
    fs::write(&path, content)?;
    Ok(())
}

fn xml_escape(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
}

/// Hand focus back to whatever launched Prezl (typically a slide deck).
/// Windows / Linux: minimize the window — Z-order returns focus to the
/// presentation behind it. macOS: hide the app, which jumps back to the
/// previous Space (better behaviour when Keynote is in fullscreen
/// presenter mode on its own Space). Exits fullscreen first either way.
#[tauri::command]
pub fn return_to_presentation(
    window: tauri::Window,
    #[allow(unused_variables)] app: AppHandle,
) -> Result<(), CommandError> {
    if window.is_fullscreen().unwrap_or(false) {
        let _ = window.set_fullscreen(false);
    }
    #[cfg(target_os = "macos")]
    {
        let _ = app.hide();
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = window.minimize();
    }
    Ok(())
}

fn config_dir(app: &AppHandle) -> Result<PathBuf, CommandError> {
    let dir = if let Some(portable) = portable_data_dir() {
        portable
    } else {
        app.path()
            .app_config_dir()
            .map_err(|e| CommandError::Io(e.to_string()))?
    };
    fs::create_dir_all(&dir)?;
    Ok(dir)
}

fn recents_path(app: &AppHandle) -> Result<PathBuf, CommandError> {
    Ok(config_dir(app)?.join(RECENTS_FILE))
}

#[tauri::command]
pub fn list_recents(app: AppHandle) -> Result<Vec<RecentEntry>, CommandError> {
    let path = recents_path(&app)?;
    if !path.exists() {
        return Ok(Vec::new());
    }
    let raw = fs::read_to_string(&path)?;
    let parsed: Vec<RecentEntry> = serde_json::from_str(&raw).unwrap_or_default();
    Ok(parsed)
}

#[tauri::command]
pub fn remember_recent(
    app: AppHandle,
    path: String,
    name: Option<String>,
    last_opened_ms: u64,
) -> Result<Vec<RecentEntry>, CommandError> {
    let file = recents_path(&app)?;
    let mut entries: Vec<RecentEntry> = if file.exists() {
        let raw = fs::read_to_string(&file)?;
        serde_json::from_str(&raw).unwrap_or_default()
    } else {
        Vec::new()
    };
    entries.retain(|e| e.path != path);
    entries.insert(
        0,
        RecentEntry {
            path,
            name,
            last_opened_ms,
        },
    );
    entries.truncate(MAX_RECENTS);
    let json = serde_json::to_string_pretty(&entries)
        .map_err(|e| CommandError::Io(e.to_string()))?;
    fs::write(&file, json)?;
    Ok(entries)
}

fn preferences_path(app: &AppHandle) -> Result<PathBuf, CommandError> {
    Ok(config_dir(app)?.join(PREFERENCES_FILE))
}

#[tauri::command]
pub fn read_preferences(app: AppHandle) -> Result<Option<serde_json::Value>, CommandError> {
    let path = preferences_path(&app)?;
    if !path.exists() {
        return Ok(None);
    }
    let raw = fs::read_to_string(&path)?;
    let value: serde_json::Value = serde_json::from_str(&raw)
        .map_err(|e| CommandError::Io(format!("failed to parse preferences: {e}")))?;
    Ok(Some(value))
}

#[tauri::command]
pub fn write_preferences(
    app: AppHandle,
    preferences: serde_json::Value,
) -> Result<(), CommandError> {
    let path = preferences_path(&app)?;
    let json = serde_json::to_string_pretty(&preferences)
        .map_err(|e| CommandError::Io(e.to_string()))?;
    fs::write(&path, json)?;
    Ok(())
}

#[tauri::command]
pub fn forget_recent(app: AppHandle, path: String) -> Result<Vec<RecentEntry>, CommandError> {
    let file = recents_path(&app)?;
    if !file.exists() {
        return Ok(Vec::new());
    }
    let raw = fs::read_to_string(&file)?;
    let mut entries: Vec<RecentEntry> = serde_json::from_str(&raw).unwrap_or_default();
    entries.retain(|e| e.path != path);
    let json = serde_json::to_string_pretty(&entries)
        .map_err(|e| CommandError::Io(e.to_string()))?;
    fs::write(&file, json)?;
    Ok(entries)
}
