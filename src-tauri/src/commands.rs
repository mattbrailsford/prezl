use std::fs;
use std::path::{Component, Path, PathBuf};
use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, State};
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
    let manifest_path = root.join("prezl.yaml");
    if !manifest_path.is_file() {
        return Err(CommandError::MissingManifest);
    }
    let manifest = fs::read_to_string(&manifest_path)?;
    let canonical = fs::canonicalize(&root)?;
    *state.0.lock().unwrap() = Some(canonical.clone());
    Ok(ProjectLoad {
        root: canonical.to_string_lossy().into_owned(),
        manifest,
    })
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

fn recents_path(app: &AppHandle) -> Result<PathBuf, CommandError> {
    let dir = app
        .path()
        .app_config_dir()
        .map_err(|e| CommandError::Io(e.to_string()))?;
    fs::create_dir_all(&dir)?;
    Ok(dir.join(RECENTS_FILE))
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
