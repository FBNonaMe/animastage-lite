/**
 * Procedural CanvasTextures for Ashfall City — no external image assets.
 * Anime / semi-real abandoned-city look, unique to AnimaStage.
 */
import * as THREE from 'three';
import type { AshfallQualityId } from './types';

export interface AshfallTexturePack {
  asphalt: THREE.CanvasTexture;
  asphaltRough: THREE.CanvasTexture;
  concrete: THREE.CanvasTexture;
  facade: THREE.CanvasTexture;
  facadeEmissive: THREE.CanvasTexture;
  metal: THREE.CanvasTexture;
  road: THREE.CanvasTexture;
  park: THREE.CanvasTexture;
  water: THREE.CanvasTexture;
  billboard: THREE.CanvasTexture;
  dispose: () => void;
}

function sizeForQuality(quality: AshfallQualityId): number {
  if (quality === 'lite') return 128;
  if (quality === 'high') return 512;
  return 256;
}

function canvas(size: number): { c: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d', { willReadFrequently: false })!;
  return { c, ctx };
}

function noise(ctx: CanvasRenderingContext2D, size: number, alpha: number, seed = 1): void {
  const img = ctx.createImageData(size, size);
  const d = img.data;
  let s = seed >>> 0;
  for (let i = 0; i < d.length; i += 4) {
    s = (Math.imul(s ^ (s >>> 15), 1 | s) + 0x6d2b79f5) >>> 0;
    const n = s & 255;
    d[i] = n;
    d[i + 1] = n;
    d[i + 2] = n;
    d[i + 3] = Math.floor(alpha * 255);
  }
  ctx.putImageData(img, 0, 0);
}

function makeTex(
  c: HTMLCanvasElement,
  opts?: { wrap?: boolean; repeat?: number; colorSpace?: boolean }
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = opts?.colorSpace === false ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  if (opts?.wrap !== false) {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    const r = opts?.repeat ?? 1;
    tex.repeat.set(r, r);
  }
  return tex;
}

function paintAsphalt(size: number): { map: THREE.CanvasTexture; rough: THREE.CanvasTexture } {
  const { c, ctx } = canvas(size);
  ctx.fillStyle = '#2a2c30';
  ctx.fillRect(0, 0, size, size);
  // Tar patches
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = `rgba(${30 + (i % 20)},${32 + (i % 15)},${36},0.45)`;
    ctx.beginPath();
    ctx.ellipse(
      Math.random() * size,
      Math.random() * size,
      8 + Math.random() * 28,
      4 + Math.random() * 16,
      Math.random() * Math.PI,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }
  // Cracks
  ctx.strokeStyle = 'rgba(12,12,14,0.75)';
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 28; i++) {
    let x = Math.random() * size;
    let y = Math.random() * size;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let s = 0; s < 6; s++) {
      x += (Math.random() - 0.5) * 40;
      y += (Math.random() - 0.5) * 40;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.globalCompositeOperation = 'overlay';
  noise(ctx, size, 0.18, 11);
  ctx.globalCompositeOperation = 'source-over';

  const { c: rc, ctx: rctx } = canvas(size);
  rctx.fillStyle = '#c8c8c8';
  rctx.fillRect(0, 0, size, size);
  rctx.fillStyle = 'rgba(40,40,40,0.5)';
  for (let i = 0; i < 50; i++) {
    rctx.fillRect(Math.random() * size, Math.random() * size, 3 + Math.random() * 20, 2);
  }

  return {
    map: makeTex(c, { repeat: 8 }),
    rough: makeTex(rc, { repeat: 8, colorSpace: false }),
  };
}

