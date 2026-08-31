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

function getYoutubeEmbedUrl(url: string): string | null {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? `https://www.youtube.com/embed/${match[2]}` : null;
}

export function MediaPreview({ src, contentPath, activePath, explicitMediaField = false }: MediaPreviewProps) {
  const [assetUrl, setAssetUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error' | 'not-media'>('idle');
  const [isExpanded, setIsExpanded] = useState(false);

  const lowerSrc = src ? src.toLowerCase() : '';
  const urlWithoutQuery = lowerSrc.split('?')[0].split('#')[0];
  const isDefinitelyVideo = urlWithoutQuery.endsWith('.mp4') || urlWithoutQuery.endsWith('.webm') || urlWithoutQuery.endsWith('.ogg') || urlWithoutQuery.endsWith('.mov') || urlWithoutQuery.endsWith('.mkv');
  const isDefinitelyImage = urlWithoutQuery.match(/\.(jpg|jpeg|png|gif|svg|webp)$/i);
  const treatAsMedia = explicitMediaField || isDefinitelyVideo || isDefinitelyImage;

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
         const ytEmbed = getYoutubeEmbedUrl(cleanSrc);
         if (ytEmbed) {
           if (isMounted) {
             setAssetUrl(ytEmbed);
             setStatus('success');
           }
           return;
         }

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
          if (isMounted) {
            let finalUrl = convertFileSrc(absPath);
            
            if (isDefinitelyVideo) {
               try {
                 const serverInfo: {port: number, token: string} = await invoke('get_media_server_info');
                 const cleanAbsPath = absPath.replace(/\\/g, '/');
                 let pathParts = cleanAbsPath.split('/').map(encodeURIComponent).join('/');
                 
                 // Strip drive letter on Windows since warp is mounted at C:\
                 if (cleanAbsPath.match(/^[a-zA-Z]:\//)) {
                    pathParts = cleanAbsPath.substring(2).split('/').map(encodeURIComponent).join('/');
                 }

                 const url = new URL(`http://127.0.0.1:${serverInfo.port}`);
                 url.pathname = pathParts;
                 url.searchParams.set('token', serverInfo.token);
                 finalUrl = url.toString();
               } catch (e) {
                 console.warn('Failed to get media server info, falling back to assetProtocol', e);
               }
            }

            setAssetUrl(finalUrl);
          }
        } catch (e) {
          if (isMounted) setStatus(treatAsMedia ? 'error' : 'not-media');
        }
      } else {
        if (isMounted) setStatus(treatAsMedia ? 'error' : 'not-media');
      }
    };

    checkAndLoad();

    return () => {
      isMounted = false;
    };
  }, [src, contentPath, activePath, explicitMediaField]);

  if (!src || status === 'not-media' || status === 'idle') return null;

  if (status === 'error') {
    const isRustFailure = !assetUrl;
    const isCodecFailure = assetUrl && isDefinitelyVideo;
    
    return (
      <div className="mt-2 text-white/30 text-[11px] flex flex-col gap-1 p-2 bg-black/40 rounded border border-red-500/30">
        <div className="flex items-center gap-1">
          <span className="material-symbols-outlined text-[14px] text-red-400">broken_image</span>
          <span className="text-red-400 font-bold">Preview not available</span>
        </div>
        <div className="text-[10px] text-white/70 mt-1">
          {isRustFailure ? (
            "The file could not be found on your local system. Make sure the path is correct."
          ) : isCodecFailure ? (
            "The video file was found, but your system's browser engine (WebKitGTK) doesn't support this codec. (You may need to install gstreamer1.0-plugins-bad/ugly)."
          ) : (
            "The media file was found but the browser blocked it from loading (possibly due to Tauri asset scope permissions)."
          )}
        </div>
        <div className="text-[9px] font-mono break-all opacity-50 mt-1 bg-black/50 p-1 rounded">
          src: {src}<br/>
          assetUrl: {assetUrl || 'null'}<br/>
          explicit: {explicitMediaField ? 'yes' : 'no'} (forced: {treatAsMedia ? 'yes' : 'no'})
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

  const isYouTube = assetUrl.includes('youtube.com/embed/');

  return (
    <div className="mt-2 rounded-md overflow-hidden border border-white/10 bg-black/20 w-fit max-w-full relative group">
      {isYouTube ? (
        <iframe 
          src={assetUrl} 
          className="h-32 md:h-48 w-auto aspect-video max-w-full"
          allowFullScreen
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          onLoad={() => setStatus('success')}
        />
      ) : isDefinitelyVideo ? (
        <video 
          src={assetUrl} 
          controls 
          controlsList="nofullscreen"
          className="h-32 md:h-48 w-auto object-cover max-w-full"
          preload="metadata"
          onError={() => setStatus(treatAsMedia ? 'error' : 'not-media')}
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
            onError={() => setStatus(treatAsMedia ? 'error' : 'not-media')}
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
    </div>
  );
}

