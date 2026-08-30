use serde::{Deserialize, Serialize};
use std::fs;

#[derive(Serialize, Deserialize)]
pub struct FileNode {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub children: Option<Vec<FileNode>>,
}

fn read_dir_recursive(path: &str) -> Result<Vec<FileNode>, String> {
    let mut nodes = Vec::new();
    let entries = fs::read_dir(path).map_err(|e| e.to_string())?;

    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        let path_buf = entry.path();
        let name = entry.file_name().into_string().unwrap_or_default();
        let is_dir = path_buf.is_dir();

        let children = if is_dir {
            Some(read_dir_recursive(&path_buf.to_string_lossy())?)
        } else {
            None
        };

        nodes.push(FileNode {
            name,
            path: path_buf.to_string_lossy().to_string(),
            is_dir,
            children,
        });
    }

    nodes.sort_by(|a, b| b.is_dir.cmp(&a.is_dir).then(a.name.cmp(&b.name)));
    Ok(nodes)
}

#[tauri::command]
fn get_files(path: &str) -> Result<Vec<FileNode>, String> {
    read_dir_recursive(path)
}

#[tauri::command]
fn read_file(path: &str) -> Result<String, String> {
    fs::read_to_string(path).map_err(|e| e.to_string())
}

#[tauri::command]
fn write_file(path: &str, content: &str) -> Result<(), String> {
    fs::write(path, content).map_err(|e| e.to_string())
}

#[tauri::command]
fn upload_media(source_path: &str, dest_path: &str) -> Result<(), String> {
    fs::copy(source_path, dest_path).map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            get_files,
            read_file,
            write_file,
            upload_media
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
