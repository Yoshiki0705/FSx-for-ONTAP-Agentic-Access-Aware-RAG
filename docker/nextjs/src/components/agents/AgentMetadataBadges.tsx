'use client';

import { User, Lock, ShieldCheck, Globe, Users, KeyRound, Ban, Library, Eye, Clock, Link, Plug, Wrench, type LucideIcon } from 'lucide-react';
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

const TRUST_LEVEL_ICONS: Record<TrustLevel, LucideIcon> = {
  'user-safe': User,
  'team-safe': Lock,
  'admin-only': ShieldCheck,
};

// ===== Data Boundary badge styles =====

const DATA_BOUNDARY_STYLES: Record<DataBoundary, string> = {
  'public': 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  'team-scoped': 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  'user-scoped': 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
  'sensitive-admin': 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
};

const DATA_BOUNDARY_ICONS: Record<DataBoundary, LucideIcon> = {
  'public': Globe,
  'team-scoped': Users,
  'user-scoped': KeyRound,
  'sensitive-admin': Ban,
};

// ===== Tool Profile icons =====

const TOOL_PROFILE_ICONS: Record<string, LucideIcon> = {
  'kb-retrieve': Library,
  'vision-analyze': Eye,
  'access-check': KeyRound,
  'schedule-run': Clock,
  'share-agent': Link,
};

function getToolProfileIcon(profile: string): LucideIcon {
  if (profile.startsWith('external-mcp:')) return Plug;
  return TOOL_PROFILE_ICONS[profile] ?? Wrench;
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
        toolProfiles.map((profile) => {
          const ProfileIcon = getToolProfileIcon(profile);
          return (
          <span
            key={profile}
            role="listitem"
            aria-label={`Tool profile: ${profile}`}
            className={`inline-flex items-center gap-0.5 rounded ${badgeSize} font-medium bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300`}
          >
            <ProfileIcon className="w-3 h-3" aria-hidden="true" />
            {getToolProfileLabel(profile)}
          </span>
          );
        })}

      {/* Trust Level badge */}
      {hasTrustLevel && (() => {
        const TrustIcon = TRUST_LEVEL_ICONS[trustLevel];
        return (
        <span
          role="listitem"
          aria-label={`Trust level: ${trustLevel}`}
          className={`inline-flex items-center gap-0.5 rounded ${badgeSize} font-medium ${TRUST_LEVEL_STYLES[trustLevel]}`}
        >
          <TrustIcon className="w-3 h-3" aria-hidden="true" />
          {trustLevel}
        </span>
        );
      })()}

      {/* Data Boundary badge */}
      {hasDataBoundary && (() => {
        const BoundaryIcon = DATA_BOUNDARY_ICONS[dataBoundary];
        return (
        <span
          role="listitem"
          aria-label={`Data boundary: ${dataBoundary}`}
          className={`inline-flex items-center gap-0.5 rounded ${badgeSize} font-medium ${DATA_BOUNDARY_STYLES[dataBoundary]}`}
        >
          <BoundaryIcon className="w-3 h-3" aria-hidden="true" />
          {dataBoundary}
        </span>
        );
      })()}
    </div>
  );
}
