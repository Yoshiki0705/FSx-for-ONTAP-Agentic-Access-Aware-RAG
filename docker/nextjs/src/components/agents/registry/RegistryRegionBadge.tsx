'use client';

import { useRegistryStore } from '@/store/useRegistryStore';

/**
 * Registry 接続リージョン表示バッジ
 * Requirements: 11.4
 */
export function RegistryRegionBadge() {
  const registryRegion = useRegistryStore((s) => s.registryRegion);

  if (!registryRegion) return null;

  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
      <span className="w-1.5 h-1.5 rounded-full bg-blue-500" aria-hidden="true" />
      {registryRegion}
    </span>
  );
}
