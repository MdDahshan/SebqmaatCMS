import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";

interface GitStatusItem {
  file: string;
  status: string;
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
  const [status, setStatus] = useState<GitStatusItem[]>([]);
  const [logs, setLogs] = useState<GitCommitLog[]>([]);
  const [message, setMessage] = useState("");
  const [isCommitting, setIsCommitting] = useState(false);
  const [isPushing, setIsPushing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [changesOpen, setChangesOpen] = useState(true);
  const [graphOpen, setGraphOpen] = useState(true);

  const fetchGitData = async () => {
    try {
      setError(null);
      const [statusData, logData] = await Promise.all([
        invoke<GitStatusItem[]>("get_git_status", { path: contentPath }),
        invoke<GitCommitLog[]>("get_git_log", { path: contentPath }),
      ]);
      setStatus(statusData);
      setLogs(logData);
    } catch (e: any) {
      setError(e.toString());
    }
  };

  useEffect(() => {
    fetchGitData();
  }, [contentPath]);

  const handleCommit = async () => {
    if (!message.trim()) return;
    setIsCommitting(true);
    try {
      await invoke("git_add", { path: contentPath, files: ["."] });
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

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden relative">
      <div className="flex flex-col gap-3 shrink-0 mb-4">
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-2 rounded-md text-xs mb-2 mx-4">
            {error}
          </div>
        )}
        
        <div className="relative mx-4">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Message (Enter to commit)"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleCommit();
              }
            }}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-[13px] text-white focus:outline-none focus:border-white/30 transition-all placeholder:text-white/30"
          />
        </div>

        <div className="px-4">
          <Button
            onClick={handlePush}
            disabled={isPushing}
            className="w-full h-[32px] bg-white/5 hover:bg-white/10 text-white text-[13px] font-semibold rounded-md transition-all flex items-center justify-center gap-2 border border-white/10"
          >
            <span className="material-symbols-outlined text-[16px]">{isPushing ? "sync" : "cloud_upload"}</span>
            Publish Branch
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Changes Section */}
        <div className="flex flex-col flex-1 overflow-hidden">
          <button 
            onClick={() => setChangesOpen(!changesOpen)}
            className="flex items-center gap-1 px-2 py-1 text-white/70 hover:text-white hover:bg-white/5 transition-all text-[11px] font-semibold uppercase tracking-wider w-full text-left shrink-0"
          >
            <span className="material-symbols-outlined text-[16px]">
              {changesOpen ? "keyboard_arrow_down" : "keyboard_arrow_right"}
            </span>
            Changes <span className="ml-1 bg-white/10 px-1.5 rounded-full text-[10px] normal-case font-mono">{status.length}</span>
          </button>
          
          <AnimatePresence>
            {changesOpen && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="flex flex-col overflow-y-auto flex-1 min-h-0"
              >
                {status.length === 0 ? (
                  <div className="p-4 text-center text-white/40 text-xs">No changes</div>
                ) : (
                  <div className="flex flex-col py-1">
                    {status.map((item, i) => (
                      <div 
                        key={i} 
                        onClick={() => {
                          const separator = contentPath.endsWith('/') || contentPath.endsWith('\\') ? '' : '/';
                          // Standardize path for tauri/OS depending on how contentPath is formatted, usually simple slash works for URLs
                          onSelectFile(`${contentPath}${separator}${item.file.trim().replace(/"/g, '')}`, undefined, 'diff');
                        }}
                        className="flex items-center gap-3 px-6 py-1 hover:bg-white/5 transition-colors group cursor-pointer"
                      >
                        <span className="text-white/80 text-[13px] truncate flex-1">{item.file.replace(/"/g, '')}</span>
                        <span className={`text-[11px] font-mono font-bold w-4 text-right ${item.status.includes('M') ? 'text-orange-400' : item.status.includes('A') || item.status.includes('?') ? 'text-green-400' : 'text-red-400'}`}>
                          {item.status.trim()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="h-[1px] bg-white/5 my-1 mx-4 shrink-0" />

        {/* Graph Section */}
        <div className="flex flex-col flex-1 overflow-hidden">
          <button 
            onClick={() => setGraphOpen(!graphOpen)}
            className="flex items-center justify-between px-2 py-1 text-white/70 hover:text-white hover:bg-white/5 transition-all text-[11px] font-semibold uppercase tracking-wider w-full text-left shrink-0"
          >
            <div className="flex items-center gap-1">
              <span className="material-symbols-outlined text-[16px]">
                {graphOpen ? "keyboard_arrow_down" : "keyboard_arrow_right"}
              </span>
              Graph
            </div>
            <span className="material-symbols-outlined text-[16px] hover:text-primary transition-colors pr-2" onClick={(e) => { e.stopPropagation(); fetchGitData(); }}>refresh</span>
          </button>
          
          <AnimatePresence>
            {graphOpen && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="flex flex-col overflow-y-auto flex-1 min-h-0"
              >
                {logs.length === 0 ? (
                  <div className="p-4 text-center text-white/40 text-xs">No history</div>
                ) : (
                  <div className="flex flex-col py-1 px-4 gap-0 relative pb-4">
                    {/* Vertical line connecting dots */}
                    <div className="absolute left-[20px] top-2 bottom-4 w-px bg-white/10" />
                    
                    {logs.map((log, i) => (
                      <div key={log.hash} className="flex items-start gap-2 relative z-10 group py-1">
                        <div className="mt-1 shrink-0 bg-background py-1">
                          <div className={`w-[9px] h-[9px] rounded-full border-[1.5px] ${i === 0 ? 'border-primary bg-background shadow-[0_0_8px_rgba(255,255,255,0.2)]' : 'border-white/30 bg-white/30'}`} />
                        </div>
                        <div className="flex flex-col min-w-0 flex-1">
                          <div className="flex items-center gap-1">
                            <span className="text-[12px] text-white/90 font-medium truncate group-hover:text-white transition-colors" title={log.message}>
                              {log.message}
                            </span>
                            {log.refs && (
                              <span className="shrink-0 px-1 py-0.5 rounded bg-white/5 border border-white/10 text-white/60 text-[9px] font-mono whitespace-nowrap leading-none ml-1">
                                {log.refs.split(',')[0].replace('HEAD -> ', '')}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-white/40 mt-0.5">
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
