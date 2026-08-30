import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";

interface GitStatusItem {
  file: string;
  status: string;
}

interface GitChangesStatus {
  staged: GitStatusItem[];
  unstaged: GitStatusItem[];
  untracked: GitStatusItem[];
}

interface GitBranchStatus {
  ahead: number;
  behind: number;
}

interface GitCommitLog {
  hash: string;
  message: string;
  author: string;
  date: string;
  refs: string;
}

interface GitPanelProps {
  contentPath: string;
  onSelectFile: (path: string, section?: string, mode?: 'editor' | 'diff') => void;
}

export function GitPanel({ contentPath, onSelectFile }: GitPanelProps) {
  const [stagedFiles, setStagedFiles] = useState<GitStatusItem[]>([]);
  const [unstagedFiles, setUnstagedFiles] = useState<GitStatusItem[]>([]);
  const [branchStatus, setBranchStatus] = useState<GitBranchStatus>({ ahead: 0, behind: 0 });
  const [logs, setLogs] = useState<GitCommitLog[]>([]);
  
  const [message, setMessage] = useState("");
  const [isCommitting, setIsCommitting] = useState(false);
  const [isPushing, setIsPushing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [actionsMenuOpen, setActionsMenuOpen] = useState(false);
  const [stagedOpen, setStagedOpen] = useState(true);
  const [changesOpen, setChangesOpen] = useState(true);
  const [commitsOpen, setCommitsOpen] = useState(true);

  const fetchGitData = async () => {
    try {
      setError(null);
      const [statusData, branchData, logData] = await Promise.all([
        invoke<GitChangesStatus>("get_git_status", { path: contentPath }),
        invoke<GitBranchStatus>("get_git_branch_status", { path: contentPath }),
        invoke<GitCommitLog[]>("get_git_log", { path: contentPath }),
      ]);
      setStagedFiles(statusData.staged);
      setUnstagedFiles([...statusData.unstaged, ...statusData.untracked]);
      setBranchStatus(branchData);
      setLogs(logData);
    } catch (e: any) {
      setError(e.toString());
    }
  };

  useEffect(() => {
    fetchGitData();
    const interval = setInterval(fetchGitData, 3000);
    return () => clearInterval(interval);
  }, [contentPath]);

  const handleStage = async (file: string) => {
    try {
      await invoke("git_add", { path: contentPath, files: [file] });
      await fetchGitData();
    } catch (e: any) { setError(e.toString()); }
  };

  const handleUnstage = async (file: string) => {
    try {
      await invoke("git_unstage", { path: contentPath, files: [file] });
      await fetchGitData();
    } catch (e: any) { setError(e.toString()); }
  };

  const handleStageAll = async () => {
    try {
      const filesToStage = unstagedFiles.map(f => f.file);
      if (filesToStage.length === 0) return;
      await invoke("git_add", { path: contentPath, files: filesToStage });
      await fetchGitData();
    } catch (e: any) { setError(e.toString()); }
  };

  const handleUnstageAll = async () => {
    try {
      const filesToUnstage = stagedFiles.map(f => f.file);
      if (filesToUnstage.length === 0) return;
      await invoke("git_unstage", { path: contentPath, files: filesToUnstage });
      await fetchGitData();
    } catch (e: any) { setError(e.toString()); }
  };

  const handleCommit = async (autoStageAll = false) => {
    if (!message.trim()) return;
    if (!autoStageAll && stagedFiles.length === 0) return;

    setIsCommitting(true);
    try {
      if (autoStageAll) {
        const filesToStage = unstagedFiles.map(f => f.file);
        if (filesToStage.length > 0) {
          await invoke("git_add", { path: contentPath, files: filesToStage });
        }
      }
      await invoke("git_commit", { path: contentPath, message });
      setMessage("");
      await fetchGitData();
    } catch (e: any) {
      setError(e.toString());
    } finally {
      setIsCommitting(false);
    }
  };

  const handlePush = async () => {
    setIsPushing(true);
    try {
      await invoke("git_push", { path: contentPath });
      await fetchGitData();
    } catch (e: any) {
      setError(e.toString());
    } finally {
      setIsPushing(false);
    }
  };

  const handlePull = async () => {
    setIsPulling(true);
    try {
      await invoke("git_pull", { path: contentPath });
      await fetchGitData();
    } catch (e: any) {
      setError(e.toString());
    } finally {
      setIsPulling(false);
    }
  };

  const handleSync = async () => {
    setIsPulling(true);
    setIsPushing(true);
    try {
      await invoke("git_pull", { path: contentPath });
      await invoke("git_push", { path: contentPath });
      await fetchGitData();
    } catch (e: any) {
      setError(e.toString());
    } finally {
      setIsPulling(false);
      setIsPushing(false);
    }
  };

  const handleCommitAndPush = async (autoStageAll = false) => {
    if (!message.trim()) return;
    if (!autoStageAll && stagedFiles.length === 0) return;

    setIsCommitting(true);
    setIsPushing(true);
    try {
      if (autoStageAll) {
        const filesToStage = unstagedFiles.map(f => f.file);
        if (filesToStage.length > 0) {
          await invoke("git_add", { path: contentPath, files: filesToStage });
        }
      }
      await invoke("git_commit", { path: contentPath, message });
      setMessage("");
      await invoke("git_push", { path: contentPath });
      await fetchGitData();
    } catch (e: any) {
      setError(e.toString());
    } finally {
      setIsCommitting(false);
      setIsPushing(false);
    }
  };

  const parseFilePath = (path: string) => {
    const raw = path.trim().replace(/"/g, '');
    const parts = raw.split(/[/\\]/);
    const fileName = parts.pop() || '';
    const dir = parts.join('/');
    return { raw, fileName, dir };
  };

  const getStatusVisuals = (statusStr: string) => {
    if (statusStr.includes('M')) return { char: 'M', color: 'text-amber-500' };
    if (statusStr.includes('A') || statusStr.includes('?')) return { char: 'U', color: 'text-emerald-500' };
    if (statusStr.includes('D')) return { char: 'D', color: 'text-rose-500' };
    return { char: statusStr.trim(), color: 'text-white/50' };
  };

  const hasStaged = stagedFiles.length > 0;
  const hasUnstaged = unstagedFiles.length > 0;
  const canPublish = branchStatus.ahead > 0;
  const isBusy = isCommitting || isPushing || isPulling;

  let primaryAction = 'commit';
  if (hasStaged || hasUnstaged) {
    primaryAction = 'commit';
  } else if (canPublish && branchStatus.behind === 0) {
    primaryAction = 'publish';
  } else if (canPublish || branchStatus.behind > 0) {
    primaryAction = 'sync';
  }

  const renderFileList = (files: GitStatusItem[], isStaged: boolean) => {
    if (files.length === 0) {
       return <div className="px-6 py-2 text-white/40 text-[12px]">No changes</div>;
    }
    return (
      <div className="flex flex-col">
        {files.map((item, i) => {
          const { raw, fileName, dir } = parseFilePath(item.file);
          const vis = getStatusVisuals(item.status);
          return (
            <div 
              key={i} 
              className="flex items-center gap-2 px-6 py-1 hover:bg-white/5 group transition-colors relative"
            >
              <div 
                onClick={() => {
                  const separator = contentPath.endsWith('/') || contentPath.endsWith('\\') ? '' : '/';
                  onSelectFile(`${contentPath}${separator}${raw}`, undefined, 'diff');
                }}
                className="flex-1 min-w-0 flex items-baseline gap-1.5 cursor-pointer"
              >
                <span className="text-white/90 text-[13px] truncate">{fileName}</span>
                {dir && <span className="text-white/40 text-[11px] truncate">{dir}</span>}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => isStaged ? handleUnstage(item.file) : handleStage(item.file)}
                  className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-white/10 rounded transition-all flex items-center justify-center text-white/70 hover:text-white"
                  title={isStaged ? "Unstage Changes" : "Stage Changes"}
                >
                  <span className="material-symbols-outlined text-[14px]">
                    {isStaged ? 'remove' : 'add'}
                  </span>
                </button>
                <span className={`text-[12px] font-mono font-bold w-4 text-right ${vis.color}`}>
                  {vis.char}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-sidebar overflow-hidden relative text-white">
      {/* Header */}
      <div className="flex flex-col gap-3 shrink-0 pt-2 pb-4">
        <div className="flex items-center justify-between px-4">
          <span className="text-[11px] font-semibold text-white/50 tracking-wider">SOURCE CONTROL</span>
          <div className="flex items-center gap-1">
             <button 
               onClick={fetchGitData}
               className="p-1 rounded hover:bg-white/10 text-white/50 hover:text-white transition-colors flex items-center justify-center"
               title="Refresh"
             >
               <span className={`material-symbols-outlined text-[14px] ${isBusy ? 'animate-spin' : ''}`}>refresh</span>
             </button>
          </div>
        </div>

        {error && (
          <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-2 rounded-md text-xs mx-4 break-words">
            {error}
          </div>
        )}
        
        <div className="px-4 flex flex-col gap-2">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Message (Cmd+Enter to commit)"
            rows={2}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                if (primaryAction === 'commit') {
                   handleCommit(!hasStaged && hasUnstaged);
                }
              }
            }}
            className="w-full bg-white/5 border border-white/10 rounded-md px-2.5 py-2 text-[13px] text-white focus:outline-none focus:border-white/30 transition-all placeholder:text-white/30 resize-none"
          />
          <div className="flex w-full h-[32px]">
            <Button
              onClick={() => {
                 if (primaryAction === 'commit') {
                    handleCommit(!hasStaged && hasUnstaged);
                 }
                 else if (primaryAction === 'publish') handlePush();
                 else if (primaryAction === 'sync') handleSync();
              }}
              disabled={(primaryAction === 'commit' && !message.trim()) || isBusy}
              className={`flex-1 h-full text-[13px] font-semibold rounded-l-md rounded-r-none transition-all flex items-center justify-center gap-1.5 ${
                primaryAction === 'commit' && (hasStaged || hasUnstaged)
                  ? "bg-primary text-primary-foreground hover:bg-primary/90" 
                  : "bg-white/5 hover:bg-white/10 text-white border-y border-l border-white/10 border-r-0"
              }`}
            >
              {isBusy ? (
                 <span className="material-symbols-outlined text-[14px] animate-spin">progress_activity</span>
              ) : primaryAction === 'commit' ? (
                <>
                  <span className="material-symbols-outlined text-[14px]">check</span>
                  Commit
                </>
              ) : primaryAction === 'publish' ? (
                <div className="relative flex items-center justify-center w-full h-full">
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[14px]">cloud_upload</span>
                    <span>Publish Branch</span>
                  </div>
                  {branchStatus.ahead > 0 && (
                    <div className="absolute right-2 flex items-center">
                      <span className="bg-[#e5e5e5] text-black h-4 min-w-[16px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center shadow-sm">
                        {branchStatus.ahead}
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="relative flex items-center justify-center w-full h-full">
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[14px]">sync</span>
                    <span>Sync Changes</span>
                  </div>
                  {(branchStatus.ahead > 0 || branchStatus.behind > 0) && (
                    <div className="absolute right-2 flex items-center">
                      <span className="bg-[#e5e5e5] text-black h-4 px-1.5 rounded-full text-[10px] font-bold flex items-center justify-center shadow-sm gap-0.5">
                        {branchStatus.behind > 0 && <span>{branchStatus.behind}↓</span>}
                        {branchStatus.ahead > 0 && <span>{branchStatus.ahead}↑</span>}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </Button>
            
            <div className="relative">
              <Button
                onClick={() => setActionsMenuOpen(!actionsMenuOpen)}
                disabled={isBusy}
                className={`w-[32px] h-full rounded-r-md rounded-l-none transition-all flex items-center justify-center p-0 border-l border-black/20 ${
                  primaryAction === 'commit' && (hasStaged || hasUnstaged)
                    ? "bg-primary text-primary-foreground hover:bg-primary/90" 
                    : "bg-white/5 hover:bg-white/10 text-white border-y border-r border-white/10"
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">
                  keyboard_arrow_down
                </span>
              </Button>

              <AnimatePresence>
                {actionsMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setActionsMenuOpen(false)} />
                    <motion.div
                      initial={{ opacity: 0, y: -5, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -5, scale: 0.95 }}
                      transition={{ duration: 0.1 }}
                      className="absolute right-0 top-[calc(100%+4px)] w-44 bg-[#1e1e1e] border border-white/10 rounded-lg shadow-2xl z-50 py-1 overflow-hidden backdrop-blur-xl"
                    >
                      <button 
                        onClick={() => { handleCommitAndPush(!hasStaged && hasUnstaged); setActionsMenuOpen(false); }}
                        disabled={!(hasStaged || hasUnstaged) || !message.trim()}
                        className="w-full text-left px-3 py-1.5 text-[12px] text-white/75 hover:bg-white/5 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
                      >
                        <span className="material-symbols-outlined text-[14px]">done_all</span>
                        Commit & Push
                      </button>
                      
                      <div className="h-px bg-white/10 my-1 mx-2" />
                      
                      <button 
                        onClick={() => { handlePush(); setActionsMenuOpen(false); }}
                        className="w-full text-left px-3 py-1.5 text-[12px] text-white/75 hover:bg-white/5 hover:text-white flex items-center gap-2 transition-colors"
                      >
                        <span className="material-symbols-outlined text-[14px]">arrow_upward</span>
                        Push
                      </button>
                      <button 
                        onClick={() => { handlePull(); setActionsMenuOpen(false); }}
                        className="w-full text-left px-3 py-1.5 text-[12px] text-white/75 hover:bg-white/5 hover:text-white flex items-center gap-2 transition-colors"
                      >
                        <span className="material-symbols-outlined text-[14px]">arrow_downward</span>
                        Pull
                      </button>
                      <button 
                        onClick={() => { handleSync(); setActionsMenuOpen(false); }}
                        className="w-full text-left px-3 py-1.5 text-[12px] text-white/75 hover:bg-white/5 hover:text-white flex items-center gap-2 transition-colors"
                      >
                        <span className="material-symbols-outlined text-[14px]">sync</span>
                        Sync
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto flex flex-col custom-scrollbar pb-4">
        {/* Staged Changes Section */}
        {(stagedFiles.length > 0 || unstagedFiles.length === 0) && (
          <div className="flex flex-col">
            <div className="flex items-center group/header hover:bg-white/5 transition-all">
              <button 
                onClick={() => setStagedOpen(!stagedOpen)}
                className="flex items-center gap-1 px-1 py-1 text-white/90 text-[11px] font-bold flex-1 text-left shrink-0 focus:outline-none"
              >
                <span className="material-symbols-outlined text-[14px] text-white/50">
                  {stagedOpen ? "keyboard_arrow_down" : "keyboard_arrow_right"}
                </span>
                STAGED CHANGES
                <span className="ml-1.5 bg-white/10 px-1.5 py-0.5 rounded-full text-[9px] font-mono leading-none text-white/70">
                  {stagedFiles.length}
                </span>
              </button>
              {stagedFiles.length > 0 && (
                <button 
                  onClick={handleUnstageAll}
                  className="mr-4 opacity-0 group-hover/header:opacity-100 hover:text-white text-white/50 transition-all"
                  title="Unstage All Changes"
                >
                  <span className="material-symbols-outlined text-[14px] block">remove</span>
                </button>
              )}
            </div>
            
            <AnimatePresence>
              {stagedOpen && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="flex flex-col overflow-hidden"
                >
                  {renderFileList(stagedFiles, true)}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Changes Section */}
        {unstagedFiles.length > 0 && (
          <div className="flex flex-col mt-2">
            <div className="flex items-center group/header hover:bg-white/5 transition-all">
              <button 
                onClick={() => setChangesOpen(!changesOpen)}
                className="flex items-center gap-1 px-1 py-1 text-white/90 text-[11px] font-bold flex-1 text-left shrink-0 focus:outline-none"
              >
                <span className="material-symbols-outlined text-[14px] text-white/50">
                  {changesOpen ? "keyboard_arrow_down" : "keyboard_arrow_right"}
                </span>
                CHANGES
                <span className="ml-1.5 bg-white/10 px-1.5 py-0.5 rounded-full text-[9px] font-mono leading-none text-white/70">
                  {unstagedFiles.length}
                </span>
              </button>
              {unstagedFiles.length > 0 && (
                <button 
                  onClick={handleStageAll}
                  className="mr-4 opacity-0 group-hover/header:opacity-100 hover:text-white text-white/50 transition-all"
                  title="Stage All Changes"
                >
                  <span className="material-symbols-outlined text-[14px] block">add</span>
                </button>
              )}
            </div>
            
            <AnimatePresence>
              {changesOpen && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="flex flex-col overflow-hidden"
                >
                  {renderFileList(unstagedFiles, false)}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Commits Section */}
        <div className="flex flex-col mt-4">
          <div className="flex items-center group/header hover:bg-white/5 transition-all">
            <button 
              onClick={() => setCommitsOpen(!commitsOpen)}
              className="flex items-center gap-1 px-1 py-1 text-white/90 text-[11px] font-bold flex-1 text-left shrink-0 focus:outline-none"
            >
              <span className="material-symbols-outlined text-[14px] text-white/50">
                {commitsOpen ? "keyboard_arrow_down" : "keyboard_arrow_right"}
              </span>
              COMMITS
              {branchStatus.ahead > 0 && (
                 <span className="ml-1.5 text-blue-400 font-mono text-[9px] bg-blue-500/10 px-1.5 py-0.5 rounded-full">
                    {branchStatus.ahead} ahead
                 </span>
              )}
              {branchStatus.behind > 0 && (
                 <span className="ml-1.5 text-rose-400 font-mono text-[9px] bg-rose-500/10 px-1.5 py-0.5 rounded-full">
                    {branchStatus.behind} behind
                 </span>
              )}
            </button>
          </div>
          
          <AnimatePresence>
            {commitsOpen && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="flex flex-col overflow-hidden"
              >
                {logs.length === 0 ? (
                  <div className="px-6 py-2 text-white/40 text-[12px]">No commits</div>
                ) : (
                  <div className="flex flex-col relative before:absolute before:left-[17.5px] before:top-2 before:bottom-4 before:w-[1px] before:bg-white/10">
                    {logs.map((log, i) => (
                      <div key={log.hash} className="flex items-start gap-3 px-3 py-2 hover:bg-white/5 group relative z-10 transition-colors cursor-default">
                        <div className="mt-[4px] shrink-0 bg-sidebar py-0.5 relative z-10">
                          <div className={`w-[10px] h-[10px] rounded-full border-[2px] ${i === 0 ? 'border-primary bg-sidebar shadow-[0_0_8px_rgba(255,255,255,0.2)]' : 'border-white/30 bg-sidebar'}`} />
                        </div>
                        <div className="flex flex-col min-w-0 flex-1 gap-[2px]">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[12px] text-white/90 font-medium truncate group-hover:text-white transition-colors" title={log.message}>
                              {log.message}
                            </span>
                            {log.refs && (
                              <span className="shrink-0 px-1.5 py-[1px] rounded-[4px] bg-white/10 text-white/60 text-[9px] font-mono whitespace-nowrap leading-none">
                                {log.refs.split(',')[0].replace('HEAD -> ', '')}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px] text-white/40">
                            <span className="font-mono">{log.hash.substring(0, 7)}</span>
                            <span>•</span>
                            <span className="truncate">{log.author}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
