export function Topbar() {
  return (
    <>
      {/* TopAppBar (Mobile) */}
      <header className="md:hidden flex items-center justify-between px-margin-mobile h-16 bg-background/80 backdrop-blur-xl border-b border-border-low sticky top-0 z-50">
        <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-primary tracking-tighter">Sebqmaat</h1>
        <button className="text-text-muted hover:text-primary">
          <span className="material-symbols-outlined text-[24px]">menu</span>
        </button>
      </header>
      
      {/* TopAppBar (Desktop) */}
      <header className="hidden md:flex justify-between items-center h-16 px-margin-desktop w-full bg-background/80 backdrop-blur-xl border-b border-border-low sticky top-0 z-50">
        <div className="flex items-center gap-8">
          <nav className="flex gap-6">
            <span className="text-primary font-bold border-b-2 border-primary pb-1 font-label-md text-label-md">Sebqmaat CMS</span>
          </nav>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex gap-4">
            <button className="text-text-muted hover:text-primary transition-colors">
              <span className="material-symbols-outlined">help_outline</span>
            </button>
          </div>
        </div>
      </header>
    </>
  );
}
