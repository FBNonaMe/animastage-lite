/**
 * Shot Composer 1.0 — Place Character / Create Shot / Saved Shots.
 */
import {
  Aperture,
  Camera,
  Crosshair,
  Focus,
  MapPin,
  Sparkles,
  UserRound,
} from 'lucide-react';
import type { AppState, CameraSnapshot, ViewportFormat } from '../../types';
import {
  SHOT_ASPECTS,
  SHOT_CAMERA_PRESETS,
  SHOT_PRESETS,
  type CharacterOrientMode,
  type CharacterScaleMode,
  type CompositionGuideId,
  type FramingFocus,
  type ShotCameraPresetId,
  type ShotComposerState,
  type ShotPresetId,
  type ShotTransitionEase,
} from '../../shotComposer';
import { Button, Panel, SectionHeader, Select, Slider, Toggle } from '../UI';

export interface ShotComposerPanelProps {
  appState: AppState;
  shotComposer: ShotComposerState;
  onPatch: (patch: Partial<ShotComposerState>) => void;
  onPlaceCharacterMode: () => void;
  onPlaceCameraMode: () => void;
  onCreateShot: () => void;
  onAutoFrame: () => void;
  onSaveShot: () => void;
  onApplyShot: (shotId: string) => void;
  onDeleteShot: (shotId: string) => void;
  onSetAspect: (aspect: ViewportFormat) => void;
  onOrient: (mode: CharacterOrientMode) => void;
  viewportFormat: ViewportFormat;
}

