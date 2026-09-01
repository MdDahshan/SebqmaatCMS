import React, { useState, useEffect, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface AISidebarProps {
  isOpen: boolean;
  onClose: () => void;
  fileData: any;
  onApplyChanges: (newData: any) => void;
}

interface ChatMessage {
  role: 'user' | 'ai';
  content: string;
}

const TypewriterMarkdown = ({ content, animate, components }: { content: string, animate: boolean, components: any }) => {
  const [displayedContent, setDisplayedContent] = useState(animate ? '' : content);
  
  useEffect(() => {
    if (!animate) {
      setDisplayedContent(content);
      return;
    }
    
    let i = 0;
    setDisplayedContent('');
    
    const intervalId = setInterval(() => {
      setDisplayedContent(content.slice(0, i));
      // Adaptive speed: faster for longer content, but at least 2 chars per tick
      i += Math.max(2, Math.floor(content.length / 80)); 
      if (i > content.length) {
        setDisplayedContent(content);
        clearInterval(intervalId);
      }
    }, 15);
    
    return () => clearInterval(intervalId);
  }, [content, animate]);

  return <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>{displayedContent}</ReactMarkdown>;
};

export function AISidebar({ isOpen, onClose, fileData, onApplyChanges }: AISidebarProps) {
  const [availableCLIs, setAvailableCLIs] = useState<string[]>([]);
  const [selectedCLI, setSelectedCLI] = useState<string | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(500);
  const [isDragging, setIsDragging] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const startResizing = useCallback(() => {
    setIsDragging(true);
  }, []);

  const stopResizing = useCallback(() => {
    setIsDragging(false);
  }, []);

  const resize = useCallback(
    (e: MouseEvent) => {
      if (isDragging) {
        const newWidth = window.innerWidth - e.clientX;
        if (newWidth >= 280 && newWidth <= 800) {
          setSidebarWidth(newWidth);
        }
      }
    },
    [isDragging]
  );

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", resize);
      window.addEventListener("mouseup", stopResizing);
      document.body.style.userSelect = "none";
    } else {
      document.body.style.userSelect = "";
    }
    return () => {
      window.removeEventListener("mousemove", resize);
      window.removeEventListener("mouseup", stopResizing);
      document.body.style.userSelect = "";
    };
  }, [isDragging, resize, stopResizing]);

  useEffect(() => {
    if (isOpen && availableCLIs.length === 0 && !isScanning) {
      scanForCLIs();
    }
  }, [isOpen]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatHistory, isLoading]);

  const scanForCLIs = async () => {
    setIsScanning(true);
    try {
      const clis = await invoke<string[]>("scan_ai_clis");
      setAvailableCLIs(clis);
    } catch (e) {
      console.error("Failed to scan CLIs", e);
    } finally {
      setIsScanning(false);
    }
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || !selectedCLI) return;

    const userMessage = inputMessage.trim();
    setInputMessage("");
    setChatHistory(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const response = await invoke<string>("chat_with_ai", {
        cliName: selectedCLI,
        prompt: userMessage,
        fileContent: fileData ? JSON.stringify(fileData, null, 2) : "{}"
      });

      // Strip ANSI escape codes
      const cleanResponse = response.replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, '');

      // Robust Auto-apply and Hide JSON from UI
      const processAIResponse = (text: string) => {
        let jsonStr = null;
        let originalJsonStr = null;

        const blockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
        if (blockMatch) {
          jsonStr = blockMatch[1];
          originalJsonStr = blockMatch[0];
        } else {
          const firstBrace = text.indexOf('{');
          const firstBracket = text.indexOf('[');
          const lastBrace = text.lastIndexOf('}');
          const lastBracket = text.lastIndexOf(']');

          const hasObject = firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace;
          const hasArray = firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket;

          if (hasObject && (!hasArray || firstBrace < firstBracket)) {
            jsonStr = text.substring(firstBrace, lastBrace + 1);
            originalJsonStr = jsonStr;
          } else if (hasArray) {
            jsonStr = text.substring(firstBracket, lastBracket + 1);
            originalJsonStr = jsonStr;
          }
        }

        let applied = false;
        if (jsonStr) {
          const tryApplyJSON = (jsonString: string) => {
            const parsed = JSON.parse(jsonString);
            
            let newData;
            if (Array.isArray(fileData) || Array.isArray(parsed)) {
              // If it's an array, we replace entirely since merging arrays by index is error-prone
              newData = parsed;
            } else if (typeof fileData === 'object' && fileData !== null && typeof parsed === 'object' && parsed !== null) {
              // Deep merge Strategy
              const isObject = (item: any) => item && typeof item === 'object' && !Array.isArray(item);
              const mergeDeep = (target: any, source: any) => {
                let output = Object.assign({}, target);
                if (isObject(target) && isObject(source)) {
                  Object.keys(source).forEach(key => {
                    if (isObject(source[key])) {
                      if (!(key in target))
                        Object.assign(output, { [key]: source[key] });
                      else
                        output[key] = mergeDeep(target[key], source[key]);
                    } else {
                      Object.assign(output, { [key]: source[key] });
                    }
                  });
                }
                return output;
              };
              // Fallback: If original has _frontmatter but parsed doesn't, assume parsed belongs in _frontmatter
              let finalParsed = parsed;
              if (fileData._frontmatter && !parsed._frontmatter && !parsed._body) {
                const keys = Object.keys(parsed);
                const isLikelyFrontmatter = keys.some(k => k in fileData._frontmatter);
                if (isLikelyFrontmatter) {
                  finalParsed = { _frontmatter: parsed };
                }
              }
              newData = mergeDeep(fileData, finalParsed);
            } else {
              newData = parsed;
            }
            
            onApplyChanges(newData);
            applied = true;
          };

          try {
            tryApplyJSON(jsonStr);
          } catch (e) {
            try {
              // Aggressive fix for LLM hallucinations
              const fixedStr = jsonStr
                .replace(/""([^"]+)""/g, '"$1"')
                .replace(/""/g, '"')
                .replace(/\\"/g, "'");
              
              tryApplyJSON(fixedStr);
            } catch (e2) {
              console.error("Failed to parse AI JSON output even after fixing", e2);
            }
          }
        }

        if (applied && originalJsonStr) {
          const newText = text.replace(originalJsonStr, '\n\n**Successfully applied changes to the editor!**').trim();
          return newText.startsWith('json') ? newText.replace(/^json\s*/, '') : newText;
        }

        if (!applied && originalJsonStr && (text.includes('json {') || text.includes('```json'))) {
           const newText = text.replace(originalJsonStr, '\n\n**Failed to apply changes:** The AI generated an invalid data format. Please try rephrasing your request.').trim();
           return newText.startsWith('json') ? newText.replace(/^json\s*/, '') : newText;
        }

        return text;
      };

      const finalResponseText = processAIResponse(cleanResponse);
      setChatHistory(prev => [...prev, { role: 'ai', content: finalResponseText }]);
    } catch (e: any) {
      setChatHistory(prev => [...prev, { role: 'ai', content: `Error: ${e}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplyCodeBlock = (code: string) => {
    try {
      const parsed = JSON.parse(code);
      onApplyChanges(parsed);
    } catch (e) {
      alert("Failed to parse AI output as JSON. Make sure the AI returned valid JSON.");
    }
  };

  if (!isOpen) return null;

  return (
    <motion.div 
      initial={{ width: 0, opacity: 0 }}
      animate={{ width: sidebarWidth, opacity: 1 }}
      exit={{ width: 0, opacity: 0 }}
      transition={{ duration: isDragging ? 0 : 0.2 }}
      className="h-full bg-background border-l border-border-low flex flex-col shrink-0 relative z-40 overflow-hidden shadow-2xl"
    >
      <div 
        className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/50 active:bg-primary/80 z-50 transition-colors"
        onMouseDown={startResizing}
      />
      
      <div className="h-14 flex items-center justify-between px-4 border-b border-white/5 shrink-0 pl-6">
        <div className="flex items-center gap-2">
          <span className="text-[14px] font-bold text-white tracking-wide">AI Assistant</span>
        </div>
        <div className="flex items-center gap-1">
          <button 
            onClick={() => setChatHistory([])}
            className="text-text-muted hover:text-white transition-colors px-2.5 py-1.5 flex items-center gap-1.5 rounded-md hover:bg-white/10 text-[12px] font-medium"
            title="Start a new chat session"
          >
            New Chat
          </button>
          <div className="w-px h-4 bg-white/10 mx-1" />
          <button 
            onClick={onClose}
            className="text-text-muted hover:text-white transition-colors w-8 h-8 flex items-center justify-center rounded-md hover:bg-white/10"
            title="Close sidebar"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-5">
            {chatHistory.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center gap-3 opacity-60">
                <span className="material-symbols-outlined text-[40px] text-primary">forum</span>
                <p className="text-[13px] text-white">Ask me to modify fields, suggest content, or explain the current file.</p>
              </div>
            )}
            {chatHistory.map((msg, idx) => (
              <div 
                key={idx} 
                className={`flex gap-3 w-full ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
              >
                <div 
                  dir="auto"
                  className={`flex flex-col gap-1 min-w-0 ${
                    msg.role === 'user' ? 'items-end max-w-[85%]' : 'items-start w-full'
                  }`}
                >
                  <span className="text-[10px] text-text-muted font-medium px-1">
                    {msg.role === 'user' ? 'You' : selectedCLI}
                  </span>
                  
                  <div className={`text-[13.5px] leading-relaxed break-words font-sans ${
                    msg.role === 'user' 
                      ? 'px-3.5 py-2.5 rounded-2xl rounded-tr-sm bg-white/10 text-white shadow-sm border border-white/5' 
                      : 'text-white/90 w-full pt-1'
                  }`}>
                    {msg.role === 'user' ? (
                      <span className="whitespace-pre-wrap">{msg.content}</span>
                    ) : (
                      <TypewriterMarkdown 
                        animate={idx === chatHistory.length - 1}
                        content={msg.content}
                        components={{
                          h1: ({node, ...props}: any) => <h1 className="text-[18px] font-bold mt-5 mb-3 text-white border-b border-white/10 pb-1.5" dir="auto" {...props} />,
                          h2: ({node, ...props}: any) => <h2 className="text-[16px] font-semibold mt-4 mb-2 text-white/95" dir="auto" {...props} />,
                          h3: ({node, ...props}: any) => <h3 className="text-[14.5px] font-semibold mt-3 mb-2 text-white/90" dir="auto" {...props} />,
                          h4: ({node, ...props}: any) => <h4 className="text-[13.5px] font-semibold mt-3 mb-1 text-white/80" dir="auto" {...props} />,
                          p: ({node, ...props}: any) => <p className="mb-3 last:mb-0 leading-[1.6]" dir="auto" {...props} />,
                          ul: ({node, ...props}: any) => <ul className="list-disc list-outside ml-5 mb-3 space-y-1" dir="auto" {...props} />,
                          ol: ({node, ...props}: any) => <ol className="list-decimal list-outside ml-5 mb-3 space-y-1" dir="auto" {...props} />,
                          li: ({node, ...props}: any) => <li className="leading-[1.6]" dir="auto" {...props} />,
                          blockquote: ({node, ...props}: any) => <blockquote className="border-l-[3px] border-primary/50 pl-3 italic text-white/70 mb-3 bg-white/[0.02] py-1 rounded-r-md" dir="auto" {...props} />,
                          hr: ({node, ...props}: any) => <hr className="my-4 border-white/10" {...props} />,
                          table: ({node, ...props}: any) => <div className="overflow-x-auto mb-3"><table className="w-full text-left border-collapse text-[13px]" {...props} /></div>,
                          th: ({node, ...props}: any) => <th className="border border-white/20 px-3 py-2 bg-white/5 font-semibold text-white" {...props} />,
                          td: ({node, ...props}: any) => <td className="border border-white/10 px-3 py-2" {...props} />,
                          code: ({node, inline, className, children, ...props}: any) => {
                            const match = /language-(\w+)/.exec(className || '')
                            return !inline ? (
                              <div className="rounded-md bg-[#0d0d0d] border border-white/10 overflow-hidden my-3 shadow-sm">
                                {match && (
                                  <div className="flex justify-between items-center px-3 py-1.5 bg-black/60 border-b border-white/10">
                                    <span className="text-[10px] text-white/50 font-mono uppercase tracking-wider">{match[1]}</span>
                                    {match[1] === 'json' && (
                                      <button 
                                        onClick={() => handleApplyCodeBlock(String(children))}
                                        className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded hover:bg-primary/30 transition-colors cursor-pointer font-medium"
                                      >
                                        Apply Changes
                                      </button>
                                    )}
                                  </div>
                                )}
                                <pre className="p-3 overflow-x-auto text-[12px] font-mono leading-relaxed text-white/80" dir="ltr">
                                  <code className={className} {...props}>
                                    {children}
                                  </code>
                                </pre>
                              </div>
                            ) : (
                              <code className="bg-white/10 rounded px-1.5 py-0.5 text-[12px] font-mono text-primary/90" dir="ltr" {...props}>
                                {children}
                              </code>
                            )
                          },
                          a: ({node, ...props}: any) => <a className="text-primary hover:underline hover:text-primary/80 transition-colors font-medium" {...props} />,
                          strong: ({node, ...props}: any) => <strong className="font-semibold text-white" {...props} />
                        }}
                      />
                    )}
                  </div>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-3 w-full flex-row">
                <div className="flex flex-col gap-1 min-w-0 items-start w-full">
                  <span className="text-[10px] text-text-muted font-medium px-1">{selectedCLI}</span>
                  <div className="flex items-center gap-1.5 px-1 py-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce"></span>
                    <span className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: '150ms' }}></span>
                    <span className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: '300ms' }}></span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Chat Input Area */}
          <div className="p-4 border-t border-white/5 bg-background shrink-0 flex flex-col gap-3">
            {/* CLI Badges */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] text-text-muted font-medium">Select an AI Engine</span>
              <div className="flex flex-wrap gap-2">
                {isScanning ? (
                  <span className="text-[11px] text-text-muted animate-pulse">Scanning...</span>
                ) : availableCLIs.length > 0 ? (
                  availableCLIs.map((cli) => (
                    <button
                      key={cli}
                      onClick={() => setSelectedCLI(cli)}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-medium border transition-colors ${
                        selectedCLI === cli 
                          ? "bg-primary/20 text-primary border-primary/30" 
                          : "bg-white/5 text-text-muted border-white/10 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      {cli}
                    </button>
                  ))
                ) : (
                  <span className="text-[11px] text-error">No CLIs found on system.</span>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-2 mt-2">
              <div 
                className={`relative flex flex-col gap-2 bg-white/5 border rounded-xl p-2 transition-all focus-within:border-primary/40 focus-within:bg-white/[0.07] ${
                  inputMessage.trim() ? 'border-primary/30 shadow-[0_0_15px_rgba(255,255,255,0.03)]' : 'border-white/10 hover:border-white/20'
                }`}
              >
                {/* Context Chip */}
                {fileData && (
                  <div className="flex items-center gap-1.5 px-2 pt-1 opacity-70">
                    <span className="material-symbols-outlined text-[14px] text-primary">description</span>
                    <span className="text-[10px] text-text-muted font-medium uppercase tracking-wider">Context: Current File</span>
                  </div>
                )}
                
                <textarea 
                  value={inputMessage}
                  onChange={(e) => {
                    setInputMessage(e.target.value);
                    e.target.style.height = 'auto';
                    e.target.style.height = `${e.target.scrollHeight}px`;
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                      e.currentTarget.style.height = 'auto';
                    }
                  }}
                  placeholder={selectedCLI ? "Ask me to edit, summarize, or explain..." : "Select an engine above first..."}
                  className="w-full min-h-[40px] max-h-[300px] bg-transparent text-[13.5px] text-white placeholder:text-white/30 focus:outline-none resize-none px-2 py-1 leading-relaxed disabled:opacity-50 disabled:cursor-not-allowed overflow-y-auto"
                  disabled={isLoading || !selectedCLI}
                />
                
                <div className="flex items-center justify-between px-1 pb-1">
                  <div className="flex items-center gap-2">
                    {inputMessage.length > 0 ? (
                      <span className="text-[10px] text-white/30 font-medium font-mono px-1">
                        {inputMessage.length} chars {inputMessage.includes('\n') && `• ${inputMessage.split('\n').length} lines`}
                      </span>
                    ) : (
                      <span className="text-[10px] text-white/20 font-medium px-1">Shift + Enter for new line</span>
                    )}
                  </div>
                  
                  <button 
                    onClick={(e) => {
                      handleSendMessage();
                      const textarea = e.currentTarget.parentElement?.previousElementSibling as HTMLTextAreaElement;
                      if (textarea) textarea.style.height = 'auto';
                    }}
                    disabled={!inputMessage.trim() || isLoading || !selectedCLI}
                    className={`w-7 h-7 flex items-center justify-center rounded-lg transition-all ${
                      inputMessage.trim() && !isLoading
                        ? "bg-primary text-background shadow-md hover:bg-white"
                        : "bg-white/10 text-white/30"
                    }`}
                  >
                    {isLoading ? (
                      <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                    ) : (
                      <span className="material-symbols-outlined text-[16px]">arrow_upward</span>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
    </motion.div>
  );
}
