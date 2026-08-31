import type { CisCapability, CharacterIntelligenceProfile } from '../types';

export function scanCapabilities(
  profile: Pick<
    CharacterIntelligenceProfile,
    'morphs' | 'physics' | 'health' | 'mesh' | 'compatibility'
  >
): CisCapability[] {
  const { morphs, physics, health, mesh, compatibility } = profile;

  return [
    { id: 'facial', label: 'Facial Expressions', supported: morphs.hasFacialExpressions },
    { id: 'eye_track', label: 'Eye Tracking', supported: morphs.hasEyeTracking },
    { id: 'lip_sync', label: 'Lip Sync', supported: morphs.hasLipSync },
    { id: 'hair_physics', label: 'Hair Physics', supported: physics.chains.some((c) => /hair|tail|pony/i.test(c.kind)) },
    { id: 'cloth_physics', label: 'Cloth Physics', supported: physics.chains.some((c) => /skirt|dress|cape|sleeve/i.test(c.kind)) },
    { id: 'accessories', label: 'Dynamic Accessories', supported: physics.chains.some((c) => c.kind === 'accessory' || c.kind === 'ribbon') },
    { id: 'auto_showcase', label: 'Auto Showcase', supported: health.overall >= 60 && mesh.triangleCount > 0 },
    { id: 'auto_video', label: 'Auto Video', supported: health.overall >= 55 },
    { id: 'auto_camera', label: 'Auto Camera', supported: health.skeleton >= 50 },
    { id: 'auto_photo', label: 'Auto Photo', supported: health.materials >= 50 },
    { id: 'motion_templates', label: 'Motion Templates', supported: compatibility.sourceFormat === 'pmx' || compatibility.sourceFormat === 'pmd' },
    { id: 'visual_styles', label: 'Visual Styles', supported: true },
  ];
}
