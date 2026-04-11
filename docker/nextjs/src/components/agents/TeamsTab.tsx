'use client';

import { useState, useMemo } from 'react';
import { useAgentTeamStore } from '@/store/useAgentTeamStore';
import { AgentMetadataBadges } from './AgentMetadataBadges';
import type { AgentTeamConfig, RoutingMode, TrustLevel } from '@/types/multi-agent';

/**
 * TeamsTab — Agent Directory の Teams タブ
 *
 * Team カード一覧表示、検索・フィルタ・タグによる Team 発見 UI を提供する。
 * bedrock-engineer の Catalog-First Discovery パターンを踏襲。
 *
 * Validates: Requirements 9.5, 14.1, 14.2
 */

// ===== Tab definitions =====

export type DirectoryTab = 'agents' | 'teams' | 'shared' | 'schedules' | 'ab-test';

const DIRECTORY_TABS: { key: DirectoryTab; label: string; icon: string }[] = [
  { key: 'agents', label: 'Agents', icon: '🤖' },
  { key: 'teams', label: 'Teams', icon: '👥' },
  { key: 'shared', label: 'Shared', icon: '🔗' },
  { key: 'schedules', label: 'Sched.', icon: '⏰' },
  { key: 'ab-test', label: 'A/B', icon: '📊' },
];

// ===== Filter tags =====

const FILTER_TAGS = ['RAG', 'Permission', 'Analysis', 'Document', 'MCP'] as const;

// ===== Routing mode labels =====

const ROUTING_MODE_LABELS: Record<RoutingMode, string> = {
  supervisor_router: 'Auto Router',
  supervisor: 'Supervisor',
};

// ===== Props =====

export interface TeamsTabProps {
  activeTab: DirectoryTab;
  onTabChange: (tab: DirectoryTab) => void;
  onTeamSelect?: (team: AgentTeamConfig) => void;
  onUseInChat?: (teamId: string) => void;
  onCreateTeam?: () => void;
  onImport?: () => void;
}

export function TeamsTab({
  activeTab,
  onTabChange,
  onTeamSelect,
  onUseInChat,
  onCreateTeam,
  onImport,
}: TeamsTabProps) {
  const { teams } = useAgentTeamStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [trustFilter, setTrustFilter] = useState<TrustLevel | 'all'>('all');
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());

  // ===== Derived: filtered teams =====

  const filteredTeams = useMemo(() => {
    let result = teams;

    // Text search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (t) =>
          t.teamName.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q)
      );
    }

    // Trust level filter
    if (trustFilter !== 'all') {
      result = result.filter((t) =>
        t.collaborators.some((c) => c.trustLevel === trustFilter)
      );
    }

    // Tag filter (match any selected tag against team name/description)
    if (selectedTags.size > 0) {
      result = result.filter((t) => {
        const text = `${t.teamName} ${t.description}`.toLowerCase();
        return Array.from(selectedTags).some((tag) =>
          text.includes(tag.toLowerCase())
        );
      });
    }

    return result;
  }, [teams, searchQuery, trustFilter, selectedTags]);

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  };

  /** Derive the "highest" trust level across collaborators for display */
  const getTeamTrustLevel = (team: AgentTeamConfig): TrustLevel | undefined => {
    const levels = team.collaborators.map((c) => c.trustLevel);
    if (levels.includes('admin-only')) return 'admin-only';
    if (levels.includes('team-safe')) return 'team-safe';
    if (levels.includes('user-safe')) return 'user-safe';
    return undefined;
  };

  return (
    <div>
      {/* ===== Tab navigation ===== */}
      <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg mb-6">
        {DIRECTORY_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => onTabChange(tab.key)}
            className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
            aria-selected={activeTab === tab.key}
            role="tab"
          >
            <span aria-hidden="true" className="mr-1">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
        {onImport && (
          <button
            onClick={onImport}
            className="ml-auto px-3 py-2 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-blue-600 border border-gray-300 dark:border-gray-600 rounded-md"
          >
            📥 Import
          </button>
        )}
      </div>

      {/* ===== Search / Filter bar ===== */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
          <input
            type="text"
            placeholder="Search teams..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm"
          />
        </div>
        <select
          value={trustFilter}
          onChange={(e) => setTrustFilter(e.target.value as TrustLevel | 'all')}
          className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm"
          aria-label="Trust Level filter"
        >
          <option value="all">All Trust Levels</option>
          <option value="user-safe">user-safe</option>
          <option value="team-safe">team-safe</option>
          <option value="admin-only">admin-only</option>
        </select>
      </div>

      {/* ===== Tag chips ===== */}
      <div className="flex items-center gap-2 flex-wrap mb-6">
        {FILTER_TAGS.map((tag) => (
          <button
            key={tag}
            onClick={() => toggleTag(tag)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              selectedTags.has(tag)
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            {tag}
          </button>
        ))}
      </div>

      {/* ===== Team cards grid ===== */}
      {filteredTeams.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            {teams.length === 0
              ? 'No teams configured yet.'
              : 'No teams match your filters.'}
          </p>
          {onCreateTeam && teams.length === 0 && (
            <button
              onClick={onCreateTeam}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
            >
              + Create Team
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTeams.map((team) => {
            const teamTrust = getTeamTrustLevel(team);
            const allToolProfiles = Array.from(
              new Set(team.collaborators.flatMap((c) => c.toolProfiles))
            );

            return (
              <div
                key={team.teamId}
                className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:shadow-md hover:border-blue-300 dark:hover:border-blue-600 transition-all"
              >
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate mb-1">
                  {team.teamName}
                </h3>
                <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 mb-3">
                  {team.description}
                </p>

                {/* Metadata row */}
                <div className="flex flex-col gap-2 mb-3 text-xs text-gray-500 dark:text-gray-400">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span>🤖 {team.collaborators.length} Agents</span>
                    <span>📊 {ROUTING_MODE_LABELS[team.routingMode]}</span>
                  </div>
                </div>

                {/* Badges */}
                <div className="mb-3">
                  <AgentMetadataBadges
                    toolProfiles={allToolProfiles}
                    trustLevel={teamTrust}
                    compact
                  />
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  {onUseInChat && (
                    <button
                      onClick={() => onUseInChat(team.teamId)}
                      className="flex-1 px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700"
                    >
                      チャットで使用
                    </button>
                  )}
                  {onTeamSelect && (
                    <button
                      onClick={() => onTeamSelect(team)}
                      className="flex-1 px-3 py-1.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded text-xs font-medium hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      詳細を見る
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
