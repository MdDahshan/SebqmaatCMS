import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import "./App.css";
import { Sidebar } from "./components/layout/Sidebar";
import { TitleBar } from "./components/layout/TitleBar";
import { DynamicForm } from "./components/editor/DynamicForm";
import { parseFileContent, stringifyFileContent } from "./utils/parser";

export const isSingleField = (val: any) => {
  if (val === null || typeof val !== 'object') return true;
  if (Array.isArray(val)) return false;
  return Object.keys(val).length === 1;
};

function App() {
  const [contentPath, setContentPath] = useState<string>("");
  const [activePath, setActivePath] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("");
  const [fileData, setFileData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadFile() {
      if (!activePath) {
        setFileData(null);
        return;
      }
      setIsLoading(true);
      setError(null);
      try {
        const rawContent = await invoke<string>("read_file", { path: activePath });
        const parsed = parseFileContent(rawContent, activePath);
        setFileData(parsed);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          const keys = Object.keys(parsed);
          const hasGrouped = keys.some(k => isSingleField(parsed[k]));
          if (hasGrouped) {
            setActiveTab("__general__");
          } else {
            setActiveTab(keys[0] || "");
          }
        } else {
          setActiveTab("");
        }
      } catch (err: any) {
        setError(err.toString());
      } finally {
        setIsLoading(false);
      }
    }
    loadFile();
  }, [activePath]);

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
      }
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
    <div className="h-screen w-screen flex flex-col bg-background overflow-hidden border border-white/10">
      <TitleBar projectName={projectName || "Sebqmaat CMS"} />
      <div className="flex flex-1 overflow-hidden relative">
        <Sidebar 
          contentPath={contentPath} 
          onSelectFile={setActivePath} 
          selectedFilePath={activePath} 
          onNewFile={handleNewFile}
        />

        {/* Sub Sidebar for Tabs */}
        {activePath && fileData && typeof fileData === 'object' && !Array.isArray(fileData) && (() => {
          const keys = Object.keys(fileData);
          const groupedKeys = keys.filter(k => isSingleField(fileData[k]));
          const complexKeys = keys.filter(k => !isSingleField(fileData[k]));

          return (
            <div className="w-64 bg-[#121212]/95 border-r border-white/5 flex flex-col shrink-0 z-20">
              <div className="h-14 flex items-center px-5 border-b border-white/5 shrink-0">
                <span className="text-[12px] font-semibold text-text-muted uppercase tracking-wider">Sections</span>
              </div>
              <div className="flex-1 overflow-y-auto py-4 flex flex-col gap-1 px-3">
                {groupedKeys.length > 0 && (
                  <div className="flex flex-col">
                    <button
                      onClick={() => setActiveTab('__general__')}
                      className={`text-left px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all ${
                        activeTab === '__general__'
                          ? "bg-white/10 text-white"
                          : "text-text-muted hover:text-white hover:bg-white/5"
                      }`}
                    >
                      General
                    </button>
                    {activeTab === '__general__' && (
                      <div className="pl-4 border-l border-white/10 ml-5 mt-1 space-y-1 mb-2">
                        {groupedKeys.map((key) => (
                          <div key={key} className="text-[12px] text-text-muted py-1 flex items-center gap-2">
                            <span className="w-1 h-1 rounded-full bg-white/30"></span>
                            {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {complexKeys.map((key) => (
                  <button
                    key={key}
                    onClick={() => setActiveTab(key)}
                    className={`text-left px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all ${
                      activeTab === key
                        ? "bg-white/10 text-white"
                        : "text-text-muted hover:text-white hover:bg-white/5"
                    }`}
                  >
                    {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </button>
                ))}
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
            <div className="flex h-full flex-col items-center justify-center space-y-4">
              <h2 className="text-xl font-medium">Welcome to Sebqmaat CMS</h2>
              <p className="text-text-muted text-center max-w-md">
                Select your project's content directory to start editing.
              </p>
              <button
                onClick={handlePickFolder}
                className="px-6 py-3 rounded-xl bg-primary text-background font-label-md text-label-md font-bold hover:bg-[#E5E5E5] transition-all flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-[18px]">folder_open</span>
                Select Content Folder
              </button>
            </div>
          ) : activePath ? (
            <>
              {/* Header & Breadcrumbs */}
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
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
              </div>

              {isLoading ? (
                <p className="text-text-muted">Loading file...</p>
              ) : error ? (
                <p className="text-error">Error: {error}</p>
              ) : fileData ? (
                <DynamicForm 
                  key={activePath} 
                  initialData={fileData}
                  activeTab={activeTab}
                  onSave={handleSave}
                  onDiscard={() => setFileData({ ...fileData })}
                />
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
