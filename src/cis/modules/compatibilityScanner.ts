import * as THREE from 'three';
import type { CharacterModelFormat } from '../../types';
import type { CisCompatibilityReport, CisSourceFormat } from '../types';

export function resolveSourceFormat(
  mesh: THREE.SkinnedMesh,
  modelFormat?: CharacterModelFormat,
  modelFileName?: string
): CisSourceFormat {
  const mmd = mesh.geometry.userData.MMD as { format?: string } | undefined;
  if (mmd?.format === 'pmd') return 'pmd';
  if (mmd?.format === 'pmx') return 'pmx';

  const hint = (modelFileName ?? '').toLowerCase();
  if (hint.endsWith('.vrm') || hint.includes('.vrm')) return 'vrm';
  if (hint.endsWith('.fbx')) return 'fbx';
  if (hint.endsWith('.glb') || hint.endsWith('.gltf')) return 'gltf';
  if (hint.endsWith('.obj')) return 'obj';
  if (hint.endsWith('.usd') || hint.endsWith('.usdz')) return 'usd';

  if (modelFormat === 'fbx') return 'fbx';
  if (modelFormat === 'gltf') return 'gltf';
  if (modelFormat === 'obj') return 'obj';
  if (modelFormat === 'mmd') return 'pmx';

  return 'unknown';
}

export function scanCompatibility(
  mesh: THREE.SkinnedMesh,
  modelFormat?: CharacterModelFormat,
  modelFileName?: string,
  missingTextures: string[] = []
): CisCompatibilityReport {
  const mmd = mesh.geometry.userData.MMD as
    | {
        format?: string;
        bones?: unknown[];
        morphs?: unknown[];
        rigidBodies?: unknown[];
      }
    | undefined;

  const sourceFormat = resolveSourceFormat(mesh, modelFormat, modelFileName);
  const missingData: string[] = [];
  const brokenReferences: string[] = [...missingTextures];
  const unsupportedFeatures: string[] = [];

  if (!mesh.skeleton?.bones?.length) missingData.push('Skeleton');
  if (sourceFormat === 'vrm') unsupportedFeatures.push('VRM runtime (planned)');
  if (sourceFormat === 'usd') unsupportedFeatures.push('USD runtime (planned)');

  if (mmd) {
    if (!mmd.bones?.length) missingData.push('MMD bone table');
    if (!mmd.morphs?.length) missingData.push('MMD morph table');
  }

  return {
    sourceFormat,
    pmxVersion: mmd?.format === 'pmx' ? '2.0' : null,
    pmdVersion: mmd?.format === 'pmd',
    vrmReady: sourceFormat === 'vrm' || /\.vrm/i.test(modelFileName ?? ''),
    gltfReady: sourceFormat === 'gltf' || sourceFormat === 'fbx' || sourceFormat === 'obj',
    missingData,
    brokenReferences,
    unsupportedFeatures,
  };
}
