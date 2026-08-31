import './utils/consoleFilter';
import './utils/mmdMaterialPatch';
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { initAmmo } from './utils/ammoLoader';
import { installAmmoCrashGuard, markAmmoPhysicsBroken } from './utils/mmdCharacterPhysics';

installAmmoCrashGuard();

// Defer Ammo WASM off the critical path — first paint / router hydrate first.
const scheduleAmmo =
  typeof requestIdleCallback === 'function'
    ? (cb: () => void) => requestIdleCallback(() => cb(), { timeout: 2500 })
    : (cb: () => void) => window.setTimeout(cb, 1);

scheduleAmmo(() => {
  void initAmmo().catch((error) => {
    const msg = String((error as Error)?.message ?? error);
    if (/out of memory|\bOOM\b|Aborted/i.test(msg)) {
      markAmmoPhysicsBroken(error);
    }
    console.warn('[MMD] Ammo preload failed — physics will stay disabled:', error);
  });
});
import './utils/mmdCharsetPatch';
import { bootstrapNativeRoute } from './native/nativeStudioBootstrap';
import { initNativeShell } from './native/initNativeShell';
import RootRouter from './RootRouter.tsx';
import RootErrorBoundary from './RootErrorBoundary.tsx';
import './index.css';

bootstrapNativeRoute();
void initNativeShell();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RootErrorBoundary>
      <RootRouter />
    </RootErrorBoundary>
  </StrictMode>,
);
