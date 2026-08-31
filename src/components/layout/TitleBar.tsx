import { getCurrentWindow } from '@tauri-apps/api/window';
import { useState, useRef, useEffect } from 'react';

function MenuDropdown({ label, items }: { label: string, items: { label: string, onClick: () => void, shortcut?: string, divider?: boolean }[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative h-full flex items-center" ref={ref}>
      <button 
        data-tauri-drag-region="false"
        className={`h-full px-2.5 text-[11.5px] hover:bg-white/10 transition-colors flex items-center rounded-sm mx-0.5 ${isOpen ? 'bg-white/10 text-white' : 'text-text-muted'}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        {label}
      </button>
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-48 bg-[#1c1c1f] border border-white/10 shadow-2xl p-1 z-[100] rounded-md overflow-hidden">
          {items.map((item, idx) => item.divider ? (
            <div key={idx} className="h-[1px] bg-white/10 my-1 mx-2" />
          ) : (
            <button
              key={idx}
              className="w-full text-left px-3 py-1 text-[11.5px] text-text-primary hover:bg-white/10 rounded-sm flex justify-between items-center transition-colors"
              onClick={() => {
                item.onClick();
                setIsOpen(false);
              }}
            >
              <span>{item.label}</span>
              {item.shortcut && <span className="opacity-50 text-[10px] tracking-wider">{item.shortcut}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function TitleBar({ 
  projectName,
  onOpenFolder,
  onCloseFolder
}: { 
  projectName?: string;
  onOpenFolder?: () => void;
  onCloseFolder?: () => void;
}) {
  const appWindow = getCurrentWindow();

  return (
    <div data-tauri-drag-region className="h-[30px] flex justify-between items-center bg-transparent border-b border-border-low shrink-0 select-none relative z-50">
      {/* Left Menu */}
      <div className="flex items-center h-full relative z-10 pl-2">
        <MenuDropdown 
          label="File" 
          items={[
            { label: 'Open Folder...', onClick: () => onOpenFolder?.(), shortcut: 'Ctrl+O' },
            { label: 'Close Folder', onClick: () => onCloseFolder?.() },
            { divider: true, label: '', onClick: () => {} },
            { label: 'Exit', onClick: () => appWindow.close(), shortcut: 'Alt+F4' },
          ]} 
        />
        <MenuDropdown 
          label="Help" 
          items={[
            { label: 'About SebqmaatCMS', onClick: () => alert('SebqmaatCMS v0.1.0\nCreated by Dash') },
          ]} 
        />
      </div>
      
      {/* Center Title (Project Name) */}
      <div data-tauri-drag-region className="flex-1 flex justify-center items-center pointer-events-none relative z-10 absolute inset-0">
        {projectName && (
          <span data-tauri-drag-region className="text-[12px] text-text-muted font-medium tracking-wide opacity-80">{projectName}</span>
        )}
      </div>

      {/* Right Controls */}
      <div className="flex items-center h-full relative z-10">
        <button
          data-tauri-drag-region="false"
          className="w-[46px] h-full flex items-center justify-center text-text-muted hover:bg-white/10 hover:text-white transition-colors"
          onClick={() => appWindow.minimize()}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M0 5H10" stroke="currentColor" strokeWidth="1"/></svg>
        </button>
        <button
          data-tauri-drag-region="false"
          className="w-[46px] h-full flex items-center justify-center text-text-muted hover:bg-white/10 hover:text-white transition-colors"
          onClick={() => appWindow.toggleMaximize()}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2.5 0.5H9.5V7.5M0.5 2.5H7.5V9.5H0.5V2.5Z" stroke="currentColor" strokeWidth="1"/></svg>
        </button>
        <button
          data-tauri-drag-region="false"
          className="w-[46px] h-full flex items-center justify-center text-text-muted hover:bg-error hover:text-white transition-colors"
          onClick={() => appWindow.close()}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M0.5 0.5L9.5 9.5M0.5 9.5L9.5 0.5" stroke="currentColor" strokeWidth="1"/></svg>
        </button>
      </div>
    </div>
  );
}
