type AmmoFactory = (options?: {
  locateFile?: (path: string, prefix?: string) => string;
}) => Promise<AmmoLib>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AmmoLib = any;

declare global {
  interface Window {
    Ammo?: AmmoFactory | AmmoLib;
  }
  // three-stdlib MMDPhysics references bare global `Ammo`
  // eslint-disable-next-line no-var
  var Ammo: AmmoLib | undefined;
}

/** Served from /public/ammo — no external CDN required. */
const AMMO_SCRIPT_URL = '/ammo/ammo.wasm.js';
const AMMO_WASM_URL = '/ammo/ammo.wasm.wasm';

let ammoInitPromise: Promise<void> | null = null;
/** Set once after WASM loads successfully — never re-run allocation checks. */
let ammoReady = false;

function publishAmmoLib(ammoLib: AmmoLib): void {
  window.Ammo = ammoLib;
  globalThis.Ammo = ammoLib;
}

function hasAmmoBindings(ammo: AmmoLib): boolean {
  return Boolean(
    ammo &&
      typeof ammo === 'object' &&
      typeof ammo.btVector3 === 'function' &&
      typeof ammo.btDiscreteDynamicsWorld === 'function'
  );
}

/** One lightweight allocation during bootstrap only. */
function verifyAmmoOnce(ammo: AmmoLib): boolean {
  if (!hasAmmoBindings(ammo)) return false;
  try {
    const v = new ammo.btVector3(0, 0, 0);
    v.destroy?.();
    return true;
  } catch {
    return false;
  }
}

export function isAmmoInitialized(): boolean {
  return ammoReady;
}

export function initAmmo(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Ammo.js requires a browser environment'));
  }

  if (isAmmoInitialized()) {
    return Promise.resolve();
  }

  if (!ammoInitPromise) {
    ammoInitPromise = bootstrapAmmo().catch((error) => {
      ammoInitPromise = null;
      throw error;
    });
  }

  return ammoInitPromise;
}

async function bootstrapAmmo(): Promise<void> {
  if (ammoReady) return;

  const existing = window.Ammo;

  if (existing && typeof existing === 'object' && verifyAmmoOnce(existing)) {
    publishAmmoLib(existing);
    ammoReady = true;
    return;
  }

  if (typeof existing === 'function') {
    await initializeAmmoFactory(existing as AmmoFactory);
    return;
  }

  await loadAmmoScript(AMMO_SCRIPT_URL);
  const factory = window.Ammo;

  if (typeof factory === 'function') {
    await initializeAmmoFactory(factory as AmmoFactory);
    return;
  }

  if (factory && typeof factory === 'object' && 'ready' in factory) {
    const lib = await (factory as AmmoLib & { ready: Promise<AmmoLib> }).ready;
    if (!verifyAmmoOnce(lib)) {
      throw new Error('Ammo.js loaded but WASM bindings failed verification');
    }
    publishAmmoLib(lib);
    ammoReady = true;
    return;
  }

  throw new Error('Ammo factory was not registered on window after script load');
}

function loadAmmoScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      if (typeof window.Ammo === 'function' || isAmmoInitialized()) {
        resolve();
        return;
      }
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)));
      return;
    }

    const script = document.createElement('script');
    script.async = true;
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () =>
      reject(
        new Error(
          `Failed to load Ammo.js from ${src}. Ensure public/ammo/ammo.wasm.js and ammo.wasm.wasm exist.`
        )
      );
    document.head.appendChild(script);
  });
}

async function initializeAmmoFactory(factory: AmmoFactory): Promise<void> {
  try {
    const ammoLib = await factory({
      locateFile: (path) => {
        if (path.endsWith('.wasm')) {
          return AMMO_WASM_URL;
        }
        return path;
      },
    });

    if (!verifyAmmoOnce(ammoLib)) {
      throw new Error(
        `Ammo.js WASM failed to initialize. Check that ${AMMO_WASM_URL} is reachable.`
      );
    }

    publishAmmoLib(ammoLib);
    ammoReady = true;
  } catch (err) {
    const msg = String((err as Error)?.message ?? err);
    if (/out of memory|\bOOM\b|Aborted/i.test(msg)) {
      const { markAmmoPhysicsBroken } = await import('./mmdCharacterPhysics');
      markAmmoPhysicsBroken(err);
    }
    throw err;
  }
}