export default function ShotComposerPanel({
  appState,
  shotComposer: sc,
  onPatch,
  onPlaceCharacterMode,
  onPlaceCameraMode,
  onCreateShot,
  onAutoFrame,
  onSaveShot,
  onApplyShot,
  onDeleteShot,
  onSetAspect,
  onOrient,
  viewportFormat,
}: ShotComposerPanelProps) {
  const characters = appState.models.filter(
    (m) => m.assetKind !== 'stage' && m.assetKind !== 'prop'
  );
  const stages = appState.models.filter((m) => m.assetKind === 'stage');
  const selected = characters.find((m) => m.id === appState.selectedObjectId) ?? characters[0];
  const placing = sc.mode === 'place_character' || sc.mode === 'create_shot';
  const placingCam = sc.mode === 'place_camera';

  const toggleGuide = (id: CompositionGuideId) => {
    const has = sc.guides.includes(id);
    onPatch({
      guides: has ? sc.guides.filter((g) => g !== id) : [...sc.guides, id],
    });
  };

  return (
    <div className="ds-stack">
      <Panel>
        <SectionHeader
          title={
            <>
              <Sparkles className="w-3.5 h-3.5" />
              Shot Composer 1.0
            </>
          }
        />
        <p className="text-[10px] text-zinc-500 m-0 leading-snug">
          Import environment → place character → pick aspect &amp; preset → Create Shot.
          Does not change fog, lights, sky, or FX.
        </p>
        <div className="flex flex-wrap gap-1.5 mt-2">
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
            Env {stages.length ? '✓' : '—'}
          </span>
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
            Char {characters.length ? '✓' : '—'}
          </span>
          {sc.envAnalysis ? (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-teal-950/50 text-teal-200/90">
              Floor Y {sc.envAnalysis.floorY.toFixed(2)} · meshes {sc.envAnalysis.meshCount}
            </span>
          ) : null}
        </div>
      </Panel>

      <Panel>
        <SectionHeader
          title={
            <>
              <MapPin className="w-3.5 h-3.5" />
              Place
            </>
          }
        />
        <div className="ds-stack ds-stack--sm">
          <p className="text-[10px] text-zinc-500 m-0">
            {selected ? `Character: ${selected.name}` : 'Select a character first'}
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            <Button
              type="button"
              size="sm"
              variant={placing ? 'primary' : 'secondary'}
              className="w-full"
              disabled={!selected}
              onClick={onPlaceCharacterMode}
            >
              <UserRound className="w-3 h-3" />
              {placing ? 'Placing…' : 'Place Character'}
            </Button>
            <Button
              type="button"
              size="sm"
              variant={placingCam ? 'primary' : 'secondary'}
              className="w-full"
              onClick={onPlaceCameraMode}
            >
              <Camera className="w-3 h-3" />
              {placingCam ? 'Placing…' : 'Place Camera'}
            </Button>
          </div>
          {placing || placingCam ? (
            <p className="text-[9px] text-teal-200/80 m-0">
              Click surface to confirm · Right-click cancel · Drag still orbits
            </p>
          ) : null}
          {sc.ghostHit ? (
            <div className="text-[9px] font-mono text-zinc-400 space-y-0.5">
              <div>
                Pos {sc.ghostHit.position.map((v) => v.toFixed(2)).join(', ')}
              </div>
              <div>
                Normal {sc.ghostHit.normal.map((v) => v.toFixed(2)).join(', ')} ·{' '}
                {sc.ghostHit.walkable ? 'walkable' : 'blocked'}
              </div>
            </div>
          ) : null}
        </div>
      </Panel>

      <Panel>
        <SectionHeader
          accent="accent"
          title={
            <>
              <Aperture className="w-3.5 h-3.5" />
              Aspect &amp; presets
            </>
          }
        />
        <div className="ds-stack ds-stack--sm">
          <div className="ds-segmented flex flex-wrap gap-0.5">
            {SHOT_ASPECTS.map((a) => (
              <Button
                key={a.id}
                type="button"
                size="sm"
                variant="secondary"
                active={sc.aspect === a.id || viewportFormat === a.id}
                className="text-[9px]"
                onClick={() => onSetAspect(a.id)}
              >
                {a.label}
              </Button>
            ))}
          </div>
          <Select
            value={sc.shotPreset}
            onChange={(e) => onPatch({ shotPreset: e.target.value as ShotPresetId })}
          >
            {SHOT_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </Select>
          <Select
            value={sc.cameraPreset}
            onChange={(e) => {
              const id = e.target.value as ShotCameraPresetId;
              const preset = SHOT_CAMERA_PRESETS.find((p) => p.id === id);
              onPatch({
                cameraPreset: id,
                shotPreset: preset?.shotPreset ?? sc.shotPreset,
              });
              if (preset) onSetAspect(preset.aspect);
            }}
          >
            {SHOT_CAMERA_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                Camera: {p.label}
              </option>
            ))}
          </Select>
          <Button type="button" variant="primary" className="w-full" onClick={onCreateShot} disabled={!selected}>
            <Sparkles className="w-3.5 h-3.5" />
            Create Shot (click place)
          </Button>
          <Button type="button" variant="secondary" className="w-full" onClick={onAutoFrame} disabled={!selected}>
            <Focus className="w-3.5 h-3.5" />
            Auto Frame (current place)
          </Button>
        </div>
      </Panel>

      <Panel>
        <SectionHeader title="Scale & orientation" />
        <div className="ds-stack ds-stack--sm">
          <Select
            value={sc.scaleMode}
            onChange={(e) => onPatch({ scaleMode: e.target.value as CharacterScaleMode })}
          >
            <option value="mmd">MMD Scale</option>
            <option value="real_world">Real World Scale</option>
            <option value="custom">Custom Height</option>
            <option value="auto">Auto Scale</option>
          </Select>
          {(sc.scaleMode === 'custom' || sc.scaleMode === 'real_world') && (
            <Slider
              label="Height (m)"
              valueLabel={sc.customHeight.toFixed(2)}
              min={0.8}
              max={2.2}
              step={0.01}
              value={sc.customHeight}
              onChange={(e) => onPatch({ customHeight: Number(e.target.value) })}
            />
          )}
          <Select
            value={sc.framingFocus}
            onChange={(e) => onPatch({ framingFocus: e.target.value as FramingFocus })}
          >
            <option value="full_body">Frame: Full Body</option>
            <option value="upper_body">Frame: Upper Body</option>
            <option value="face">Frame: Face</option>
            <option value="custom">Frame: Custom</option>
          </Select>
          <div className="grid grid-cols-2 gap-1">
            {(
              [
                ['face_camera', 'Face Camera'],
                ['face_forward', 'Face Forward'],
                ['face_target', 'Face Target'],
                ['manual', 'Manual'],
              ] as const
            ).map(([id, label]) => (
              <Button
                key={id}
                type="button"
                size="sm"
                variant="secondary"
                active={sc.orientMode === id}
                onClick={() => onOrient(id)}
              >
                {label}
              </Button>
            ))}
          </div>
          <Toggle
            label="Keep upright"
            checked={sc.keepUpright}
            onChange={(e) => onPatch({ keepUpright: e.target.checked })}
          />
          <Slider
            label="Floor Y override"
            valueLabel={sc.floorYOverride == null ? 'auto' : sc.floorYOverride.toFixed(2)}
            min={-5}
            max={20}
            step={0.05}
            value={sc.floorYOverride ?? sc.envAnalysis?.floorY ?? 0}
            onChange={(e) => onPatch({ floorYOverride: Number(e.target.value) })}
          />
          <Button type="button" size="sm" variant="secondary" onClick={() => onPatch({ floorYOverride: null })}>
            Reset floor override
          </Button>
        </div>
      </Panel>

      <Panel>
        <SectionHeader
          title={
            <>
              <Crosshair className="w-3.5 h-3.5" />
              Composition guides
            </>
          }
        />
        <div className="flex flex-wrap gap-1">
          {(
            [
              ['thirds', 'Thirds'],
              ['center', 'Center'],
              ['golden', 'Golden'],
              ['headroom', 'Head'],
              ['safe', 'Safe'],
              ['safe_v', 'Safe V'],
              ['safe_h', 'Safe H'],
            ] as const
          ).map(([id, label]) => (
            <Button
              key={id}
              type="button"
              size="sm"
              variant="secondary"
              active={sc.guides.includes(id)}
              className="text-[9px]"
              onClick={() => toggleGuide(id)}
            >
              {label}
            </Button>
          ))}
        </div>
        {sc.lastWarnings.length > 0 ? (
          <ul className="m-0 mt-2 pl-4 text-[9px] text-amber-200/90 space-y-0.5">
            {sc.lastWarnings.map((w) => (
              <li key={w.id}>{w.message}</li>
            ))}
          </ul>
        ) : null}
      </Panel>

      <Panel>
        <SectionHeader title="Saved shots" />
        <div className="ds-stack ds-stack--sm">
          <div className="flex gap-1.5">
            <Button type="button" size="sm" variant="secondary" className="flex-1" onClick={onSaveShot} disabled={!selected}>
              Save Shot
            </Button>
            <Select
              value={sc.transitionEase}
              onChange={(e) => onPatch({ transitionEase: e.target.value as ShotTransitionEase })}
            >
              <option value="ease_in_out">Ease In Out</option>
              <option value="smooth">Smooth</option>
              <option value="ease_in">Ease In</option>
              <option value="ease_out">Ease Out</option>
              <option value="cubic">Cubic</option>
              <option value="quintic">Quintic</option>
              <option value="bezier">Bezier</option>
              <option value="linear">Linear</option>
            </Select>
          </div>
          {sc.savedShots.length === 0 ? (
            <p className="text-[10px] text-zinc-500 m-0">No saved shots yet.</p>
          ) : (
            <div className="ds-stack ds-stack--sm max-h-48 overflow-y-auto">
              {sc.savedShots.map((shot) => (
                <div
                  key={shot.id}
                  className={`flex items-center gap-1 rounded border px-1.5 py-1 ${
                    sc.activeShotId === shot.id
                      ? 'border-teal-500/40 bg-teal-950/30'
                      : 'border-zinc-800 bg-zinc-900/40'
                  }`}
                >
                  <button
                    type="button"
                    className="flex-1 text-left text-[10px] font-bold text-zinc-200 cursor-pointer truncate"
                    onClick={() => onApplyShot(shot.id)}
                  >
                    {shot.name}
                    <span className="block text-[8px] font-normal text-zinc-500 truncate">
                      {shot.shotPreset} · {shot.aspect}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="text-[9px] text-zinc-500 hover:text-red-400 cursor-pointer"
                    onClick={() => onDeleteShot(shot.id)}
                  >
                    Del
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </Panel>
    </div>
  );
}

/** Optional type export for App fly helpers */
export type ShotComposerFly = (snapshot: CameraSnapshot) => void;
