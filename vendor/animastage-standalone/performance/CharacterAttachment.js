function isObject3D(value) {
  return !!value?.isObject3D;
}

function isAncestor(candidate, object) {
  for (let node = object; node; node = node.parent) if (node === candidate) return true;
  return false;
}

export function attachmentMetadata(object) {
  return object?.userData?.characterAttachment || null;
}

export function isCharacterAttachment(object, characterMesh = null) {
  const metadata = attachmentMetadata(object);
  if (!metadata) return false;
  return !characterMesh || metadata.characterUuid === characterMesh.uuid;
}

/** Parent a scene prop to a character bone without changing its displayed
 * world transform. Metadata intentionally contains IDs only, never live
 * Object3D references, so project/session serialization remains safe. */
export function attachObjectToCharacterBone(object, bone, options = {}) {
  const characterMesh = options.characterMesh || null;
  if (!isObject3D(object) || !bone?.isBone) return { ok: false, reason: "invalid-object-or-bone" };
  if (object === bone || isAncestor(object, bone)) return { ok: false, reason: "attachment-cycle" };
  if (characterMesh && (object === characterMesh || isAncestor(object, characterMesh))) {
    return { ok: false, reason: "cannot-attach-character-root" };
  }

  object.updateWorldMatrix(true, true);
  bone.updateWorldMatrix(true, false);
  const previousParent = object.parent;
  bone.attach(object);
  object.updateWorldMatrix(true, true);

  const boneIndex = characterMesh?.skeleton?.bones?.indexOf?.(bone) ?? -1;
  const metadata = {
    version: 1,
    characterUuid: characterMesh?.uuid || null,
    characterId: options.characterId || null,
    sceneObjectId: options.sceneObjectId || object.userData?.sceneObjId || null,
    side: options.side === "right" ? "right" : "left",
    boneName: bone.name || null,
    boneIndex: Number.isInteger(boneIndex) ? boneIndex : -1,
    gripType: options.gripType || null,
    previousParentUuid: previousParent?.uuid || null,
    previousParentName: previousParent?.name || null,
  };
  object.userData.characterAttachment = metadata;
  return { ok: true, object, bone, previousParent, metadata };
}

/** Return an attachment to a normal scene parent while preserving the exact
 * displayed world transform. */
export function detachObjectFromCharacter(object, destinationParent) {
  if (!isObject3D(object) || !isObject3D(destinationParent)) return { ok: false, reason: "invalid-object-or-parent" };
  if (object === destinationParent || isAncestor(object, destinationParent)) return { ok: false, reason: "detach-cycle" };
  const metadata = attachmentMetadata(object);
  object.updateWorldMatrix(true, true);
  destinationParent.updateWorldMatrix(true, false);
  destinationParent.attach(object);
  object.updateWorldMatrix(true, true);
  delete object.userData.characterAttachment;
  return { ok: true, object, metadata };
}
