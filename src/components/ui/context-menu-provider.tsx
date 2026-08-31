import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { writeText, readText } from "@tauri-apps/plugin-clipboard-manager";

// ── Types ─────────────────────────────────────────────────────────────────────
export interface ContextMenuItem {
  label: string;
  icon?: string;
  action: () => void;
  destructive?: boolean;
  disabled?: boolean;
}

export interface ContextMenuSeparator {
  separator: true;
}

export type ContextMenuEntry = ContextMenuItem | ContextMenuSeparator;

type MenuState = {
  x: number;
  y: number;
  items: ContextMenuEntry[];
} | null;

interface ContextMenuContextValue {
  openMenu: (x: number, y: number, items: ContextMenuEntry[]) => void;
  closeMenu: () => void;
}

const Ctx = createContext<ContextMenuContextValue | null>(null);

export function useContextMenu() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useContextMenu must be within ContextMenuProvider");
  return ctx;
}

// ── Floating popup rendered via portal ───────────────────────────────────────
function MenuPopup({
  state,
  onClose,
}: {
  state: NonNullable<MenuState>;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: state.x, y: state.y });

  useEffect(() => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    setPos({
      x: state.x + rect.width > vw ? Math.max(4, state.x - rect.width) : state.x,
      y: state.y + rect.height > vh ? Math.max(4, state.y - rect.height) : state.y,
    });
  }, [state.x, state.y]);

  return (
    <div
      id="cms-context-menu"
      ref={ref}
      role="menu"
      className="fixed z-[99999] min-w-[200px] py-1.5 bg-[#1e1e1e] border border-white/10 rounded-xl shadow-2xl backdrop-blur-xl"
      style={{ left: pos.x, top: pos.y }}
    >
      {state.items.map((entry, i) => {
        if ("separator" in entry) {
          return <div key={i} className="my-1 border-t border-white/8 mx-2" />;
        }
        const item = entry as ContextMenuItem;
        return (
          <button
            key={i}
            role="menuitem"
            disabled={item.disabled}
            onClick={() => {
              item.action();
              onClose();
            }}
            className={`flex items-center gap-2.5 w-full px-3.5 py-[7px] text-[13px] transition-colors text-left rounded-lg mx-auto cursor-default select-none
              ${item.disabled
                ? "text-white/20 pointer-events-none"
                : item.destructive
                  ? "text-red-400 hover:bg-red-500/10 hover:text-red-300"
                  : "text-white/75 hover:bg-white/8 hover:text-white"
              }`}
            style={{ width: "calc(100% - 8px)", margin: "1px 4px" }}
          >
            {item.icon && (
              <span
                className={`material-symbols-outlined text-[16px] shrink-0 ${
                  item.disabled ? "opacity-30" : "opacity-60"
                }`}
              >
                {item.icon}
              </span>
            )}
            <span className="flex-1">{item.label}</span>
            {item.disabled && (
              <span className="text-[11px] text-white/25 ml-auto">unavailable</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ── Provider ──────────────────────────────────────────────────────────────────
export function ContextMenuProvider({
  children,
  onFileAction,
}: {
  children: ReactNode;
  onFileAction?: (action: string, path: string) => void;
}) {
  const [menu, setMenu] = useState<MenuState>(null);

  const openMenu = useCallback((x: number, y: number, items: ContextMenuEntry[]) => {
    setMenu({ x, y, items });
  }, []);
  const closeMenu = useCallback(() => setMenu(null), []);

  // Global right-click handler
  useEffect(() => {
    const handler = async (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const fileEl = target.closest("[data-context='file']") as HTMLElement | null;

      if (!fileEl) return;

      e.preventDefault();

      const items: ContextMenuEntry[] = [];
      const path = fileEl.getAttribute("data-file-path") || "";
      const fileName = path.split(/[/\\]/).pop() || path;

      items.push(
        { label: "Open in Editor", icon: "edit", action: () => onFileAction?.("open", path) },
        { label: "Open as Diff", icon: "difference", action: () => onFileAction?.("open-diff", path) },
        { separator: true },
        { label: "Copy File Path", icon: "content_copy", action: async () => await writeText(path) },
        { label: "Copy File Name", icon: "file_copy", action: async () => await writeText(fileName) },
      );

      if (items.length > 0) {
        setMenu({ x: e.clientX + 4, y: e.clientY + 2, items });
      }
    };

    window.addEventListener("contextmenu", handler);
    return () => window.removeEventListener("contextmenu", handler);
  }, [onFileAction]);

  // Close on click outside or Escape
  useEffect(() => {
    if (!menu) return;
    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest("#cms-context-menu")) return;
      closeMenu();
    };
    window.addEventListener("pointerdown", handleOutsideClick, { capture: true });
    window.addEventListener("scroll", closeMenu, { capture: true, passive: true });
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") closeMenu(); };
    window.addEventListener("keydown", esc);
    return () => {
      window.removeEventListener("pointerdown", handleOutsideClick, { capture: true });
      window.removeEventListener("scroll", closeMenu, { capture: true });
      window.removeEventListener("keydown", esc);
    };
  }, [menu, closeMenu]);

  return (
    <Ctx.Provider value={{ openMenu, closeMenu }}>
      {children}
      {menu && createPortal(<MenuPopup state={menu} onClose={closeMenu} />, document.body)}
    </Ctx.Provider>
  );
}


