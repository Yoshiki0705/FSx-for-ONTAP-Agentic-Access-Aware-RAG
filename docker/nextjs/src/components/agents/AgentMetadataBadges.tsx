'use client';

import type { ToolProfile, TrustLevel, DataBoundary } from '@/types/multi-agent';

/**
 * AgentMetadataBadges — Tool Profile / Trust Level / Data Boundary バッジ表示
 *
 * AgentCard やその他のコンポーネントで再利用可能なバッジコンポーネント。
 * デザインドキュメントの色分け仕様に準拠:
 *   - Tool Profile: 紫系 (bg-purple-100 text-purple-700)
 *   - Trust Level: user-safe=緑, team-safe=青, admin-only=赤
 *   - Data Boundary: public=グレー, team-scoped=青, user-scoped=黄, sensitive-admin=赤
 *
 * Validates: Requirements 6.7
 */

export interface AgentMetadataBadgesProps {
  toolProfiles?: ToolProfile[];
  trustLevel?: TrustLevel;
  dataBoundary?: DataBoundary;
  /** コンパクト表示（小さいバッジ） */
  compact?: boolean;
}

// ===== Trust Level badge styles =====

const TRUST_LEVEL_STYLES: Record<TrustLevel, string> = {
  'user-safe': 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  'team-safe': 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  'admin-only': 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
};

const TRUST_LEVEL_ICONS: Record<TrustLevel, string> = {
  'user-safe': '👤',
  'team-safe': '🔒',
  'admin-only': '🛡️',
};

// ===== Data Boundary badge styles =====

const DATA_BOUNDARY_STYLES: Record<DataBoundary, string> = {
  'public': 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  'team-scoped': 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  'user-scoped': 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
  'sensitive-admin': 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
};

const DATA_BOUNDARY_ICONS: Record<DataBoundary, string> = {
  'public': '🌐',
  'team-scoped': '👥',
  'user-scoped': '🔑',
  'sensitive-admin': '⛔',
};

// ===== Tool Profile icons =====

const TOOL_PROFILE_ICONS: Record<string, string> = {
  'kb-retrieve': '📚',
  'vision-analyze': '👁️',
  'access-check': '🔑',
  'schedule-run': '⏰',
  'share-agent': '🔗',
};

function getToolProfileIcon(profile: string): string {
  if (profile.startsWith('external-mcp:')) return '🔌';
  return TOOL_PROFILE_ICONS[profile] ?? '🛠️';
}

function getToolProfileLabel(profile: string): string {
  if (profile.startsWith('external-mcp:')) {
    return profile.replace('external-mcp:', 'mcp:');
  }
  return profile;
}

export function AgentMetadataBadges({
  toolProfiles,
  trustLevel,
  dataBoundary,
  compact = false,
}: AgentMetadataBadgesProps) {
  const hasToolProfiles = toolProfiles && toolProfiles.length > 0;
  const hasTrustLevel = !!trustLevel;
  const hasDataBoundary = !!dataBoundary;

  if (!hasToolProfiles && !hasTrustLevel && !hasDataBoundary) {
    return null;
  }

  const badgeSize = compact ? 'text-[10px] px-1.5 py-0' : 'text-xs px-2 py-0.5';

  return (
    <div className="flex items-center gap-1.5 flex-wrap" role="list" aria-label="Agent metadata">
      {/* Tool Profile badges — purple */}
      {hasToolProfiles &&
        toolProfiles.map((profile) => (
          <span
            key={profile}
            role="listitem"
            aria-label={`Tool profile: ${profile}`}
            className={`inline-flex items-center gap-0.5 rounded ${badgeSize} font-medium bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300`}
          >
            <span aria-hidden="true">{getToolProfileIcon(profile)}</span>
            {getToolProfileLabel(profile)}
          </span>
        ))}

      {/* Trust Level badge */}
      {hasTrustLevel && (
        <span
          role="listitem"
          aria-label={`Trust level: ${trustLevel}`}
          className={`inline-flex items-center gap-0.5 rounded ${badgeSize} font-medium ${TRUST_LEVEL_STYLES[trustLevel]}`}
        >
          <span aria-hidden="true">{TRUST_LEVEL_ICONS[trustLevel]}</span>
          {trustLevel}
        </span>
      )}

      {/* Data Boundary badge */}
      {hasDataBoundary && (
        <span
          role="listitem"
          aria-label={`Data boundary: ${dataBoundary}`}
          className={`inline-flex items-center gap-0.5 rounded ${badgeSize} font-medium ${DATA_BOUNDARY_STYLES[dataBoundary]}`}
        >
          <span aria-hidden="true">{DATA_BOUNDARY_ICONS[dataBoundary]}</span>
          {dataBoundary}
        </span>
      )}
    </div>
  );
}
