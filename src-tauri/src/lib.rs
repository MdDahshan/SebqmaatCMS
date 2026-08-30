use serde::{Deserialize, Serialize};
use serde_json::Value;
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

#[derive(Serialize)]
pub struct SearchResult {
    pub file_path: String,
    pub file_name: String,
    pub section: String,
    pub snippet: String,
}

#[tauri::command]
fn search_files(path: &str, query: &str) -> Result<Vec<SearchResult>, String> {
    let mut results = Vec::new();
    let query_lower = query.to_lowercase();
    
    if query_lower.is_empty() {
        return Ok(results);
    }
    
    fn search_dir(dir: &str, query_lower: &str, results: &mut Vec<SearchResult>) -> Result<(), String> {
        let entries = fs::read_dir(dir).map_err(|e| e.to_string())?;
        for entry in entries {
            let entry = entry.map_err(|e| e.to_string())?;
            let path_buf = entry.path();
            if path_buf.is_dir() {
                search_dir(&path_buf.to_string_lossy(), query_lower, results)?;
            } else if path_buf.extension().and_then(|s| s.to_str()) == Some("json") {
                if let Ok(content) = fs::read_to_string(&path_buf) {
                    if let Ok(Value::Object(map)) = serde_json::from_str(&content) {
                        let file_name = path_buf.file_name().unwrap_or_default().to_string_lossy().to_string();
                        let file_path = path_buf.to_string_lossy().to_string();
                        
                        for (key, val) in map {
                            let val_str = val.to_string();
                            if val_str.to_lowercase().contains(query_lower) {
                                results.push(SearchResult {
                                    file_path: file_path.clone(),
                                    file_name: file_name.clone(),
                                    section: key.clone(),
                                    snippet: format!("Match found in {}", key),
                                });
                            }
                        }
                    }
                }
            }
        }
        Ok(())
    }
    
    search_dir(path, &query_lower, &mut results)?;
    Ok(results)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            get_files,
            read_file,
            write_file,
            upload_media,
            search_files
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
