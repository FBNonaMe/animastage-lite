import CinematographyStudioPanel, {
  type CinematographyStudioPanelProps,
} from './CinematographyStudioPanel';

interface CinematographyStudioOverlayProps extends CinematographyStudioPanelProps {
  open: boolean;
}

/** Docked cinematography studio — full VCS UI beside the viewport. */
export default function CinematographyStudioOverlay({
  open,
  onClose,
  ...panel
}: CinematographyStudioOverlayProps) {
  if (!open) return null;

  return (
    <div className="absolute top-2 right-2 bottom-2 z-40 w-[min(100%,380px)] pointer-events-auto flex flex-col">
      <CinematographyStudioPanel {...panel} onClose={onClose} />
    </div>
  );
}
