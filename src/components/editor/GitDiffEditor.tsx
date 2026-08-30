import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Button } from "@/components/ui/button";
import { parseFileContent } from "@/utils/parser";

interface GitDiffEditorProps {
  activePath: string;
  contentPath: string;
  fileData: any;
  onRevert: (newData: any) => void;
}

interface DiffChange {
  path: string[];
  oldValue: any;
  newValue: any;
}

// Deep comparison utility
function getDiff(oldObj: any, newObj: any, path: string[] = []): DiffChange[] {
  let diffs: DiffChange[] = [];
  
  if (oldObj === newObj) return diffs;

  if (typeof oldObj !== typeof newObj || Array.isArray(oldObj) !== Array.isArray(newObj)) {
    return [{ path, oldValue: oldObj, newValue: newObj }];
  }

  if (typeof oldObj === 'object' && oldObj !== null && newObj !== null) {
    const keys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)]);
    for (const key of keys) {
      diffs = diffs.concat(getDiff(oldObj[key as keyof typeof oldObj], newObj[key as keyof typeof newObj], [...path, key]));
    }
  } else {
    if (oldObj !== newObj) {
      return [{ path, oldValue: oldObj, newValue: newObj }];
    }
  }

  return diffs;
}

function applyRevert(obj: any, path: string[], oldValue: any): any {
  if (path.length === 0) return oldValue;
  
  const [head, ...tail] = path;
  
  if (Array.isArray(obj)) {
    const newArr = [...obj];
    if (oldValue === undefined && tail.length === 0) {
       newArr.splice(Number(head), 1);
    } else {
       newArr[Number(head)] = applyRevert(newArr[Number(head)], tail, oldValue);
    }
    return newArr;
  } else {
    const newObj = { ...obj };
    if (oldValue === undefined && tail.length === 0) {
       delete newObj[head];
    } else {
       newObj[head] = applyRevert(newObj[head], tail, oldValue);
    }
    return newObj;
  }
}

