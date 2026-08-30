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
    <div className="sticky bottom-4 md:bottom-8 mt-12 bg-background/90 backdrop-blur-md border border-white/15 p-4 rounded-xl flex justify-between items-center z-20">
      <span className="font-code-sm text-code-sm text-white/50 hidden md:inline-block">
        {isDirty ? "Unsaved changes" : "All changes saved"}
      </span>
      <div className="flex gap-4 w-full md:w-auto justify-end">
        <button 
          onClick={onDiscard}
          disabled={!isDirty}
          className="px-6 py-3 rounded-xl bg-white/5 border border-white/10 text-primary font-label-md text-label-md hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Discard
        </button>
        <button 
          onClick={onSave}
          disabled={!isDirty}
          className="px-8 py-3 rounded-xl bg-primary text-background font-label-md text-label-md font-bold hover:bg-[#E5E5E5] hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed transition-all flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-[18px]">save</span> 
          Save Changes
        </button>
      </div>
    </div>
  );
}
