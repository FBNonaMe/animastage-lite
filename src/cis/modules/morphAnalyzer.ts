import * as THREE from 'three';
import type { CisMorphCategory, CisMorphProfile } from '../types';

const MORPH_CATEGORIES: Array<{ id: string; label: string; patterns: RegExp[] }> = [
  { id: 'smile', label: 'Smile', patterns: [/smile|笑|にこ|ニコ|口角/i] },
  { id: 'blink', label: 'Blink', patterns: [/blink|まばた|瞬|目閉|eye.?close/i] },
  { id: 'lip_sync', label: 'Lip Sync', patterns: [/あ|い|う|え|お|a\b|i\b|u\b|e\b|o\b|mouth|口|唇|lip/i] },
  { id: 'eye_track', label: 'Eye Tracking', patterns: [/目|eye|瞳|視線|gaze|look/i] },
  { id: 'angry', label: 'Angry', patterns: [/angry|怒|むか|睨/i] },
  { id: 'sad', label: 'Sad', patterns: [/sad|悲|泣|涙|cry/i] },
  { id: 'happy', label: 'Happy', patterns: [/happy|喜|楽|嬉/i] },
  { id: 'surprised', label: 'Surprised', patterns: [/surprise|驚|びっくり|shock/i] },
];

function collectMorphNames(mesh: THREE.SkinnedMesh): string[] {
  const dict = mesh.morphTargetDictionary;
  if (dict) return Object.keys(dict);

  const mmd = mesh.geometry.userData.MMD as { morphs?: Array<{ name?: string }> } | undefined;
  return (mmd?.morphs ?? []).map((m) => m.name ?? '').filter(Boolean);
}

export function analyzeMorphs(mesh: THREE.SkinnedMesh): CisMorphProfile {
  const allNames = collectMorphNames(mesh);
  const matched = new Set<string>();

  const categories: CisMorphCategory[] = MORPH_CATEGORIES.map(({ id, label, patterns }) => {
    const morphNames = allNames.filter((name) => patterns.some((re) => re.test(name)));
    morphNames.forEach((n) => matched.add(n));
    return { id, label, morphNames, detected: morphNames.length > 0 };
  });

  const customMorphs = allNames.filter((n) => !matched.has(n));

  const hasLipSync = categories.find((c) => c.id === 'lip_sync')?.detected ?? false;
  const hasEyeTracking =
    (categories.find((c) => c.id === 'eye_track')?.detected ?? false) ||
    allNames.some((n) => /目[xy]|eye[xy]|pupil/i.test(n));
  const hasFacial =
    categories.some((c) => c.detected && c.id !== 'lip_sync' && c.id !== 'eye_track') ||
    hasLipSync;

  return {
    totalMorphs: allNames.length,
    categories,
    customMorphs: customMorphs.slice(0, 48),
    hasFacialExpressions: hasFacial,
    hasLipSync,
    hasEyeTracking,
  };
}
