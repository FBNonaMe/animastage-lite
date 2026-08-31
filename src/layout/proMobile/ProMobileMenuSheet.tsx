import { FolderOpen, Layers, Play, Save, Sparkles, Trash2 } from 'lucide-react';
import ProSnapBottomSheet from './ProSnapBottomSheet';
import ProMobileMenuSettings from './ProMobileMenuSettings';
import TemplatePicker from '../../product/ui/TemplatePicker';
import { isBeginnerMode } from '../../product/ui/beginnerMode';
import type { ProSnapLevel } from './types';
import type { StudioUiMode } from '../../flow/types';
import type { QualityMode } from '../../product/scene/types';
import type { EditorInterfaceId } from '../../uiVersions';

interface ProMobileMenuSheetProps {
  open: boolean;
  snapLevel: ProSnapLevel;
  onSnapChange: (level: ProSnapLevel) => void;
  onClose: () => void;
  onTryDemo: () => void;
  onSave: () => void;
  onOpenProject: () => void;
  onClearScene: () => void;
  onOpenFxTab: () => void;
  uiMode: StudioUiMode;
  onUiModeChange: (mode: StudioUiMode) => void;
  editorInterface: EditorInterfaceId;
  onEditorInterfaceChange: (id: EditorInterfaceId) => void;
  qualityMode: QualityMode;
  onQualityModeChange: (mode: QualityMode) => void;
  optimizedHint?: boolean;
  onApplyTemplate: (templateId: string) => void;
}

export default function ProMobileMenuSheet({
  open,
  snapLevel,
  onSnapChange,
  onClose,
  onTryDemo,
  onSave,
  onOpenProject,
  onClearScene,
  onOpenFxTab,
  uiMode,
  onUiModeChange,
  editorInterface,
  onEditorInterfaceChange,
  qualityMode,
  onQualityModeChange,
  optimizedHint,
  onApplyTemplate,
}: ProMobileMenuSheetProps) {
  const row =
    'w-full min-h-[48px] flex items-center gap-3 px-4 text-sm font-semibold text-zinc-200 active:bg-white/5 rounded-xl cursor-pointer';

  return (
    <ProSnapBottomSheet
      open={open}
      title="Menu"
      snapLevel={snapLevel}
      sheetMode="content"
      onSnapChange={onSnapChange}
      onClose={onClose}
    >
      <div className="pro-menu-sheet-body">
        <ProMobileMenuSettings
          uiMode={uiMode}
          onUiModeChange={onUiModeChange}
          editorInterface={editorInterface}
          onEditorInterfaceChange={onEditorInterfaceChange}
          qualityMode={qualityMode}
          onQualityModeChange={onQualityModeChange}
          optimizedHint={optimizedHint}
        />

        {isBeginnerMode(uiMode) ? (
          <TemplatePicker
            beginnerMode
            variant="menu"
            onApplyTemplate={(id) => {
              onApplyTemplate(id);
              onClose();
            }}
          />
        ) : null}

        <div className="pro-menu-sheet-divider" role="separator" />

        <div className="p-1 flex flex-col gap-0.5">
          <button type="button" className={row} onClick={() => { onTryDemo(); onClose(); }}>
            <Play className="w-5 h-5 text-[#39c5bb]" />
            Load demo scene
          </button>
          <button type="button" className={row} onClick={() => { onOpenProject(); onClose(); }}>
            <FolderOpen className="w-5 h-5 text-sky-400" />
            Open project
          </button>
          <button type="button" className={row} onClick={() => { onSave(); onClose(); }}>
            <Save className="w-5 h-5 text-zinc-400" />
            Save project
          </button>
          <button
            type="button"
            className={row}
            onClick={() => {
              onOpenFxTab();
              onClose();
            }}
          >
            <Sparkles className="w-5 h-5 text-[#76b900]" />
            FX &amp; effects
          </button>
          <button type="button" className={row} onClick={() => { onClose(); }}>
            <Layers className="w-5 h-5 text-zinc-500" />
            Scene / Camera tabs below
          </button>
          <button
            type="button"
            className={`${row} text-red-300`}
            onClick={() => {
              onClearScene();
              onClose();
            }}
          >
            <Trash2 className="w-5 h-5" />
            Clear scene
          </button>
        </div>
      </div>
    </ProSnapBottomSheet>
  );
}