export function GitDiffEditor({ activePath, contentPath, fileData, onRevert }: GitDiffEditorProps) {
  const [oldData, setOldData] = useState<any>(null);
  const [rawGitDiff, setRawGitDiff] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadOldData() {
      setIsLoading(true);
      setError(null);
      try {
        let relativePath = activePath.replace(contentPath, '');
        if (relativePath.startsWith('/') || relativePath.startsWith('\\')) {
          relativePath = relativePath.substring(1);
        }
        
        const oldContent = await invoke<string>("git_show_file", { path: contentPath, file: relativePath });
        setOldData(parseFileContent(oldContent, activePath));
        
        try {
          const rawDiff = await invoke<string>("git_diff_file", { path: contentPath, file: relativePath });
          setRawGitDiff(rawDiff);
        } catch (e) {
          console.error("Failed to load raw diff", e);
        }
      } catch (e: any) {
        // If file is new/untracked, git show might fail
        setError(e.toString());
        setOldData(null);
        setRawGitDiff(null);
      } finally {
        setIsLoading(false);
      }
    }
    if (activePath && contentPath) {
      loadOldData();
    }
  }, [activePath, contentPath, fileData]);

  if (isLoading) return <div className="p-4 text-white/50">Loading diff...</div>;
  if (error) return <div className="p-4 text-orange-400">Cannot load git history (file might be new or untracked).</div>;

  const diffs = getDiff(oldData, fileData);

  if (diffs.length === 0) {
    return (
      <div className="w-full pb-12">
        <div className="flex flex-col border border-white/10 rounded-xl bg-[#121212] shadow-lg overflow-hidden">
          <details className="group">
            <summary className="flex items-center gap-2 px-4 py-3 cursor-pointer list-none hover:bg-white/[0.02] transition-colors outline-none">
              <span className="material-symbols-outlined text-[14px] text-text-muted group-open:rotate-90 transition-transform duration-200">chevron_right</span>
              <span className="text-[13px] font-medium text-white/80">External or Formatting Changes</span>
            </summary>
            <div className="px-10 py-4 bg-[#161616] border-t border-white/5 text-[13px] text-white/60 leading-relaxed flex flex-col items-start gap-4">
              <p>This file was modified outside of the CMS (or its text formatting has changed). The actual data content remains identical.</p>
              {rawGitDiff && (
                <div className="w-full mt-2 rounded-md bg-[#1e1e1e] border border-white/5 overflow-hidden">
                  <div className="bg-black/40 px-4 py-2 border-b border-white/5 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[14px] text-white/40">code</span>
                    <span className="text-[11px] font-medium text-white/60 uppercase tracking-wider">Raw Git Diff</span>
                  </div>
                  <pre className="p-4 text-[12px] font-mono leading-relaxed overflow-x-auto text-white/70 whitespace-pre-wrap break-all">
                    {rawGitDiff.split('\n').map((line, i) => (
                      <div 
                        key={i} 
                        className={`
                          ${line.startsWith('+') ? 'text-green-400 bg-green-500/5' : ''}
                          ${line.startsWith('-') ? 'text-red-400 bg-red-500/5' : ''}
                          ${line.startsWith('@') ? 'text-blue-400 opacity-70' : ''}
                        `}
                      >
                        {line}
                      </div>
                    ))}
                  </pre>
                </div>
              )}
            </div>
          </details>
        </div>
      </div>
    );
  }

  const handleRevert = (diff: DiffChange) => {
    const newData = applyRevert(fileData, diff.path, diff.oldValue);
    onRevert(newData);
  };

  return (
    <div className="w-full pb-12">
      <div className="flex flex-col border border-white/10 rounded-xl bg-[#121212] shadow-lg overflow-hidden">
        {diffs.map((diff, i) => (
          <div key={i} className="flex flex-col border-b border-white/5 last:border-b-0 py-3 group">
            {/* Header */}
            <div className="flex justify-between items-center mb-1.5 px-4">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[14px] text-text-muted">difference</span>
                <span className="text-[12px] font-medium text-white/80 font-code-sm">
                  {diff.path.join(" → ")}
                </span>
              </div>
              <Button 
                onClick={() => handleRevert(diff)}
                className="h-7 text-[11px] px-3.5 bg-white/5 hover:bg-error/10 hover:text-error hover:border-error/20 text-white/90 border border-white/10 transition-all font-medium rounded-md opacity-0 group-hover:opacity-100 flex items-center"
              >
                <span className="material-symbols-outlined text-[13px] mr-1.5">undo</span>
                Revert
              </Button>
            </div>
            
            {/* Content */}
            <div className="flex flex-col gap-0 font-code-sm text-[12.5px] px-2">
              {/* Old Value */}
              {diff.oldValue !== undefined && (
                <div className="flex items-start gap-4 py-1.5 px-2 bg-transparent hover:bg-error/[0.06] rounded-md transition-colors">
                  <div className="w-6 shrink-0 text-right text-error/50 select-none">-</div>
                  <div className="flex-1 text-error/80 whitespace-pre-wrap break-words line-through decoration-error/30">
                    {typeof diff.oldValue === 'object' ? JSON.stringify(diff.oldValue, null, 2) : String(diff.oldValue)}
                  </div>
                </div>
              )}
              
              {/* New Value */}
              {diff.newValue !== undefined && (
                <div className="flex items-start gap-4 py-1.5 px-2 bg-white/[0.02] hover:bg-[#34d399]/[0.06] rounded-md transition-colors">
                  <div className="w-6 shrink-0 text-right text-[#34d399]/50 select-none">+</div>
                  <div className="flex-1 text-[#34d399]/90 whitespace-pre-wrap break-words">
                    {typeof diff.newValue === 'object' ? JSON.stringify(diff.newValue, null, 2) : String(diff.newValue)}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
