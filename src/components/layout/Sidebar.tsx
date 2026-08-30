import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";

export interface FileNode {
  name: string;
  path: string;
  is_dir: boolean;
  children: FileNode[] | null;
}

export interface SearchResult {
  file_path: string;
  file_name: string;
  section: string;
  snippet: string;
}

interface SidebarProps {
  contentPath: string;
  onSelectFile: (path: string, section?: string) => void;
  selectedFilePath: string | null;
  onNewFile?: () => void;
}

function FileTreeItem({
  node,
  level = 0,
  onSelectFile,
  selectedFilePath,
}: {
  node: FileNode;
  level?: number;
  onSelectFile: (path: string) => void;
  selectedFilePath: string | null;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const isSelected = selectedFilePath === node.path;

  if (node.is_dir) {
    return (
      <div>
        <button
          className="flex w-full items-center gap-2 rounded-md py-1.5 text-text-muted hover:text-primary transition-colors font-label-md text-[13px]"
          style={{ paddingLeft: `${level * 12 + 12}px` }}
          onClick={() => setIsOpen(!isOpen)}
        >
          <span className="material-symbols-outlined text-[16px]">
            {isOpen ? "folder_open" : "folder"}
          </span>
          <span>{node.name}</span>
        </button>
        {isOpen && node.children && (
          <div className="flex flex-col">
            {node.children.map((child) => (
              <FileTreeItem
                key={child.path}
                node={child}
                level={level + 1}
                onSelectFile={onSelectFile}
                selectedFilePath={selectedFilePath}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <button
      className={`flex w-full items-center gap-2 rounded-md py-1.5 transition-colors font-label-md text-[13px] ${
        isSelected ? "text-primary bg-white/5" : "text-text-muted hover:text-primary"
      }`}
      style={{ paddingLeft: `${level * 12 + 32}px` }}
      onClick={() => onSelectFile(node.path)}
    >
      <span className="material-symbols-outlined text-[16px]">description</span>
      <span className="truncate">{node.name}</span>
    </button>
  );
}

export function Sidebar({ contentPath, onSelectFile, selectedFilePath, onNewFile }: SidebarProps) {
  const [files, setFiles] = useState<FileNode[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    async function loadFiles() {
      if (!contentPath) return;
      setIsLoading(true);
      setError(null);
      try {
        const result = await invoke<FileNode[]>("get_files", { path: contentPath });
        setFiles(result);
      } catch (err: any) {
        setError(err.toString());
      } finally {
        setIsLoading(false);
      }
    }
    loadFiles();
  }, [contentPath]);

  useEffect(() => {
    const handler = setTimeout(async () => {
      if (searchQuery.trim().length > 1) {
        setIsSearching(true);
        try {
          const results = await invoke<SearchResult[]>("search_files", { path: contentPath, query: searchQuery });
          setSearchResults(results);
        } catch (e) {
          console.error(e);
        } finally {
          setIsSearching(false);
        }
      } else {
        setSearchResults([]);
      }
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery, contentPath]);

  return (
    <aside className="hidden md:flex flex-col w-[280px] shrink-0 h-full bg-background border-r border-border-low z-40">
      <div className="h-14 flex items-center px-5 border-b border-white/5 shrink-0">
        <span className="text-[14px] font-bold text-white tracking-wide">Sebqmaat CMS</span>
      </div>

      <div className="flex-1 flex flex-col px-4 pt-4 pb-4 overflow-hidden relative">

        {/* Global Search */}
        <div className="relative mb-4 shrink-0">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-white/40 text-[16px]">search</span>
          <input 
            type="text" 
            placeholder="Search globally..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-4 py-2 text-[13px] text-white focus:outline-none focus:border-white/30 transition-all placeholder:text-white/30"
          />
          {isSearching && (
             <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-white/40 text-[16px] animate-spin">refresh</span>
          )}

          {/* Search Results Dropdown */}
          <AnimatePresence>
            {searchQuery.trim().length > 1 && (
              <motion.div 
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 5 }}
                className="absolute top-[110%] left-0 right-0 bg-[#1C1C1C] border border-white/10 rounded-lg shadow-2xl overflow-hidden z-[100] flex flex-col max-h-[300px]"
              >
                 <div className="p-2 flex flex-col gap-1 overflow-y-auto">
                   {searchResults.length === 0 && !isSearching ? (
                     <div className="text-white/50 text-[12px] p-4 text-center">No results found</div>
                   ) : (
                     searchResults.map((res, i) => (
                       <button 
                         key={i}
                         onClick={() => {
                           onSelectFile(res.file_path, res.section);
                           setSearchQuery("");
                         }}
                         className="flex flex-col text-left px-3 py-2 rounded-md hover:bg-white/5 transition-colors group"
                       >
                         <span className="text-[13px] text-white font-medium flex items-center gap-2">
                           <span className="material-symbols-outlined text-[14px] text-primary">description</span>
                           {res.file_name}
                         </span>
                         <span className="text-[11px] text-white/40 group-hover:text-white/60 transition-colors pl-6 truncate">
                           Section: {res.section}
                         </span>
                       </button>
                     ))
                   )}
                 </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>      <nav className="flex-1 space-y-2 overflow-y-auto">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-md text-primary font-label-md text-label-md mb-2">
            <span className="material-symbols-outlined text-[20px]">folder_open</span>
            Content
          </div>
          
          {/* File Tree */}
          <div className="pl-4 border-l border-white/10 ml-5 mb-4 space-y-1">
            {isLoading ? (
              <span className="text-text-muted text-sm ml-2">Loading...</span>
            ) : error ? (
              <span className="text-error text-sm ml-2">{error}</span>
            ) : files.length > 0 ? (
              <motion.div 
                initial="hidden" 
                animate="show" 
                variants={{
                  hidden: { opacity: 0 },
                  show: {
                    opacity: 1,
                    transition: { staggerChildren: 0.05 }
                  }
                }}
                className="space-y-1"
              >
                {files.map(node => (
                  <motion.div 
                    key={node.path} 
                    variants={{
                      hidden: { opacity: 0, x: -10 },
                      show: { opacity: 1, x: 0 }
                    }}
                  >
                    <FileTreeItem
                      node={node}
                      onSelectFile={onSelectFile}
                      selectedFilePath={selectedFilePath}
                    />
                  </motion.div>
                ))}
              </motion.div>
            ) : (
              <span className="text-text-muted text-sm ml-2">No files loaded.</span>
            )}
          </div>
        </div>

        <a className="flex items-center gap-3 px-3 py-2.5 rounded-md text-text-muted hover:text-primary hover:bg-white/5 transition-all duration-200 font-label-md text-[13px] cursor-pointer mt-4">
          <span className="material-symbols-outlined text-[20px]">settings</span>
          Settings
        </a>
      </nav>

      <div className="mt-auto pt-4 border-t border-border-low shrink-0 flex flex-col gap-4">
        <div className="px-2">
          <Button 
            onClick={onNewFile}
            className="w-full bg-primary text-background h-[36px] rounded-lg font-sans text-[13px] font-medium tracking-wide flex items-center justify-center gap-2 hover:bg-[#E5E5E5] hover:scale-[1.02] transition-transform"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            New File
          </Button>
        </div>

        <div className="flex items-center gap-3 px-2">
          <div className="w-10 h-10 rounded-full border border-white/20 bg-white/10 flex items-center justify-center text-white/50">
            <span className="material-symbols-outlined">person</span>
          </div>
          <div className="flex flex-col">
            <span className="font-label-md text-label-md text-primary">Local User</span>
            <span className="text-[12px] text-text-muted font-label-md">Local Environment</span>
          </div>
        </div>
        </div>
      </div>
    </aside>
  );
}
