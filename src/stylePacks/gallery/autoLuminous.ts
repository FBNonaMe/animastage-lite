import * as THREE from 'three';
import type { AutoLuminousLevel } from './types';

export type MaterialKind =
  | 'skin'
  | 'eyes'
  | 'hair'
  | 'metal'
  | 'glass'
  | 'leather'
  | 'fabric'
  | 'plastic'
  | 'weapon'
  | 'accessory'
  | 'magic'
  | 'default';

const GLOW_KINDS = new Set<MaterialKind>(['eyes', 'hair', 'accessory', 'magic', 'glass', 'weapon']);

export function classifyMaterialName(name: string): MaterialKind {
  const n = name.toLowerCase();
  if (/目|eye|瞳|まぶた|睫毛|highlight/i.test(n)) return 'eyes';
  if (/髪|hair|前髪|twintail/i.test(n)) return 'hair';
  if (/肌|skin|顔|face|体|body|肌/i.test(n)) return 'skin';
  if (/ガラス|glass|lens|透明/i.test(n)) return 'glass';
  if (/金属|metal|zip|バックル|釦|ring|jewel|gold|silver/i.test(n)) return 'metal';
  if (/革|leather|belt/i.test(n)) return 'leather';
  if (/服|skirt|cloth|衣|pants|靴|shoe|sock|tie|リボン|dress/i.test(n)) return 'fabric';
  if (/武器|weapon|sword|gun|blade|刀|剣/i.test(n)) return 'weapon';
  if (/accessory|acc|リボン|帽|hat|ribbon|bow|ear|耳|ネック|choker/i.test(n)) return 'accessory';
  if (/magic|魔|光|glow|led|neon|energy|水晶|crystal|宝石/i.test(n)) return 'magic';
  if (/plastic|pvc/i.test(n)) return 'plastic';
  return 'default';
}

function glowStrengthForLevel(level: AutoLuminousLevel, kind: MaterialKind): number {
  if (level === 'off') return 0;
  if (!GLOW_KINDS.has(kind) && kind !== 'magic') return 0;

  const base =
    level === 'low'
      ? 0.12
      : level === 'medium'
        ? 0.28
        : level === 'high'
          ? 0.48
          : kind === 'eyes'
            ? 0.35
            : kind === 'magic' || /neon|led|光/i.test(kind)
              ? 0.42
              : 0.22;

  if (kind === 'eyes') return base * 1.15;
  if (kind === 'magic') return base * 1.25;
  return base;
}

/** Apply emissive boost for Auto Luminous — works on toon (fidelity) and standard (PBR). */
export function applyAutoLuminous(root: THREE.Object3D, level: AutoLuminousLevel): void {
  if (level === 'off') return;

  root.traverse((child) => {
    if (!(child as THREE.Mesh).isMesh) return;
    const mesh = child as THREE.Mesh;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of mats) {
      if (
        !(mat instanceof THREE.MeshStandardMaterial) &&
        !(mat instanceof THREE.MeshToonMaterial)
      ) {
        continue;
      }
      const kind = classifyMaterialName(mat.name || mesh.name);
      const strength = glowStrengthForLevel(level, kind);
      if (strength <= 0) continue;

      if (!mat.emissive) mat.emissive = new THREE.Color(0x000000);
      const base =
        mat instanceof THREE.MeshStandardMaterial || mat instanceof THREE.MeshToonMaterial
          ? mat.color.clone()
          : new THREE.Color(0xffffff);
      mat.emissive.copy(base).multiplyScalar(strength);
      mat.emissiveIntensity = 0.85 + strength;
    }
  });
}

export function materialKindLabel(kind: MaterialKind): string {
  return kind.charAt(0).toUpperCase() + kind.slice(1);
}
