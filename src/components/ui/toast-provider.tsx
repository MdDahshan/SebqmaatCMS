import { Toast } from "@base-ui/react/toast";
import { createContext, useContext, ReactNode } from "react";
import type { ToastObject } from "@base-ui/react/toast";

// ── Global manager (imperative API) ──────────────────────────────────────────
const manager = Toast.createToastManager();

interface ToastContextValue {
  success: (message: string, title?: string) => void;
  error: (message: string, title?: string) => void;
  info: (message: string, title?: string) => void;
  warning: (message: string, title?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

// ── Individual toast ──────────────────────────────────────────────────────────
const iconMap: Record<string, string> = {
  success: "check_circle", error: "error", info: "info", warning: "warning",
};

type AnyToastObject = ToastObject<Record<string, unknown>>;

function ToastItem({ toast }: { toast: AnyToastObject }) {
  const t = (toast.type as string | undefined) ?? "info";

  return (
    <Toast.Root
      toast={toast}
      className="base-toast relative flex items-center gap-3 min-w-[280px] w-auto bg-background border border-white/20 rounded-lg px-4 py-3 shadow-lg overflow-hidden"
    >
      {/* Icon */}
      <span className="material-symbols-outlined text-[20px] text-foreground/80 shrink-0">
        {iconMap[t] ?? "notifications"}
      </span>
      {/* Text */}
      <div className="flex-1 min-w-0">
        <Toast.Title className="block text-[13px] font-medium text-foreground leading-tight" />
        {toast.description && (
          <Toast.Description className="block text-[12px] text-muted-foreground leading-snug break-words mt-0.5" />
        )}
      </div>
      {/* Close */}
      <Toast.Close className="shrink-0 text-muted-foreground hover:text-foreground transition-colors cursor-pointer outline-none">
        <span className="material-symbols-outlined text-[16px]">close</span>
      </Toast.Close>
    </Toast.Root>
  );
}

// ── Viewport (inner component that uses hook) ─────────────────────────────────
function ToastViewport() {
  const { toasts } = Toast.useToastManager();
  return (
    <Toast.Viewport className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2 items-end outline-none w-[340px] pointer-events-none [&>*]:pointer-events-auto">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast as AnyToastObject} />
      ))}
    </Toast.Viewport>
  );
}

// ── Provider ──────────────────────────────────────────────────────────────────
export function ToastProvider({ children }: { children: ReactNode }) {
  const ctx: ToastContextValue = {
    success: (msg, title) => manager.add({ type: "success", title: title ?? "Success", description: msg, timeout: 3000 }),
    error: (msg, title) => manager.add({ type: "error", title: title ?? "Error", description: msg, timeout: 4000 }),
    info: (msg, title) => manager.add({ type: "info", title: title ?? "Info", description: msg, timeout: 3000 }),
    warning: (msg, title) => manager.add({ type: "warning", title: title ?? "Warning", description: msg, timeout: 3500 }),
  };

  return (
    <ToastContext.Provider value={ctx}>
      {children}
      <Toast.Provider toastManager={manager}>
        <ToastViewport />
      </Toast.Provider>
    </ToastContext.Provider>
  );
}
