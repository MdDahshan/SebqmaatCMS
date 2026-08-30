import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { load } from "@tauri-apps/plugin-store";
import "./App.css";
import { Sidebar } from "./components/layout/Sidebar";
import { TitleBar } from "./components/layout/TitleBar";
import { DynamicForm } from "./components/editor/DynamicForm";
import { GitDiffEditor } from "./components/editor/GitDiffEditor";
import { parseFileContent, stringifyFileContent } from "./utils/parser";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export const isSingleField = (val: any) => {
  if (val === null || typeof val !== 'object') return true;
  if (Array.isArray(val)) return false;
  return Object.keys(val).length === 1;
};

function App() {
  const [contentPath, setContentPath] = useState<string>("");
  const [activePath, setActivePath] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("");
  const [activeItemIndex, setActiveItemIndex] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<'editor' | 'diff'>('editor');
  const [fileData, setFileData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recentProjects, setRecentProjects] = useState<string[]>([]);

  useEffect(() => {
    async function loadRecent() {
      try {
        const store = await load('settings.json', { autoSave: false });
        const recents = await store.get<string[]>('recent_projects') || [];
        setRecentProjects(recents);
      } catch (e) {
        console.error("Failed to load store", e);
      }
    }
    loadRecent();
  }, []);

  const handleSelectFile = async (path: string, section?: string, mode?: 'editor' | 'diff') => {
    try {
      setIsLoading(true);
      setError(null);
      const content = await invoke<string>("read_file", { path });
      const parsed = parseFileContent(content, path);
      setFileData(parsed);
      setActivePath(path);
      
      // Auto-select first tab or deep link to section
      const keys = Object.keys(parsed);
      const complexKeys = keys.filter(k => !isSingleField(parsed[k]));
      
      if (section && keys.includes(section)) {
        setActiveTab(section);
      } else if (complexKeys.length > 0) {
        setActiveTab(complexKeys[0]);
      } else if (keys.length > 0) {
        setActiveTab('__general__');
      } else {
        setActiveTab('');
      }

      if (mode) {
        setViewMode(mode);
      } else if (viewMode === 'diff') {
        // Reset to editor when clicking a normal file unless mode is explicitly passed
        setViewMode('editor');
      }

    } catch (err: any) {
      setError(err.toString());
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async (dataToSave: any) => {
    if (!activePath || !dataToSave) return;
    try {
      const newRawContent = stringifyFileContent(dataToSave, activePath);
      await invoke("write_file", { path: activePath, content: newRawContent });
      setFileData(dataToSave);
      alert("File saved successfully!");
    } catch (err: any) {
      alert("Failed to save: " + err.toString());
    }
  };

  const handlePickFolder = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
      });
      if (selected && typeof selected === "string") {
        setContentPath(selected);
        
        const store = await load('settings.json', { autoSave: false });
        const current = await store.get<string[]>('recent_projects') || [];
        const updated = [selected, ...current.filter(p => p !== selected)].slice(0, 5);
        await store.set('recent_projects', updated);
        await store.save();
        setRecentProjects(updated);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleOpenRecent = async (path: string) => {
    setContentPath(path);
    try {
      const store = await load('settings.json', { autoSave: false });
      const current = await store.get<string[]>('recent_projects') || [];
      const updated = [path, ...current.filter(p => p !== path)].slice(0, 5);
      await store.set('recent_projects', updated);
      await store.save();
      setRecentProjects(updated);
    } catch (err) {
      console.error(err);
    }
  };

  const handleRemoveRecent = async (path: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const store = await load('settings.json', { autoSave: false });
      const current = await store.get<string[]>('recent_projects') || [];
      const updated = current.filter(p => p !== path);
      await store.set('recent_projects', updated);
      await store.save();
      setRecentProjects(updated);
    } catch (err) {
      console.error(err);
    }
  };

  const handleNewFile = () => {
    if (!contentPath) {
      alert("Please select a content folder first.");
      return;
    }
    alert("New file created! (Placeholder - Implement backend later)");
  };

  const projectName = contentPath ? contentPath.split(/[/\\]/).filter(Boolean).slice(-2, -1)[0] : "Sebqmaat CMS";

  return (
    <div className="h-screen w-screen flex flex-col bg-background overflow-hidden">
      <TitleBar projectName={projectName || "Sebqmaat CMS"} />
      <div className="flex flex-1 overflow-hidden relative">
        <Sidebar 
          contentPath={contentPath} 
          onSelectFile={handleSelectFile} 
          selectedFilePath={activePath} 
          onNewFile={handleNewFile}
        />

        {/* Sub Sidebar for Tabs */}
        {activePath && fileData && typeof fileData === 'object' && !Array.isArray(fileData) && (() => {
          const keys = Object.keys(fileData);
          const groupedKeys = keys.filter(k => isSingleField(fileData[k]));
          const complexKeys = keys.filter(k => !isSingleField(fileData[k]));

          return (
            <div className="w-64 bg-background border-r border-white/5 flex flex-col shrink-0 z-20">
              <div className="h-14 flex items-center px-5 border-b border-white/5 shrink-0">
                <span className="text-[12px] font-semibold text-text-muted uppercase tracking-wider">Sections</span>
              </div>
              <div className="flex-1 overflow-y-auto py-4 flex flex-col gap-1 px-3">
                {groupedKeys.length > 0 && (
                  <Accordion 
                    value={activeTab === '__general__' ? ['general'] : []}
                    onValueChange={(val: any) => {
                      if (val.includes('general')) setActiveTab('__general__');
                      else setActiveTab('');
                    }}
                  >
                    <AccordionItem value="general" className="border-none">
                      <AccordionTrigger 
                        className={`px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all hover:no-underline ${
                          activeTab === '__general__'
                            ? "bg-white/10 text-white"
                            : "text-text-muted hover:text-white hover:bg-white/5"
                        }`}
                      >
                        General
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="pl-4 border-l border-white/10 ml-5 mt-1 space-y-1 mb-2">
                          {groupedKeys.map((key) => (
                            <div key={key} className="text-[12px] text-text-muted py-1 flex items-center gap-2">
                              <span className="w-1 h-1 rounded-full bg-white/30"></span>
                              {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            </div>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                )}
                {complexKeys.map((key) => {
                  const val = fileData[key];
                  const isArray = Array.isArray(val);
                  const itemCount = isArray ? val.length : 0;
                  const showDropdown = isArray && itemCount > 3;

                  if (showDropdown) {
                    return (
                      <Accordion
                        key={key}
                        value={activeTab === key ? [key] : []}
                        onValueChange={(v) => {
                          // Always navigate to the tab when toggling
                          setActiveTab(key);
                          setActiveItemIndex(null);
                        }}
                      >
                        <AccordionItem value={key} className="border-none">
                          <AccordionTrigger
                            className={`px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all hover:no-underline ${
                              activeTab === key
                                ? "bg-white/10 text-white"
                                : "text-text-muted hover:text-white hover:bg-white/5"
                            }`}
                          >
                            <span className="flex items-center gap-2 w-full">
                              {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                              <span className="ml-auto text-[10px] text-white/40 font-normal pr-1">{itemCount}</span>
                            </span>
                          </AccordionTrigger>
                          <AccordionContent>
                            <div className="pl-4 border-l border-white/10 ml-5 mt-1 space-y-0.5 mb-2">
                              {val.map((item: any, idx: number) => {
                                const label = (() => {
                                  if (!item || typeof item !== 'object') {
                                    return String(item ?? `Item ${idx + 1}`);
                                  }
                                  // Try common name fields first
                                  const named = item.title || item.name || item.label || item.platform || item.heading || item.text || item.key || null;
                                  if (named) return named;
                                  // Fall back to the actual value of the first field
                                  const firstVal = Object.values(item)[0];
                                  if (firstVal !== null && firstVal !== undefined && firstVal !== '') {
                                    return String(firstVal);
                                  }
                                  return `Item ${idx + 1}`;
                                })();
                                return (
                                  <button
                                    key={idx}
                                    type="button"
                                    onClick={() => {
                                      setActiveTab(key);
                                      setActiveItemIndex(idx);
                                      setTimeout(() => {
                                        const el = document.getElementById(`array-item-${key}-${idx}`);
                                        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                      }, 80);
                                    }}
                                    className={`w-full text-left px-2 py-1.5 rounded-md text-[12px] transition-all flex items-center gap-2 ${
                                      activeTab === key && activeItemIndex === idx
                                        ? 'text-white bg-white/8'
                                        : 'text-text-muted hover:text-white hover:bg-white/5'
                                    }`}
                                  >
                                    <span className="w-4 h-4 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-[9px] shrink-0">{idx + 1}</span>
                                    <span className="truncate">{label}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>
                    );
                  }

                  return (
                    <button
                      key={key}
                      onClick={() => { setActiveTab(key); setActiveItemIndex(null); }}
                      className={`text-left px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all ${
                        activeTab === key
                          ? "bg-white/10 text-white"
                          : "text-text-muted hover:text-white hover:bg-white/5"
                      }`}
                    >
                      {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })()}

        <main className="flex-1 flex flex-col min-w-0 relative overflow-hidden bg-background">
          {/* Fixed Background Layer */}
          <div 
            className="absolute inset-0 bg-cover bg-center bg-no-repeat z-0"
            style={{ backgroundImage: 'url("/bg.png")' }}
          >
            <div className="absolute inset-0 bg-background/80 backdrop-blur-[2px]" />
          </div>

          {/* Scrollable Content Layer */}
          <div className="flex-1 flex flex-col overflow-y-auto relative z-10 w-full h-full">
            <div className="flex-1 p-margin-mobile md:p-margin-desktop max-w-[1200px] w-full mx-auto relative flex flex-col">
          {!contentPath ? (
            <div className="flex h-full flex-col items-center justify-center p-8">
              <div className="max-w-md w-full flex flex-col gap-8 items-center justify-center mt-[-10vh]">
                {/* Top: Welcome & New */}
                <div className="flex flex-col items-center gap-6 w-full">
                  <div className="flex flex-col items-center gap-2">
                    <h2 className="text-2xl font-bold tracking-tight text-white">Sebqmaat CMS</h2>
                  </div>
                  
                  <div className="flex flex-col gap-3 w-full">
                    <button
                      onClick={handlePickFolder}
                      className="w-full py-2.5 rounded-lg bg-primary text-background font-label-md text-label-md font-bold hover:bg-[#E5E5E5] transition-all flex items-center justify-center gap-2"
                    >
                      <span className="material-symbols-outlined text-[18px]">folder_open</span>
                      Open Folder
                    </button>
                  </div>
                </div>

                {/* Bottom: Recent Projects */}
                {recentProjects.length > 0 && (
                  <div className="flex flex-col w-full">
                    <h3 className="text-xs font-semibold text-text-muted mb-3 px-1">Workspaces</h3>
                    <div className="flex flex-col gap-2">
                      {recentProjects.map((path) => (
                        <div 
                          key={path}
                          onClick={() => handleOpenRecent(path)}
                          className="group flex items-center justify-between p-3.5 rounded-lg border border-white/5 hover:border-white/20 bg-white/[0.02] hover:bg-white/[0.04] cursor-pointer transition-all"
                        >
                          <div className="flex flex-col overflow-hidden">
                            <span className="text-sm font-medium text-white truncate">{path.split(/[/\\]/).pop()}</span>
                            <span className="text-[11px] text-text-muted truncate mt-0.5 opacity-60">{path}</span>
                          </div>
                          <button 
                            onClick={(e) => handleRemoveRecent(path, e)}
                            className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-white/10 rounded-md text-white/50 hover:text-white transition-all shrink-0 ml-2"
                            title="Remove from recents"
                          >
                            <span className="material-symbols-outlined text-[14px]">close</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : activePath ? (
            <>
              {/* Header & Breadcrumbs */}
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
                <div>
                  <nav className="flex items-center gap-2 font-code-sm text-code-sm text-text-muted mb-4">
                    <span className="hover:text-primary transition-colors">{contentPath.split(/[/\\]/).pop()}</span>
                    <span className="material-symbols-outlined text-[14px]">chevron_right</span>
                    <span className="text-primary">{activePath.split(/[/\\]/).pop()}</span>
                  </nav>
                  <h2 className="font-headline-lg text-headline-lg-mobile md:text-headline-lg text-primary tracking-tight">
                    File Editor
                  </h2>
                </div>
                
                {/* View Mode Toggle */}
                <div className="flex bg-[#121212] rounded-lg p-1 border border-white/5 shadow-inner">
                  <button 
                    onClick={() => setViewMode('editor')}
                    className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${viewMode === 'editor' ? 'bg-white/10 text-white shadow-sm' : 'text-white/40 hover:text-white/80'}`}
                  >
                    Editor
                  </button>
                  <button 
                    onClick={() => setViewMode('diff')}
                    className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${viewMode === 'diff' ? 'bg-white/10 text-white shadow-sm' : 'text-white/40 hover:text-white/80'}`}
                  >
                    Diff
                  </button>
                </div>
              </div>

              {isLoading ? (
                <p className="text-text-muted">Loading file...</p>
              ) : error ? (
                <p className="text-error">Error: {error}</p>
              ) : fileData ? (
                viewMode === 'editor' ? (
                  <DynamicForm 
                    key={activePath} 
                    initialData={fileData}
                    activeTab={activeTab}
                    onSave={handleSave}
                    onDiscard={() => setFileData({ ...fileData })}
                  />
                ) : (
                  <GitDiffEditor 
                    activePath={activePath}
                    contentPath={contentPath}
                    fileData={fileData}
                    onRevert={(newData) => {
                      setFileData(newData);
                      // Auto save when reverting
                      try {
                        const content = stringifyFileContent(newData, activePath);
                        invoke("write_file", { path: activePath, content }).then(() => {
                          console.log("Reverted and saved successfully");
                        });
                      } catch (e) {
                        console.error("Failed to auto-save after revert", e);
                      }
                    }}
                  />
                )
              ) : (
                <p className="text-text-muted">No data found.</p>
              )}
            </>
          ) : (
            <div className="flex h-full items-center justify-center">
              <p className="text-text-muted">Select a file from the sidebar to begin editing.</p>
            </div>
          )}
        </div>
        </div>
      </main>
      </div>
    </div>
  );
}

export default App;
