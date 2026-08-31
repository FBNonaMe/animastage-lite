/**
 * Smart Studio dock — launches real Smart Studio / One Click / Cine / Demo flows.
 */
import { Clapperboard, Image, Video, Wand2, LayoutGrid } from 'lucide-react';
import { Button, Panel } from '../../components/UI';
import type { SmartStudioMode } from '../../smartStudio/types';

export interface SmartStudioDockProps {
  hasModel: boolean;
  onOpenSmartPicker: () => void;
  onEnterSmartMode: (mode: SmartStudioMode) => void;
  onOpenOneClick?: () => void;
  onOpenCineStudio?: () => void;
  onOpenReferenceCameraStudio?: () => void;
  onOpenDemoGallery?: () => void;
}

export default function SmartStudioDock({
  hasModel,
  onOpenSmartPicker,
  onEnterSmartMode,
  onOpenOneClick,
  onOpenCineStudio,
  onOpenReferenceCameraStudio,
  onOpenDemoGallery,
}: SmartStudioDockProps) {
  return (
    <div className="p-2 space-y-2">
      <Panel className="!p-2 space-y-2">
        <p className="text-[10px] font-bold text-zinc-200 m-0">Smart Studio</p>
        <p className="text-[9px] text-zinc-500 m-0 leading-relaxed">
          Auto Showcase, Photo, and Video on the shared engine.
        </p>
        <Button
          type="button"
          variant="primary"
          size="sm"
          className="w-full"
          disabled={!hasModel}
          onClick={onOpenSmartPicker}
        >
          <Clapperboard className="w-3.5 h-3.5" />
          Open Smart Studio
        </Button>
        <div className="grid grid-cols-3 gap-1">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="w-full !text-[9px]"
            disabled={!hasModel}
            onClick={() => onEnterSmartMode('showcase')}
          >
            Showcase
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="w-full !text-[9px]"
            disabled={!hasModel}
            onClick={() => onEnterSmartMode('photo')}
          >
            <Image className="w-3 h-3" />
            Photo
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="w-full !text-[9px]"
            disabled={!hasModel}
            onClick={() => onEnterSmartMode('video')}
          >
            <Video className="w-3 h-3" />
            Video
          </Button>
        </div>
      </Panel>

      <Panel className="!p-2 space-y-1.5">
        {onOpenOneClick ? (
          <Button type="button" size="sm" variant="secondary" className="w-full" onClick={onOpenOneClick}>
            <Wand2 className="w-3.5 h-3.5" />
            One Click Creator
          </Button>
        ) : null}
        {onOpenCineStudio ? (
          <Button type="button" size="sm" variant="secondary" className="w-full" onClick={onOpenCineStudio}>
            <Clapperboard className="w-3.5 h-3.5" />
            Cinematography Studio
          </Button>
        ) : null}
        {onOpenReferenceCameraStudio ? (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="w-full"
            onClick={onOpenReferenceCameraStudio}
          >
            <Video className="w-3.5 h-3.5" />
            Reference Camera Studio
          </Button>
        ) : null}
        {onOpenDemoGallery ? (
          <Button type="button" size="sm" variant="ghost" className="w-full" onClick={onOpenDemoGallery}>
            <LayoutGrid className="w-3.5 h-3.5" />
            Demo Gallery
          </Button>
        ) : null}
      </Panel>
    </div>
  );
}
