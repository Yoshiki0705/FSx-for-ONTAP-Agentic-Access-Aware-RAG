'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';

interface NavigationBarProps {
  locale: string;
  currentPage: 'cards' | 'agents' | 'chat';
}

const NAV_ITEMS: { key: 'cards' | 'agents' | 'chat'; path: string }[] = [
  { key: 'cards', path: '/genai?mode=agent' },
  { key: 'agents', path: '/genai/agents' },
  { key: 'chat', path: '/genai' },
];

export function NavigationBar({ locale, currentPage }: NavigationBarProps) {
  const t = useTranslations('agentDirectory');

  return (
    <nav className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg mb-4" role="tablist" aria-label="Navigation">
      {NAV_ITEMS.map(item => {
        const isActive = item.key === currentPage;
        const href = `/${locale}${item.path}`;
        return (
          <Link
            key={item.key}
            href={href}
            role="tab"
            aria-selected={isActive}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              isActive
                ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            {t(`nav.${item.key}` as any)}
          </Link>
        );
      })}
    </nav>
  );
}
