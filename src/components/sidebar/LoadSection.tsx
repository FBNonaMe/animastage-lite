import { Plus, LayoutGrid } from 'lucide-react';
import FileUploader from '../FileUploader';
import DemoGalleryPanel from '../gallery/DemoGalleryPanel';
import type { ProcessedMMDFiles, ProcessedVmdFiles } from '../../utils/mmdFiles';
import { Button, Panel } from '../UI';

interface LoadSectionProps {
  onLoadModel: (preset: 'miku' | 'kizuna' | 'custom') => void;
  onLoadCustomModel: (data: ProcessedMMDFiles) => void;
  attachVmdTargetModelId?: string | null;
  onAttachVmd?: (modelId: string, vmd: ProcessedVmdFiles) => void;
  onInstallStylePack?: (files: File[]) => void | Promise<void>;
  onLoadDemo?: (demoId: string) => void;
  onOpenDemoGallery?: () => void;
  demoLoadingId?: string | null;
  activeDemoId?: string | null;
}

export default function LoadSection({
  onLoadModel,
  onLoadCustomModel,
  attachVmdTargetModelId = null,
  onAttachVmd,
  onInstallStylePack,
  onLoadDemo,
  onOpenDemoGallery,
  demoLoadingId = null,
  activeDemoId = null,
}: LoadSectionProps) {
  return (
    <>
      <Panel className="!p-[var(--space-md)]">
        <p className="text-[var(--font-size-sm)] text-[var(--color-text-muted)] m-0 mb-[var(--space-md)]">
          Sample characters or import your own files.
        </p>
        <div className="grid grid-cols-2 gap-[var(--space-sm)]">
          <Button type="button" variant="secondary" size="sm" className="w-full" onClick={() => onLoadModel('miku')}>
            <Plus className="w-3.5 h-3.5" />
            Miku
          </Button>
          <Button type="button" variant="secondary" size="sm" className="w-full" onClick={() => onLoadModel('kizuna')}>
            <Plus className="w-3.5 h-3.5" />
            Kizuna
          </Button>
        </div>
      </Panel>

      <Panel className="!p-[var(--space-md)]">
        <p className="text-[var(--font-size-sm)] font-medium text-[var(--color-text-main)] m-0 mb-[var(--space-sm)]">
          Import folder or ZIP
        </p>
        <FileUploader
          onModelLoaded={onLoadCustomModel}
          attachVmdTargetModelId={attachVmdTargetModelId}
          onAttachVmd={onAttachVmd}
          onInstallStylePack={onInstallStylePack}
        />
      </Panel>

      {onLoadDemo ? (
        <Panel className="!p-[var(--space-md)]">
          <DemoGalleryPanel
            onLoadDemo={onLoadDemo}
            loadingDemoId={demoLoadingId}
            activeDemoId={activeDemoId}
            compact
          />
          {onOpenDemoGallery ? (
            <Button type="button" variant="ghost" size="sm" className="w-full mt-[var(--space-sm)]" onClick={onOpenDemoGallery}>
              <LayoutGrid className="w-3.5 h-3.5" />
              Browse all demos
            </Button>
          ) : null}
        </Panel>
      ) : null}
    </>
  );
}
