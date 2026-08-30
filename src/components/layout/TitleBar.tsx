import { getCurrentWindow } from '@tauri-apps/api/window';

export function TitleBar({ projectName }: { projectName?: string }) {
  const appWindow = getCurrentWindow();

  return (
    <div data-tauri-drag-region className="h-[30px] flex justify-between items-center bg-transparent border-b border-border-low shrink-0 select-none relative z-50">
      {/* Left Spacer */}
      <div data-tauri-drag-region className="flex items-center px-4 w-[138px] pointer-events-none relative z-10">
      </div>
      
      {/* Center Title (Project Name) */}
      <div data-tauri-drag-region className="flex-1 flex justify-center items-center pointer-events-none relative z-10">
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
