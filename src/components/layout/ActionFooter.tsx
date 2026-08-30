import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";

export function ActionFooter({
  isDirty,
  onSave,
  onDiscard,
}: {
  isDirty: boolean;
  onSave: () => void;
  onDiscard: () => void;
}) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="sticky bottom-4 md:bottom-8 mt-12 bg-background/90 backdrop-blur-md border border-white/15 p-4 rounded-xl flex justify-between items-center z-20"
    >
      <span className="font-code-sm text-code-sm text-white/50 hidden md:inline-block">
        {isDirty ? "Unsaved changes" : "All changes saved"}
      </span>
      <div className="flex gap-4 w-full md:w-auto justify-end">
        <Button 
          variant="outline"
          onClick={onDiscard}
          disabled={!isDirty}
          className="h-[44px] bg-transparent hover:bg-white/5 text-primary border-white/10"
        >
          Discard
        </Button>
        <Button 
          onClick={onSave}
          disabled={!isDirty}
          className="h-[44px] bg-primary text-background hover:bg-[#E5E5E5] hover:scale-[1.02] transition-transform flex items-center gap-2 font-bold px-8 shadow-[0_0_15px_rgba(255,255,255,0.1)]"
        >
          <span className="material-symbols-outlined text-[18px]">save</span> 
          Save Changes
        </Button>
      </div>
    </motion.div>
  );
}
