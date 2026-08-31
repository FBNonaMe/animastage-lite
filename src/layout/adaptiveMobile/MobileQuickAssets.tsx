import { FolderOpen } from 'lucide-react';
import { cn } from '../../components/UI/cn';

export interface MobileQuickAssetsProps {
  onOpen: () => void;
  className?: string;
  /** Hide when assets sheet already open */
  hidden?: boolean;
}

/** Always-reachable Assets entry — zero feature loss for import/storage. */
export default function MobileQuickAssets({
  onOpen,
  className,
  hidden,
}: MobileQuickAssetsProps) {
  if (hidden) return null;
  return (
    <button
      type="button"
      className={cn('am-quick-assets', className)}
      onClick={onOpen}
      aria-label="Open Asset Browser"
      title="Assets — ZIP / PMX / VMD / GLB"
    >
      <FolderOpen className="w-5 h-5" aria-hidden />
      <span>Assets</span>
    </button>
  );
}
