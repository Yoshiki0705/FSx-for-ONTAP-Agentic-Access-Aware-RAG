'use client';

import { useTranslations } from 'next-intl';

export interface InfoBannerProps {
  username: string;
  role: string;
  userDirectories: any | null;
  locale: string;
  isExpanded: boolean;
  onToggleExpand: () => void;
}

export function InfoBanner({
  username,
  role,
  userDirectories,
  locale,
  isExpanded,
  onToggleExpand,
}: InfoBannerProps) {
  const t = useTranslations('cards');

  const directoryCount =
    userDirectories && Array.isArray(userDirectories.accessibleDirectories)
      ? userDirectories.accessibleDirectories.length
      : 0;

  return (
    <div className="w-full mb-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 text-sm">
      {/* Collapsed bar */}
      <button
        type="button"
        onClick={onToggleExpand}
        className="w-full flex items-center justify-between px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors rounded-lg"
        aria-expanded={isExpanded}
        aria-label={isExpanded ? t('infoBanner.hideDetails') : t('infoBanner.showDetails')}
      >
        <div className="flex items-center gap-3 text-gray-700 dark:text-gray-300 min-w-0">
          <span className="font-medium truncate">{username}</span>
          <span className="text-gray-400 dark:text-gray-500">|</span>
          <span className="truncate">{role || 'User'}</span>
          <span className="text-gray-400 dark:text-gray-500">|</span>
          {userDirectories === null ? (
            <span className="inline-flex items-center gap-1 text-gray-400 dark:text-gray-500">
              <LoadingDots />
            </span>
          ) : (
            <span className="text-gray-600 dark:text-gray-400 truncate">
              📁 {t('infoBanner.directoriesCount', { count: directoryCount })}
            </span>
          )}
        </div>
        <ChevronIcon expanded={isExpanded} />
      </button>

      {/* Expanded details */}
      <div
        className={`overflow-hidden transition-all duration-200 ease-in-out ${
          isExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="px-4 pb-3 pt-1 border-t border-gray-200 dark:border-gray-700 space-y-2 text-xs text-gray-600 dark:text-gray-400">
          {userDirectories === null ? (
            <div className="flex items-center gap-2 py-1">
              <LoadingDots />
              <span>Loading...</span>
            </div>
          ) : (
            <>
              {/* SID / User info */}
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                <span>
                  <strong className="text-gray-700 dark:text-gray-300">{t('infoBanner.user')}:</strong> {username}
                </span>
                <span>
                  <strong className="text-gray-700 dark:text-gray-300">{t('infoBanner.role')}:</strong> {role || 'User'}
                </span>
                {userDirectories.sid && (
                  <span>
                    <strong className="text-gray-700 dark:text-gray-300">{t('infoBanner.sid')}:</strong> {userDirectories.sid}
                  </span>
                )}
              </div>

              {/* Directory lists */}
              <div>
                <strong className="text-gray-700 dark:text-gray-300">{t('infoBanner.directories')}:</strong>
                <DirectoryList
                  label="FSx"
                  items={userDirectories.accessibleDirectories}
                />
                <DirectoryList
                  label="RAG"
                  items={userDirectories.ragAccessibleDirectories}
                />
                <DirectoryList
                  label="Embedding"
                  items={userDirectories.embeddedDirectories}
                />
              </div>

              {/* Permissions */}
              {userDirectories.permissions && (
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  <strong className="text-gray-700 dark:text-gray-300">{t('infoBanner.permissions')}:</strong>
                  <PermissionBadge
                    label={t('infoBanner.read')}
                    allowed={!!userDirectories.permissions.read}
                    availableText={t('infoBanner.available')}
                    unavailableText={t('infoBanner.unavailable')}
                  />
                  <PermissionBadge
                    label={t('infoBanner.write')}
                    allowed={!!userDirectories.permissions.write}
                    availableText={t('infoBanner.available')}
                    unavailableText={t('infoBanner.unavailable')}
                  />
                  <PermissionBadge
                    label={t('infoBanner.execute')}
                    allowed={!!userDirectories.permissions.execute}
                    availableText={t('infoBanner.available')}
                    unavailableText={t('infoBanner.unavailable')}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---- Small helper sub-components ---- */

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      className={`w-4 h-4 text-gray-500 dark:text-gray-400 transition-transform duration-200 flex-shrink-0 ${
        expanded ? 'rotate-180' : ''
      }`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function DirectoryList({ label, items }: { label: string; items?: string[] }) {
  if (!Array.isArray(items) || items.length === 0) return null;
  return (
    <div className="ml-2 mt-0.5">
      <span className="text-gray-500 dark:text-gray-500">{label}:</span>{' '}
      {items.join(', ')}
    </div>
  );
}

function PermissionBadge({
  label,
  allowed,
  availableText,
  unavailableText,
}: {
  label: string;
  allowed: boolean;
  availableText: string;
  unavailableText: string;
}) {
  return (
    <span className="inline-flex items-center gap-1">
      {label}:{' '}
      {allowed ? (
        <span className="text-green-600 dark:text-green-400">✅ {availableText}</span>
      ) : (
        <span className="text-red-600 dark:text-red-400">❌ {unavailableText}</span>
      )}
    </span>
  );
}

function LoadingDots() {
  return (
    <span className="inline-flex gap-0.5" aria-label="Loading">
      <span className="w-1 h-1 rounded-full bg-gray-400 dark:bg-gray-500 animate-pulse" />
      <span className="w-1 h-1 rounded-full bg-gray-400 dark:bg-gray-500 animate-pulse [animation-delay:150ms]" />
      <span className="w-1 h-1 rounded-full bg-gray-400 dark:bg-gray-500 animate-pulse [animation-delay:300ms]" />
    </span>
  );
}
