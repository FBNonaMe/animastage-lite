import { lazy, Suspense, useEffect, useState } from 'react';
import LandingPage from './pages/LandingPage.tsx';
import { isNativeApp } from './utils/platform';

const App = lazy(() => import('./App.tsx'));
const ViewerPage = lazy(() => import('./pages/ViewerPage.tsx'));
const MmdAndroidLandingPage = lazy(() => import('./pages/MmdAndroidLandingPage.tsx'));
const MmdBrowserLandingPage = lazy(() => import('./pages/MmdBrowserLandingPage.tsx'));
const MmdOnlineLandingPage = lazy(() => import('./pages/MmdOnlineLandingPage.tsx'));
const AboutPage = lazy(() => import('./pages/AboutPage.tsx'));
const RoadmapPage = lazy(() => import('./pages/RoadmapPage.tsx'));

function normalizePath(pathname: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  if (base && pathname.startsWith(base)) {
    return pathname.slice(base.length) || '/';
  }
  return pathname || '/';
}

function isAppPath(path: string): boolean {
  return path === '/app' || path.startsWith('/app/');
}

function isViewerPath(path: string): boolean {
  return path === '/viewer' || path.startsWith('/viewer/');
}

function StudioBootScreen() {
  return (
    <div className="min-h-screen bg-[#0a0b0e] text-zinc-300 flex flex-col items-center justify-center gap-3 font-sans">
      <div className="w-10 h-10 rounded-full border-2 border-cyan-500/30 border-t-cyan-400 animate-spin" />
      <p className="text-sm font-semibold">Loading AnimaStage…</p>
    </div>
  );
}

function resolveInitialPath(): string {
  const normalized = normalizePath(window.location.pathname);
  if (isNativeApp() && normalized === '/') return '/app';
  return normalized;
}

function useStudioViewportLock(path: string) {
  useEffect(() => {
    const lock = isAppPath(path) || isViewerPath(path);
    document.documentElement.classList.toggle('studio-viewport-lock', lock);
    return () => document.documentElement.classList.remove('studio-viewport-lock');
  }, [path]);
}

export default function RootRouter() {
  const [path, setPath] = useState(resolveInitialPath);

  useStudioViewportLock(path);

  useEffect(() => {
    const onPopState = () => setPath(normalizePath(window.location.pathname));
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigateTo = (next: string) => {
    const q = next.indexOf('?');
    const pathname = q >= 0 ? next.slice(0, q) : next;
    const search = q >= 0 ? next.slice(q) : '';
    const target = pathname.startsWith('/') ? pathname : `/${pathname}`;
    window.history.pushState({}, '', `${target}${search}`);
    setPath(normalizePath(target));
  };

  const studioNav = {
    onStart: () => navigateTo('/app'),
    onStartDemo: () => navigateTo('/app?demo=party-dance'),
    onStartCreator: () => navigateTo('/app?flow=creator'),
    onStartDemoId: (id: string) => navigateTo(`/app?demo=${encodeURIComponent(id)}`),
  };

  if (isViewerPath(path)) {
    return (
      <Suspense fallback={<StudioBootScreen />}>
        <ViewerPage />
      </Suspense>
    );
  }

  if (isAppPath(path)) {
    return (
      <Suspense fallback={<StudioBootScreen />}>
        <App mode="editor" />
      </Suspense>
    );
  }

  if (path === '/mmd-android' || path.startsWith('/mmd-android/')) {
    return (
      <Suspense fallback={<StudioBootScreen />}>
        <MmdAndroidLandingPage {...studioNav} />
      </Suspense>
    );
  }

  if (path === '/mmd-browser' || path.startsWith('/mmd-browser/')) {
    return (
      <Suspense fallback={<StudioBootScreen />}>
        <MmdBrowserLandingPage {...studioNav} />
      </Suspense>
    );
  }

  if (path === '/mmd-online' || path.startsWith('/mmd-online/')) {
    return (
      <Suspense fallback={<StudioBootScreen />}>
        <MmdOnlineLandingPage {...studioNav} />
      </Suspense>
    );
  }

  if (path === '/about' || path.startsWith('/about/')) {
    return (
      <Suspense fallback={<StudioBootScreen />}>
        <AboutPage onStart={studioNav.onStart} />
      </Suspense>
    );
  }

  if (path === '/roadmap' || path.startsWith('/roadmap/')) {
    return (
      <Suspense fallback={<StudioBootScreen />}>
        <RoadmapPage
          onStart={studioNav.onStart}
          onStartDemo={studioNav.onStartDemo}
          onStartDemoGallery={() => navigateTo('/app?demo=gallery')}
        />
      </Suspense>
    );
  }

  return (
    <LandingPage
      onStart={studioNav.onStart}
      onStartDemo={studioNav.onStartDemo}
      onStartCreator={studioNav.onStartCreator}
      onStartDemoGallery={() => navigateTo('/app?demo=gallery')}
      onStartDemoId={studioNav.onStartDemoId}
    />
  );
}
