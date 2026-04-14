'use client';

import { useTranslations } from 'next-intl';
import { inferCategoryTag } from '@/utils/agentCategoryUtils';
import { getStatusStyle, isLoadingStatus } from '@/utils/agentStatusUtils';
import type { AgentSummary } from '@/hooks/useAgentsList';
import type { ToolProfile, TrustLevel, DataBoundary } from '@/types/multi-agent';
import { AgentMetadataBadges } from './AgentMetadataBadges';
import { PolicyBadge } from './PolicyBadge';

// Re-export for backward compatibility
export { getStatusStyle, isLoadingStatus } from '@/utils/agentStatusUtils';

interface AgentCardProps {
  agent: AgentSummary;
  categoryTag?: string;
  onClick: (agentId: string) => void;
  /** Multi-agent metadata — optional, displayed as badges below description */
  toolProfiles?: ToolProfile[];
  trustLevel?: TrustLevel;
  dataBoundary?: DataBoundary;
  /** Whether this agent has a policy applied */
  hasPolicy?: boolean;
}

export function AgentCard({ agent, categoryTag, onClick, toolProfiles, trustLevel, dataBoundary, hasPolicy }: AgentCardProps) {
  const t = useTranslations('agentDirectory');
  const category = categoryTag ?? inferCategoryTag(agent);
  const statusStyle = getStatusStyle(agent.agentStatus);
  const loading = isLoadingStatus(agent.agentStatus);

  return (
    <button
      type="button"
      onClick={() => onClick(agent.agentId)}
      className="w-full text-left p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:shadow-md hover:border-blue-300 dark:hover:border-blue-600 transition-all cursor-pointer"
      aria-label={agent.agentName}
    >
      <div className="flex items-start justify-between mb-2">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate pr-2">
          {agent.agentName}
        </h3>
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${statusStyle}`}>
          {loading && (
            <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          )}
          {t(`statusLabels.${agent.agentStatus}` as any) || agent.agentStatus}
        </span>
      </div>

      {agent.description && (
        <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-3">
          {agent.description}
        </p>
      )}

      {/* Multi-agent metadata badges (Tool Profile / Trust Level / Data Boundary) */}
      {(toolProfiles?.length || trustLevel || dataBoundary) && (
        <div className="mb-3">
          <AgentMetadataBadges
            toolProfiles={toolProfiles}
            trustLevel={trustLevel}
            dataBoundary={dataBoundary}
          />
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        {category && (
          <span className="px-2 py-0.5 rounded text-xs bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300">
            {category}
          </span>
        )}
        <PolicyBadge hasPolicy={!!hasPolicy} />
      </div>
    </button>
  );
}
