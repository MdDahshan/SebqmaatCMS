use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::sync::Mutex;
use std::collections::HashMap;
use std::path::Path;
use tokio::fs;
use tokio::process::Command;
use lazy_static::lazy_static;
use uuid::Uuid;
use warp::Filter;

lazy_static! {
    static ref MEDIA_SERVER: Mutex<Option<(u16, String)>> = Mutex::new(None);
}

#[derive(Serialize)]
pub struct MediaServerInfo {
    pub port: u16,
    pub token: String,
}

#[tauri::command]
fn get_media_server_info() -> Result<MediaServerInfo, String> {
    let info = MEDIA_SERVER.lock().unwrap();
    if let Some((port, token)) = &*info {
        Ok(MediaServerInfo {
            port: *port,
            token: token.clone(),
        })
    } else {
        Err("Media server not initialized".to_string())
    }
}

#[derive(Serialize, Deserialize)]
pub struct FileNode {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub children: Option<Vec<FileNode>>,
}

fn read_dir_recursive(path: &str) -> Result<Vec<FileNode>, String> {
    let mut nodes = Vec::new();
    let entries = std::fs::read_dir(path).map_err(|e| e.to_string())?;

    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        let path_buf = entry.path();
        let name = entry.file_name().into_string().unwrap_or_default();
        let is_dir = path_buf.is_dir();

        if is_dir && (name == "node_modules" || name == ".git" || name == "target" || name == "dist") {
            continue;
        }

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
async fn get_files(path: String) -> Result<Vec<FileNode>, String> {
    tokio::task::spawn_blocking(move || read_dir_recursive(&path))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn read_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn write_file(path: String, content: String) -> Result<(), String> {
    fs::write(&path, content).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn upload_media(source_path: String, dest_path: String) -> Result<(), String> {
    fs::copy(&source_path, &dest_path).await.map_err(|e| e.to_string())?;
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
async fn search_files(path: String, query: String) -> Result<Vec<SearchResult>, String> {
    let query_lower = query.to_lowercase();
    
    if query_lower.is_empty() {
        return Ok(Vec::new());
    }
    
    // Spawn blocking to keep heavy JSON parsing off the UI and async executor threads
    let results = tokio::task::spawn_blocking(move || {
        let mut results = Vec::new();
        fn search_dir(dir: &str, query_lower: &str, results: &mut Vec<SearchResult>) -> Result<(), String> {
            let entries = std::fs::read_dir(dir).map_err(|e| e.to_string())?;
            for entry in entries {
                let entry = entry.map_err(|e| e.to_string())?;
                let path_buf = entry.path();
                if path_buf.is_dir() {
                    let dir_name = path_buf.file_name().unwrap_or_default().to_string_lossy();
                    if dir_name == "node_modules" || dir_name == ".git" || dir_name == "target" || dir_name == "dist" {
                        continue;
                    }
                    search_dir(&path_buf.to_string_lossy(), query_lower, results)?;
                } else if path_buf.extension().and_then(|s| s.to_str()) == Some("json") {
                    if let Ok(content) = std::fs::read_to_string(&path_buf) {
                        if !content.to_lowercase().contains(query_lower) {
                            continue; // Fast early exit without parsing JSON
                        }
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
        
        search_dir(&path, &query_lower, &mut results).map(|_| results)
    }).await.map_err(|e| e.to_string())??;
    
    Ok(results)
}

#[derive(Serialize)]
pub struct GitStatusItem {
    pub file: String,
    pub status: String,
}

#[derive(Serialize)]
pub struct GitCommitLog {
    pub hash: String,
    pub message: String,
    pub author: String,
    pub date: String,
    pub refs: String,
}

#[derive(Serialize)]
pub struct GitChangesStatus {
    pub staged: Vec<GitStatusItem>,
    pub unstaged: Vec<GitStatusItem>,
    pub untracked: Vec<GitStatusItem>,
}

#[derive(Serialize)]
pub struct GitBranchStatus {
    pub ahead: u32,
    pub behind: u32,
}

#[tauri::command]
async fn get_git_status(path: String) -> Result<GitChangesStatus, String> {
    let output = Command::new("git")
        .current_dir(&path)
        .args(["status", "-s"])
        .output()
        .await
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    let status_str = String::from_utf8_lossy(&output.stdout);
    let mut staged = Vec::new();
    let mut unstaged = Vec::new();
    let mut untracked = Vec::new();

    for line in status_str.lines() {
        if line.len() > 3 {
            let x = line.chars().nth(0).unwrap_or(' ');
            let y = line.chars().nth(1).unwrap_or(' ');
            let status = line[0..2].to_string();
            let file = line[3..].to_string();

            if x == '?' && y == '?' {
                untracked.push(GitStatusItem { file: file.clone(), status: status.clone() });
            } else {
                if x != ' ' && x != '?' {
                    staged.push(GitStatusItem { file: file.clone(), status: status.clone() });
                }
                if y != ' ' && y != '?' {
                    unstaged.push(GitStatusItem { file, status });
                }
            }
        }
    }

    Ok(GitChangesStatus { staged, unstaged, untracked })
}

#[tauri::command]
async fn get_git_branch_status(path: String) -> Result<GitBranchStatus, String> {
    let output = Command::new("git")
        .current_dir(&path)
        .args(["rev-list", "--left-right", "--count", "HEAD...@{u}"])
        .output()
        .await
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        // If there's no upstream branch set, it will fail. Return 0.
        return Ok(GitBranchStatus { ahead: 0, behind: 0 });
    }

    let status_str = String::from_utf8_lossy(&output.stdout);
    let parts: Vec<&str> = status_str.trim().split_whitespace().collect();
    
    let ahead = parts.get(0).unwrap_or(&"0").parse().unwrap_or(0);
    let behind = parts.get(1).unwrap_or(&"0").parse().unwrap_or(0);

    Ok(GitBranchStatus { ahead, behind })
}

#[tauri::command]
async fn get_git_log(path: String) -> Result<Vec<GitCommitLog>, String> {
    let output = Command::new("git")
        .current_dir(&path)
        .args(["log", "-n", "50", "--pretty=format:%H|%s|%an|%ad|%D", "--date=short"])
        .output()
        .await
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    let log_str = String::from_utf8_lossy(&output.stdout);
    let mut logs = Vec::new();

    for line in log_str.lines() {
        let parts: Vec<&str> = line.split('|').collect();
        if parts.len() >= 4 {
            logs.push(GitCommitLog {
                hash: parts[0].to_string(),
                message: parts[1].to_string(),
                author: parts[2].to_string(),
                date: parts[3].to_string(),
                refs: if parts.len() > 4 { parts[4].to_string() } else { "".to_string() },
            });
        }
    }

    Ok(logs)
}

#[tauri::command]
async fn git_add(path: String, files: Vec<String>) -> Result<(), String> {
    let mut cmd = Command::new("git");
    cmd.current_dir(&path).arg("add");
    for file in files {
        cmd.arg(file);
    }
    let output = cmd.output().await.map_err(|e| e.to_string())?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    Ok(())
}

#[tauri::command]
async fn git_unstage(path: String, files: Vec<String>) -> Result<(), String> {
    let mut cmd = Command::new("git");
    cmd.current_dir(&path).args(["reset", "HEAD", "--"]);
    for file in files {
        cmd.arg(file);
    }
    let output = cmd.output().await.map_err(|e| e.to_string())?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    Ok(())
}

#[tauri::command]
async fn git_commit(path: String, message: String) -> Result<(), String> {
    let output = Command::new("git")
        .current_dir(&path)
        .args(["commit", "-m", &message])
        .output()
        .await
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    Ok(())
}

#[tauri::command]
async fn git_push(path: String) -> Result<(), String> {
    let output = Command::new("git")
        .current_dir(&path)
        .args(["push"])
        .output()
        .await
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    Ok(())
}

#[tauri::command]
async fn git_pull(path: String) -> Result<(), String> {
    let output = Command::new("git")
        .current_dir(&path)
        .args(["pull"])
        .output()
        .await
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    Ok(())
}

#[tauri::command]
async fn git_show_file(path: String, file: String) -> Result<String, String> {
    // Convert backslashes to forward slashes for git
    let normalized_file = file.replace("\\", "/");
    
    // Prefix with ./ so git resolves it relative to the current directory (path)
    // instead of the git root directory.
    let target = format!("HEAD:./{}", normalized_file);
    let output = Command::new("git")
        .current_dir(&path)
        .args(["show", &target])
        .output()
        .await
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

#[tauri::command]
async fn git_diff_file(path: String, file: String) -> Result<String, String> {
    let normalized_file = file.replace("\\", "/");
    let output = Command::new("git")
        .current_dir(&path)
        .args(["diff", "HEAD", "--", &normalized_file])
        .output()
        .await
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

fn find_file_recursively(dir: &Path, target_filename: &str, max_depth: usize) -> Option<String> {
    if max_depth == 0 {
        return None;
    }
    if let Ok(entries) = std::fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                let dir_name = path.file_name().and_then(|s| s.to_str()).unwrap_or("");
                if dir_name == "node_modules" || dir_name == ".git" || dir_name == "target" || dir_name == "dist" {
                    continue;
                }
                if let Some(found) = find_file_recursively(&path, target_filename, max_depth - 1) {
                    return Some(found);
                }
            } else if path.is_file() {
                if let Some(file_name) = path.file_name().and_then(|s| s.to_str()) {
                    if file_name == target_filename {
                        if let Some(s) = path.to_str() {
                            return Some(s.to_string());
                        }
                    }
                }
            }
        }
    }
    None
}

#[tauri::command]
async fn resolve_media_path(base_path: String, parent_path: String, media_path: String) -> Result<String, String> {
    // Spawn blocking because of `std::fs` operations in `find_file_recursively`
    tokio::task::spawn_blocking(move || {
        println!("[MediaResolver] Started resolving path: {}", media_path);
        // 0. Clean media path from quotes, backticks, or extra spaces
        let clean_media_path = media_path.trim().trim_matches(|c| c == '"' || c == '\'' || c == '`');
        println!("[MediaResolver] Cleaned path: {}", clean_media_path);

        let base = Path::new(&base_path);
        let parent_file = Path::new(&parent_path);
        let parent_dir = if parent_file.is_file() {
            parent_file.parent().unwrap_or(base)
        } else {
            parent_file
        };
        
        // 1. Check if it's an absolute path on the user's system
        let raw_path = Path::new(clean_media_path);
        if raw_path.is_absolute() && raw_path.exists() && raw_path.is_file() {
            if let Some(abs_path) = raw_path.to_str() {
                println!("[MediaResolver] Found as absolute path: {}", abs_path);
                return Ok(abs_path.to_string());
            }
        }
        
        // 2. Treat as relative path (strip leading slash so it doesn't resolve to root of filesystem)
        let relative_media_path = clean_media_path.trim_start_matches('/');
        
        let mut possible_paths = vec![
            parent_dir.join(relative_media_path),
            base.join(relative_media_path),
            base.join("public").join(relative_media_path),
            base.join("src").join("assets").join(relative_media_path),
        ];

        if let Some(parent) = base.parent() {
            possible_paths.push(parent.join(relative_media_path));
            possible_paths.push(parent.join("public").join(relative_media_path));
            possible_paths.push(parent.join("src").join("assets").join(relative_media_path));
        }

        for path in possible_paths {
            if path.exists() && path.is_file() {
                if let Some(abs_path) = path.to_str() {
                    println!("[MediaResolver] Found as relative path: {}", abs_path);
                    return Ok(abs_path.to_string());
                }
            }
        }
        
        println!("[MediaResolver] Falling back to recursive search for filename");
        // 3. Smart fallback: Recursive search for the exact filename
        if let Some(filename) = Path::new(&relative_media_path).file_name().and_then(|s| s.to_str()) {
            // Try searching in the opened project base first (depth 5)
            if let Some(found) = find_file_recursively(base, filename, 5) {
                println!("[MediaResolver] Found recursively in base: {}", found);
                return Ok(found);
            }
            
            // If not found, try searching in the parent directory of base (depth 4)
            if let Some(parent) = base.parent() {
                if let Some(found) = find_file_recursively(parent, filename, 4) {
                    println!("[MediaResolver] Found recursively in parent: {}", found);
                    return Ok(found);
                }
            }
        }
        
        println!("[MediaResolver] File not found anywhere!");
        Err("Media file not found".to_string())
    }).await.map_err(|e| e.to_string())?
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(target_os = "linux")]
    std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");

    let security_token = Uuid::new_v4().to_string();
    let token_clone = security_token.clone();

    std::thread::spawn(move || {
        let rt = tokio::runtime::Runtime::new().unwrap();
        rt.block_on(async move {
            let token_filter = warp::query::<HashMap<String, String>>()
                .map(move |q: HashMap<String, String>| {
                    q.get("token") == Some(&token_clone)
                })
                .and_then(|valid: bool| async move {
                    if valid {
                        Ok(())
                    } else {
                        Err(warp::reject::not_found())
                    }
                });

            #[cfg(target_os = "windows")]
            let file_server = warp::fs::dir("C:\\");
            #[cfg(not(target_os = "windows"))]
            let file_server = warp::fs::dir("/");

            let route = warp::any()
                .and(token_filter)
                .and(file_server)
                .map(|_, file| file)
                .with(warp::cors().allow_any_origin());

            let (addr, server) = warp::serve(route).bind_ephemeral(([127, 0, 0, 1], 0));
            
            {
                let mut info = MEDIA_SERVER.lock().unwrap();
                *info = Some((addr.port(), security_token));
            }
            
            server.await;
        });
    });

    tauri::Builder::default()
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            get_files,
            read_file,
            write_file,
            upload_media,
            search_files,
            get_git_status,
            get_git_branch_status,
            get_git_log,
            git_add,
            git_unstage,
            git_commit,
            git_push,
            git_pull,
            git_show_file,
            git_diff_file,
            resolve_media_path,
            get_media_server_info
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
