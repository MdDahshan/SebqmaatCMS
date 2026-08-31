import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { convertFileSrc } from '@tauri-apps/api/core';
import { createPortal } from 'react-dom';

interface MediaPreviewProps {
  src: string;
  contentPath: string;
  activePath?: string | null;
  explicitMediaField?: boolean;
}

export function MediaPreview({ src, contentPath, activePath, explicitMediaField = false }: MediaPreviewProps) {
  const [assetUrl, setAssetUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error' | 'not-media'>('idle');
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    const cleanSrc = src ? src.trim().replace(/^["'`]+|["'`]+$/g, '') : '';
    if (!cleanSrc) {
      setStatus('idle');
      return;
    }
    
    let isMounted = true;
    setStatus('loading');
    setAssetUrl(null);

    const checkAndLoad = async () => {
      // Small debounce to prevent thrashing
      await new Promise(r => setTimeout(r, 300));
      if (!isMounted) return;

      const isRemote = cleanSrc.startsWith('http://') || cleanSrc.startsWith('https://');
      const isData = cleanSrc.startsWith('data:');

      if (isData) {
         setAssetUrl(cleanSrc);
         return;
      }

      if (isRemote) {
         // Probe remote URL to ensure it's not a standard HTML page if it lacks an extension
         try {
           const res = await fetch(cleanSrc, { method: 'HEAD' }).catch(() => null);
           if (res) {
             const cType = res.headers.get('content-type') || '';
             if (cType && !cType.startsWith('image/') && !cType.startsWith('video/')) {
                if (isMounted) setStatus('not-media');
                return;
             }
           }
         } catch (e) {
           // CORS error or network error, let the img/video tag try anyway
         }
         
         if (isMounted) setAssetUrl(cleanSrc);
         return;
      }

      // Local path resolution
      if (contentPath) {
        try {
          const absPath = await invoke<string>('resolve_media_path', {
            basePath: contentPath,
            parentPath: activePath || contentPath,
            mediaPath: cleanSrc
          });
          if (isMounted) setAssetUrl(convertFileSrc(absPath));
        } catch (e) {
          if (isMounted) setStatus(explicitMediaField ? 'error' : 'not-media');
        }
      } else {
        if (isMounted) setStatus('not-media');
      }
    };

    checkAndLoad();

    return () => {
      isMounted = false;
    };
  }, [src, contentPath, activePath, explicitMediaField]);

  if (!src || status === 'not-media' || status === 'idle') return null;

  if (status === 'error') {
    return (
      <div className="mt-2 text-white/30 text-[11px] flex flex-col gap-1 p-2 bg-black/40 rounded">
        <div className="flex items-center gap-1">
          <span className="material-symbols-outlined text-[14px] text-red-400">broken_image</span>
          <span className="text-red-400">Preview not available</span>
        </div>
        <div className="text-[9px] font-mono break-all opacity-50 mt-1">
          src: {src}<br/>
          assetUrl: {assetUrl || 'null'}<br/>
          explicitMediaField: {explicitMediaField ? 'true' : 'false'}
        </div>
      </div>
    );
  }

  if (!assetUrl) {
    if (!explicitMediaField) return null; // Hide loading spinner for arbitrary strings
    return (
      <div className="mt-2 text-white/30 text-[11px] flex items-center gap-1 animate-pulse">
        <span className="material-symbols-outlined text-[14px] animate-spin">progress_activity</span>
        Loading preview...
      </div>
    );
  }

  const lowerSrc = src.toLowerCase();
  const urlWithoutQuery = lowerSrc.split('?')[0].split('#')[0];
  const isVideo = urlWithoutQuery.endsWith('.mp4') || urlWithoutQuery.endsWith('.webm') || urlWithoutQuery.endsWith('.ogg');

  return (
    <div className="mt-2 rounded-md overflow-hidden border border-white/10 bg-black/20 w-fit max-w-full relative group">
      {isVideo ? (
        <video 
          src={assetUrl} 
          controls 
          className="h-32 md:h-48 w-auto object-cover max-w-full"
          preload="metadata"
          onError={() => setStatus(explicitMediaField ? 'error' : 'not-media')}
          onLoadedData={() => setStatus('success')}
        />
      ) : (
        <>
          <img 
            src={assetUrl} 
            alt="Preview" 
            loading="lazy"
            className="h-32 md:h-48 w-auto object-cover max-w-full cursor-zoom-in transition-transform hover:scale-[1.02]"
            onClick={() => setIsExpanded(true)}
            onError={() => setStatus(explicitMediaField ? 'error' : 'not-media')}
            onLoad={() => setStatus('success')}
          />
          {isExpanded && createPortal(
            <div 
              className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 md:p-12 cursor-zoom-out"
              onClick={() => setIsExpanded(false)}
            >
              <img 
                src={assetUrl} 
                alt="Expanded preview" 
                className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
              />
            </div>,
            document.body
          )}
        </>
      )}
      {status === 'success' && (
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
          <span className="text-white text-[10px] bg-black/80 px-2 py-1 rounded backdrop-blur-md max-w-[90%] truncate">
            {src.split('/').pop()}
          </span>
        </div>
      )}
    </div>
  );
}