function paintConcrete(size: number): THREE.CanvasTexture {
  const { c, ctx } = canvas(size);
  const g = ctx.createLinearGradient(0, 0, size, size);
  g.addColorStop(0, '#3a3d42');
  g.addColorStop(0.5, '#45484e');
  g.addColorStop(1, '#32353a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  // Tile seams
  ctx.strokeStyle = 'rgba(20,20,22,0.35)';
  ctx.lineWidth = 2;
  const step = size / 8;
  for (let i = 0; i <= 8; i++) {
    ctx.beginPath();
    ctx.moveTo(i * step, 0);
    ctx.lineTo(i * step, size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i * step);
    ctx.lineTo(size, i * step);
    ctx.stroke();
  }
  // Stains
  for (let i = 0; i < 20; i++) {
    ctx.fillStyle = `rgba(20,18,16,${0.08 + Math.random() * 0.15})`;
    ctx.beginPath();
    ctx.arc(Math.random() * size, Math.random() * size, 10 + Math.random() * 30, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'soft-light';
  noise(ctx, size, 0.22, 22);
  ctx.globalCompositeOperation = 'source-over';
  return makeTex(c, { repeat: 4 });
}

function paintFacade(size: number): { map: THREE.CanvasTexture; emissive: THREE.CanvasTexture } {
  const { c, ctx } = canvas(size);
  ctx.fillStyle = '#3e424a';
  ctx.fillRect(0, 0, size, size);

  // Vertical panels
  const cols = 6;
  const rows = 10;
  const cw = size / cols;
  const ch = size / rows;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const broken = Math.random() < 0.18;
      const dark = Math.random() < 0.35;
      const lit = !broken && !dark && Math.random() < 0.22;
      const pad = 3;
      ctx.fillStyle = broken
        ? '#1a1c20'
        : dark
          ? '#2a2e36'
          : lit
            ? '#5a6a78'
            : '#4a5058';
      ctx.fillRect(x * cw + pad, y * ch + pad, cw - pad * 2, ch - pad * 2);
      if (broken) {
        ctx.strokeStyle = 'rgba(80,70,60,0.5)';
        ctx.beginPath();
        ctx.moveTo(x * cw + pad, y * ch + pad);
        ctx.lineTo(x * cw + cw - pad, y * ch + ch - pad);
        ctx.stroke();
      }
      // Window mullion
      ctx.strokeStyle = 'rgba(15,15,18,0.55)';
      ctx.strokeRect(x * cw + pad, y * ch + pad, cw - pad * 2, ch - pad * 2);
    }
  }
  // Weather streaks
  ctx.fillStyle = 'rgba(20,18,16,0.12)';
  for (let i = 0; i < 30; i++) {
    const x = Math.random() * size;
    ctx.fillRect(x, 0, 1 + Math.random() * 2, size);
  }

  const { c: ec, ctx: ectx } = canvas(size);
  ectx.fillStyle = '#000';
  ectx.fillRect(0, 0, size, size);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (Math.random() > 0.2) continue;
      const hue = Math.random() < 0.5 ? '255,170,80' : '80,180,255';
      ectx.fillStyle = `rgba(${hue},0.85)`;
      ectx.fillRect(x * cw + 4, y * ch + 4, cw - 8, ch - 8);
    }
  }

  return {
    map: makeTex(c, { repeat: 2 }),
    emissive: makeTex(ec, { repeat: 2 }),
  };
}

