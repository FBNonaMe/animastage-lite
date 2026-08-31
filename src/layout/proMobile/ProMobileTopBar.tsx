import { Menu, Share2, Video } from 'lucide-react';

interface ProMobileTopBarProps {
  title: string;
  onMenu: () => void;
  onShare: () => void;
  onExport: () => void;
  shareBusy?: boolean;
}

export default function ProMobileTopBar({
  title,
  onMenu,
  onShare,
  onExport,
  shareBusy = false,
}: ProMobileTopBarProps) {
  return (
    <header
      className="pro-topbar shrink-0 z-[45] flex items-center gap-2 min-h-12 px-3"
      style={{
        paddingTop: 'max(0.35rem, env(safe-area-inset-top, 0px))',
        paddingLeft: 'max(0.75rem, env(safe-area-inset-left, 0px))',
        paddingRight: 'max(0.75rem, env(safe-area-inset-right, 0px))',
      }}
    >
      <button
        type="button"
        onClick={onMenu}
        className="pro-topbar__btn min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-zinc-200"
        aria-label="Menu"
      >
        <Menu className="w-5 h-5" />
      </button>
      <p className="pro-topbar__title flex-1 text-center text-sm font-semibold text-zinc-100 truncate m-0">
        {title}
      </p>
      <button
        type="button"
        onClick={onShare}
        disabled={shareBusy}
        className="pro-topbar__btn min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-cyan-300/90 disabled:opacity-40"
        aria-label="Share scene"
      >
        <Share2 className="w-5 h-5" />
      </button>
      <button
        type="button"
        onClick={onExport}
        className="pro-topbar__btn min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-zinc-200"
        aria-label="Open export settings"
        title="Export (FX panel)"
      >
        <Video className="w-5 h-5" />
      </button>
    </header>
  );
}
