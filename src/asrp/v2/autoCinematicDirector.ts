/**
 * One-click Auto Cinematic Director — VCS paths + Anime Cinematic style + auto FX.
 */
import type { AppState, ViewportFormat } from '../../types';
import { runAutoDirector } from '../../product/vcs/applyVcs';
import { applyAsrpVisualStyle } from './applyVisualStyle';
import { DEFAULT_VCS_STATE } from '../../product/vcs/types';

export function applyAutoCinematicDirector(
  prev: AppState,
  viewportFormat: ViewportFormat,
  variationCount: 5 | 10 | 20 | 50 = 10
): AppState {
  let next: AppState = {
    ...prev,
    ...applyAsrpVisualStyle(prev, 'anime_cinematic'),
    vcs: {
      ...(prev.vcs ?? DEFAULT_VCS_STATE),
      enabled: true,
      handheld: false,
      safeCamera: true,
      focusTarget: 'face',
    },
    cinematic: prev.cinematic
      ? { ...prev.cinematic, enabled: true, handheld: false }
      : prev.cinematic,
    visualFx: {
      ...prev.visualFx,
      ...(applyAsrpVisualStyle(prev, 'anime_cinematic').visualFx ?? {}),
      dofEnabled: true,
      bloomEnabled: true,
      vignetteEnabled: true,
      colorGrade: 'cinematic',
    },
  };

  next = runAutoDirector(next, variationCount, viewportFormat);
  return next;
}