function paintMetal(size: number): THREE.CanvasTexture {
  const { c, ctx } = canvas(size);
  const g = ctx.createLinearGradient(0, 0, size, size);
  g.addColorStop(0, '#3a3e44');
  g.addColorStop(0.4, '#4a4038');
  g.addColorStop(1, '#2e3238');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  // Rust blotches
  for (let i = 0; i < 35; i++) {
    ctx.fillStyle = `rgba(${120 + Math.random() * 60},${50 + Math.random() * 40},20,${0.15 + Math.random() * 0.35})`;
    ctx.beginPath();
    ctx.arc(Math.random() * size, Math.random() * size, 4 + Math.random() * 22, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'overlay';
  noise(ctx, size, 0.25, 33);
  ctx.globalCompositeOperation = 'source-over';
  return makeTex(c, { repeat: 2 });
}

function paintRoad(size: number): THREE.CanvasTexture {
  const { c, ctx } = canvas(size);
  ctx.fillStyle = '#1e2024';
  ctx.fillRect(0, 0, size, size);
  // Center dashed line
  ctx.fillStyle = '#6a5a40';
  const dashH = size / 12;
  for (let y = 0; y < size; y += dashH * 2) {
    ctx.fillRect(size * 0.46, y, size * 0.08, dashH);
  }
  // Edge wear
  ctx.fillStyle = 'rgba(90,80,60,0.15)';
  ctx.fillRect(0, 0, size * 0.08, size);
  ctx.fillRect(size * 0.92, 0, size * 0.08, size);
  ctx.globalCompositeOperation = 'soft-light';
  noise(ctx, size, 0.2, 44);
  ctx.globalCompositeOperation = 'source-over';
  return makeTex(c, { repeat: 6 });
}

function paintPark(size: number): THREE.CanvasTexture {
  const { c, ctx } = canvas(size);
  ctx.fillStyle = '#2a3828';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 80; i++) {
    ctx.fillStyle = `rgba(${40 + Math.random() * 50},${70 + Math.random() * 60},${30 + Math.random() * 30},0.4)`;
    ctx.beginPath();
    ctx.arc(Math.random() * size, Math.random() * size, 2 + Math.random() * 8, 0, Math.PI * 2);
    ctx.fill();
  }
  // Dead grass patches
  ctx.fillStyle = 'rgba(60,50,30,0.35)';
  for (let i = 0; i < 12; i++) {
    ctx.beginPath();
    ctx.ellipse(
      Math.random() * size,
      Math.random() * size,
      10 + Math.random() * 25,
      6 + Math.random() * 15,
      Math.random(),
      0,
      Math.PI * 2
    );
    ctx.fill();
  }
  return makeTex(c, { repeat: 3 });
}

function paintWater(size: number): THREE.CanvasTexture {
  const { c, ctx } = canvas(size);
  const g = ctx.createLinearGradient(0, 0, size, size);
  g.addColorStop(0, '#152028');
  g.addColorStop(0.5, '#1a2834');
  g.addColorStop(1, '#101820');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = 'rgba(80,110,130,0.25)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 16; i++) {
    ctx.beginPath();
    const y = (i / 16) * size;
    ctx.moveTo(0, y);
    for (let x = 0; x < size; x += 8) {
      ctx.lineTo(x, y + Math.sin(x * 0.08 + i) * 3);
    }
    ctx.stroke();
  }
  // Ash film
  ctx.fillStyle = 'rgba(180,170,150,0.08)';
  ctx.fillRect(0, 0, size, size);
  return makeTex(c, { repeat: 4 });
}

function paintBillboard(size: number): THREE.CanvasTexture {
  const { c, ctx } = canvas(size);
  const g = ctx.createLinearGradient(0, 0, size, size);
  g.addColorStop(0, '#1a1028');
  g.addColorStop(0.5, '#301848');
  g.addColorStop(1, '#102030');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  // Abstract holo glyphs — fictional, not real brands
  ctx.fillStyle = 'rgba(255,80,160,0.55)';
  ctx.fillRect(size * 0.1, size * 0.2, size * 0.35, size * 0.15);
  ctx.fillStyle = 'rgba(60,200,255,0.45)';
  ctx.beginPath();
  ctx.arc(size * 0.7, size * 0.55, size * 0.18, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 3;
  ctx.strokeRect(size * 0.08, size * 0.08, size * 0.84, size * 0.84);
  ctx.font = `bold ${Math.floor(size * 0.12)}px sans-serif`;
  ctx.fillStyle = 'rgba(255,220,180,0.5)';
  ctx.fillText('ASH', size * 0.12, size * 0.85);
  ctx.globalCompositeOperation = 'overlay';
  noise(ctx, size, 0.3, 55);
  ctx.globalCompositeOperation = 'source-over';
  // Scanlines
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  for (let y = 0; y < size; y += 4) ctx.fillRect(0, y, size, 1);
  return makeTex(c, { wrap: false });
}

/** Build / cache texture pack for a quality tier. */
export function createAshfallTexturePack(quality: AshfallQualityId): AshfallTexturePack {
  const size = sizeForQuality(quality);
  const asphalt = paintAsphalt(size);
  const facade = paintFacade(size);
  const pack: AshfallTexturePack = {
    asphalt: asphalt.map,
    asphaltRough: asphalt.rough,
    concrete: paintConcrete(size),
    facade: facade.map,
    facadeEmissive: facade.emissive,
    metal: paintMetal(size),
    road: paintRoad(size),
    park: paintPark(Math.max(128, size / 2)),
    water: paintWater(Math.max(128, size / 2)),
    billboard: paintBillboard(size),
    dispose: () => {
      pack.asphalt.dispose();
      pack.asphaltRough.dispose();
      pack.concrete.dispose();
      pack.facade.dispose();
      pack.facadeEmissive.dispose();
      pack.metal.dispose();
      pack.road.dispose();
      pack.park.dispose();
      pack.water.dispose();
      pack.billboard.dispose();
    },
  };
  return pack;
}
