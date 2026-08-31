import * as THREE from 'three';
import { DDSLoader } from 'three/addons/loaders/DDSLoader.js';
import { TGALoader } from 'three/addons/loaders/TGALoader.js';

const TGA_TYPES = new Set([1, 2, 3, 9, 10, 11]);

function detectImageFormat(
  bytes: Uint8Array
): 'bmp' | 'png' | 'jpeg' | 'tga' | 'dds' | 'unknown' {
  if (
    bytes.length >= 4 &&
    bytes[0] === 0x44 &&
    bytes[1] === 0x44 &&
    bytes[2] === 0x53 &&
    bytes[3] === 0x20
  ) {
    return 'dds';
  }
  if (bytes.length >= 2 && bytes[0] === 0x42 && bytes[1] === 0x4d) {
    return 'bmp';
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return 'png';
  }
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    return 'jpeg';
  }
  if (bytes.length >= 3 && TGA_TYPES.has(bytes[2]!)) {
    return 'tga';
  }
  return 'unknown';
}

function textureFromTgaBuffer(buffer: ArrayBuffer): THREE.DataTexture {
  const tgaLoader = new TGALoader();
  const texData = tgaLoader.parse(buffer) as unknown as {
    data: Uint8Array;
    width: number;
    height: number;
    flipY?: boolean;
    generateMipmaps?: boolean;
  };
  const texture = new THREE.DataTexture(
    texData.data,
    texData.width,
    texData.height,
    THREE.RGBAFormat
  );
  texture.type = THREE.UnsignedByteType;
  texture.flipY = texData.flipY ?? true;
  texture.generateMipmaps = texData.generateMipmaps ?? true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

function textureFromDdsBuffer(buffer: ArrayBuffer): THREE.CompressedTexture {
  const loader = new DDSLoader();
  const texData = loader.parse(buffer, true);
  const texture = new THREE.CompressedTexture(
    texData.mipmaps,
    texData.width,
    texData.height,
    texData.format,
    THREE.UnsignedByteType
  );
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

async function textureFromImageBuffer(buffer: ArrayBuffer, mime: string): Promise<THREE.Texture> {
  const blob = new Blob([buffer], { type: mime });
  try {
    const bitmap = await createImageBitmap(blob);
    const texture = new THREE.Texture(bitmap);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    return texture;
  } catch {
    return new Promise((resolve, reject) => {
      const objectUrl = URL.createObjectURL(blob);
      const loader = new THREE.TextureLoader();
      loader.load(
        objectUrl,
        (texture) => {
          URL.revokeObjectURL(objectUrl);
          texture.colorSpace = THREE.SRGBColorSpace;
          resolve(texture);
        },
        undefined,
        (error) => {
          URL.revokeObjectURL(objectUrl);
          reject(error);
        }
      );
    });
  }
}

async function textureFromBuffer(buffer: ArrayBuffer): Promise<THREE.Texture> {
  const bytes = new Uint8Array(buffer);
  const format = detectImageFormat(bytes);

  switch (format) {
    case 'dds':
      return textureFromDdsBuffer(buffer);
    case 'bmp':
      return textureFromImageBuffer(buffer, 'image/bmp');
    case 'png':
      return textureFromImageBuffer(buffer, 'image/png');
    case 'jpeg':
      return textureFromImageBuffer(buffer, 'image/jpeg');
    case 'tga':
      return textureFromTgaBuffer(buffer);
    default:
      return textureFromImageBuffer(buffer, 'application/octet-stream');
  }
}

function dataTextureToCanvas(source: THREE.DataTexture): HTMLCanvasElement {
  const width = source.image.width;
  const height = source.image.height;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return canvas;
  }
  const imageData = ctx.createImageData(width, height);
  imageData.data.set(source.image.data);
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

function applyLoadedTexture(target: THREE.Texture, loaded: THREE.Texture): void {
  if (loaded instanceof THREE.CompressedTexture) {
    target.image = loaded.image;
    target.mipmaps = loaded.mipmaps;
    target.format = loaded.format;
    target.colorSpace = THREE.SRGBColorSpace;
    target.generateMipmaps = loaded.generateMipmaps;
    target.minFilter = loaded.minFilter;
    target.magFilter = loaded.magFilter;
    target.wrapS = loaded.wrapS;
    target.wrapT = loaded.wrapT;
  } else if (loaded instanceof THREE.DataTexture) {
    target.image = dataTextureToCanvas(loaded);
    target.colorSpace = THREE.SRGBColorSpace;
    target.generateMipmaps = true;
    target.minFilter = THREE.LinearMipmapLinearFilter;
    target.magFilter = THREE.LinearFilter;
  } else {
    target.image = loaded.image;
    target.colorSpace = loaded.colorSpace;
    target.generateMipmaps = loaded.generateMipmaps;
    target.minFilter = loaded.minFilter;
    target.magFilter = loaded.magFilter;
  }
  target.needsUpdate = true;
  loaded.dispose();
}

/**
 * Loads MMD textures by sniffing file contents instead of trusting the URL extension.
 * PMX often references .tga while the dropped folder only contains .bmp/.png/.dds.
 *
 * Must return a Texture synchronously — MMDLoader assigns texture.readyCallbacks
 * on the return value before the async load completes.
 */
export class MMDFlexibleTextureLoader extends THREE.Loader {
  load(
    url: string,
    onLoad?: (texture: THREE.Texture) => void,
    onProgress?: (event: ProgressEvent<EventTarget>) => void,
    onError?: (error: unknown) => void
  ): THREE.Texture {
    const texture = new THREE.Texture();

    if (!url) {
      onError?.(new Error('MMDFlexibleTextureLoader: empty URL'));
      return texture;
    }

    const fileLoader = new THREE.FileLoader(this.manager);
    fileLoader.setResponseType('arraybuffer');
    fileLoader.load(
      url,
      (buffer) => {
        textureFromBuffer(buffer as ArrayBuffer)
          .then((loaded) => {
            applyLoadedTexture(texture, loaded);
            onLoad?.(texture);
          })
          .catch((error) => {
            onError?.(error);
          });
      },
      onProgress,
      onError
    );

    return texture;
  }
}

/** Async helper for texture repair / fallback loading outside MMDLoader. */
export function loadFlexibleTextureFromUrl(url: string): Promise<THREE.Texture | null> {
  return new Promise((resolve) => {
    const loader = new MMDFlexibleTextureLoader();
    loader.load(url, (tex) => resolve(tex), undefined, () => resolve(null));
  });
}
