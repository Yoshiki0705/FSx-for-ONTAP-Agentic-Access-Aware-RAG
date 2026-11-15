'use client';
export const dynamic = 'force-dynamic';
import { useLocale } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { NavigationBar } from '@/components/agents/NavigationBar';
import { ToolsWorkspace } from '@/components/tools/ToolsWorkspace';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import type { Locale } from '@/i18n/config';

export default function ToolsPage() {
  const locale = useLocale();
  const searchParams = useSearchParams();
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 sm:p-6">
      <div className="flex items-center justify-between mb-2">
        <NavigationBar locale={locale} currentPage="tools" />
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <LanguageSwitcher currentLocale={locale as Locale} />
        </div>
      </div>
      <ToolsWorkspace initialTab={searchParams.get('tab') || undefined} />
    </div>
  );
}
