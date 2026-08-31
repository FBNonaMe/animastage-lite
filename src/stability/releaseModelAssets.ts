/**
 * Central asset release for removed models — blobs, file maps, VMD URLs.
 * Physics / GPU mesh dispose stays in MMDModelWrapper unmount paths.
 */
import type { MMDModel } from '../types';
import {
  collectRetainedBlobBases,
  revokeBlobUrl,
  revokeFileMapUrls,
} from '../utils/mmdFiles';

export function releaseModelBlobAssets(
  model: MMDModel,
  remainingModels: MMDModel[]
): void {
  const retain = collectRetainedBlobBases(remainingModels);
  revokeBlobUrl(model.blobUrl, retain);
  for (const url of model.vmdBlobUrls ?? []) revokeBlobUrl(url, retain);
  if (model.fileMap) revokeFileMapUrls(model.fileMap, retain);
}

export function releaseModelsBlobAssets(
  models: MMDModel[],
  remainingModels: MMDModel[] = []
): void {
  for (const m of models) releaseModelBlobAssets(m, remainingModels);
}
