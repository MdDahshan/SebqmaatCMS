use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::fs;
use std::process::Command;

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
fn get_git_status(path: &str) -> Result<GitChangesStatus, String> {
    let output = Command::new("git")
        .current_dir(path)
        .args(["status", "-s"])
        .output()
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
fn get_git_branch_status(path: &str) -> Result<GitBranchStatus, String> {
    let output = Command::new("git")
        .current_dir(path)
        .args(["rev-list", "--left-right", "--count", "HEAD...@{u}"])
        .output()
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
fn get_git_log(path: &str) -> Result<Vec<GitCommitLog>, String> {
    let output = Command::new("git")
        .current_dir(path)
        .args(["log", "-n", "50", "--pretty=format:%H|%s|%an|%ad|%D", "--date=short"])
        .output()
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
fn git_add(path: &str, files: Vec<&str>) -> Result<(), String> {
    let mut cmd = Command::new("git");
    cmd.current_dir(path).arg("add");
    for file in files {
        cmd.arg(file);
    }
    let output = cmd.output().map_err(|e| e.to_string())?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    Ok(())
}

#[tauri::command]
fn git_unstage(path: &str, files: Vec<&str>) -> Result<(), String> {
    let mut cmd = Command::new("git");
    cmd.current_dir(path).args(["reset", "HEAD", "--"]);
    for file in files {
        cmd.arg(file);
    }
    let output = cmd.output().map_err(|e| e.to_string())?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    Ok(())
}

#[tauri::command]
async fn git_commit(path: String, message: String) -> Result<(), String> {
    let output = Command::new("git")
        .current_dir(path)
        .args(["commit", "-m", &message])
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    Ok(())
}

#[tauri::command]
async fn git_push(path: String) -> Result<(), String> {
    let output = Command::new("git")
        .current_dir(path)
        .args(["push"])
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    Ok(())
}

#[tauri::command]
async fn git_pull(path: String) -> Result<(), String> {
    let output = Command::new("git")
        .current_dir(path)
        .args(["pull"])
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    Ok(())
}

#[tauri::command]
fn git_show_file(path: &str, file: &str) -> Result<String, String> {
    // Convert backslashes to forward slashes for git
    let normalized_file = file.replace("\\", "/");
    
    // Prefix with ./ so git resolves it relative to the current directory (path)
    // instead of the git root directory.
    let target = format!("HEAD:./{}", normalized_file);
    let output = Command::new("git")
        .current_dir(path)
        .args(["show", &target])
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

#[tauri::command]
fn git_diff_file(path: &str, file: &str) -> Result<String, String> {
    let normalized_file = file.replace("\\", "/");
    let output = Command::new("git")
        .current_dir(path)
        .args(["diff", "HEAD", "--", &normalized_file])
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
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
            git_diff_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
