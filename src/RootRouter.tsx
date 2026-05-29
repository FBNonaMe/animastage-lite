import { useEffect, useState } from 'react';
import { Analytics } from '@vercel/analytics/react';
import App from './App.tsx';
import LandingPage from './pages/LandingPage.tsx';

function normalizePath(pathname: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  if (base && pathname.startsWith(base)) {
    return pathname.slice(base.length) || '/';
  }
  return pathname || '/';
}

export default function RootRouter() {
  const [path, setPath] = useState(() => normalizePath(window.location.pathname));

  useEffect(() => {
    const onPopState = () => setPath(normalizePath(window.location.pathname));
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigateTo = (next: string) => {
    const target = next.startsWith('/') ? next : `/${next}`;
    window.history.pushState({}, '', target);
    setPath(normalizePath(target));
  };

  if (path === '/app' || path.startsWith('/app/')) {
    return (
      <>
        <App />
        <Analytics />
      </>
    );
  }

  return (
    <>
      <LandingPage onStart={() => navigateTo('/app')} />
      <Analytics />
    </>
  );
}
