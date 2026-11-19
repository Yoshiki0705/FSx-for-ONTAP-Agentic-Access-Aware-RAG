'use client';

import { useEffect } from 'react';

/**
 * Registers /sw.js so the app can be installed and shows an offline page.
 * The worker caches only build assets and icons (see public/sw.js), and it is
 * registered in production builds only, so `next dev` never serves stale files.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((error) => {
      console.warn('Service worker registration failed:', error);
    });
  }, []);
  return null;
}
