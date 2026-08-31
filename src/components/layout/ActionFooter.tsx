import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { createPortal } from "react-dom";

export function ActionFooter({
  isDirty,
  onSave,
  onDiscard,
}: {
  isDirty: boolean;
  onSave: () => void;
  onDiscard: () => void;
}) {
  const portalRoot = document.getElementById("footer-portal-root");
  if (!portalRoot) return null;

  return createPortal(
    <div className="absolute left-0 bottom-4 z-50 pointer-events-none">
      <motion.div 
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        className="bg-background/90 backdrop-blur-md border border-l-0 border-border-low px-3 py-2 rounded-r-xl flex items-center gap-4 shadow-2xl pointer-events-auto"
      >
        <span className="font-code-sm text-code-sm text-white/50 hidden md:inline-block pr-3 border-r border-white/10">
          {isDirty ? "Unsaved changes" : "All changes saved"}
        </span>
        <div className="flex gap-2">
          <Button 
            variant="outline"
            onClick={onDiscard}
            disabled={!isDirty}
            className="h-[32px] px-3 bg-transparent hover:bg-white/5 text-primary border-white/10 text-[12px]"
          >
            Discard
          </Button>
          <Button 
            onClick={onSave}
            disabled={!isDirty}
            className="h-[32px] bg-primary text-background hover:bg-[#E5E5E5] hover:scale-[1.02] transition-transform flex items-center gap-1.5 font-bold px-4 shadow-[0_0_15px_rgba(255,255,255,0.1)] text-[12px]"
          >
            <span className="material-symbols-outlined text-[14px]">save</span> 
            Save Changes
          </Button>
        </div>
      </motion.div>
    </div>,
    portalRoot
  );
}
