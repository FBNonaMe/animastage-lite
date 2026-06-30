import { useEffect } from 'react';
import type { MMDModel } from '../../types';
import { syncMultiCharacterScenePerf } from '../../scene/multiCharacterPerf';

interface MultiCharacterPerfSyncProps {
  models: readonly MMDModel[];
  selectedObjectId: string | null | undefined;
}

/** Keeps multi-character governor floor and physics substep caps in sync with the scene. */
export default function MultiCharacterPerfSync({
  models,
  selectedObjectId,
}: MultiCharacterPerfSyncProps) {
  useEffect(() => {
    syncMultiCharacterScenePerf(models, selectedObjectId);
    return () => syncMultiCharacterScenePerf([], null);
  }, [models, selectedObjectId]);

  return null;
}
