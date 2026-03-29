'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { AgentDetail } from '@/types/agent-directory';

interface AgentDetailPanelProps {
  agent: AgentDetail;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onUseInChat: (agentId: string) => void;
  locale: string;
}

export function AgentDetailPanel({ agent, onClose, onEdit, onDelete, onUseInChat, locale }: AgentDetailPanelProps) {
  const t = useTranslations('agentDirectory');
  const [instructionExpanded, setInstructionExpanded] = useState(false);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{agent.agentName}</h2>
          {agent.description && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{agent.description}</p>
          )}
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" aria-label={t('close') || 'Close'}>
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>

      {/* Info Grid */}
      <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
        <div><span className="text-gray-500 dark:text-gray-400">{t('agentId')}</span><p className="font-mono text-gray-900 dark:text-gray-100">{agent.agentId}</p></div>
        <div><span className="text-gray-500 dark:text-gray-400">{t('status')}</span><p className="text-gray-900 dark:text-gray-100">{agent.agentStatus}</p></div>
        <div><span className="text-gray-500 dark:text-gray-400">{t('model')}</span><p className="text-gray-900 dark:text-gray-100">{agent.foundationModel || 'N/A'}</p></div>
        <div><span className="text-gray-500 dark:text-gray-400">{t('version')}</span><p className="text-gray-900 dark:text-gray-100">{agent.agentVersion || 'N/A'}</p></div>
        <div><span className="text-gray-500 dark:text-gray-400">{t('createdAt')}</span><p className="text-gray-900 dark:text-gray-100">{agent.createdAt ? new Date(agent.createdAt).toLocaleDateString(locale) : 'N/A'}</p></div>
        <div><span className="text-gray-500 dark:text-gray-400">{t('updatedAt')}</span><p className="text-gray-900 dark:text-gray-100">{agent.updatedAt ? new Date(agent.updatedAt).toLocaleDateString(locale) : 'N/A'}</p></div>
      </div>

      {/* System Prompt */}
      {agent.instruction && (
        <div className="mb-6">
          <button
            onClick={() => setInstructionExpanded(!instructionExpanded)}
            className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
          >
            <svg className={`w-4 h-4 transition-transform ${instructionExpanded ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            {t('systemPrompt')}
          </button>
          {instructionExpanded && (
            <pre className="text-sm bg-gray-50 dark:bg-gray-900 p-4 rounded-lg overflow-auto max-h-64 whitespace-pre-wrap text-gray-800 dark:text-gray-200">
              {agent.instruction}
            </pre>
          )}
        </div>
      )}

      {/* Action Groups */}
      {Array.isArray(agent.actionGroups) && agent.actionGroups.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('actionGroups')}</h3>
          <ul className="space-y-1">
            {agent.actionGroups.map(ag => (
              <li key={ag.actionGroupId} className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-400" />
                {ag.actionGroupName}
                {ag.description && <span className="text-gray-400">— {ag.description}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={() => onUseInChat(agent.agentId)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
        >
          {t('useInChat')}
        </button>
        <button
          onClick={onEdit}
          className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 text-sm font-medium"
        >
          {t('editAgent')}
        </button>
        <button
          onClick={onDelete}
          className="px-4 py-2 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/50 text-sm font-medium"
        >
          {t('deleteAgent')}
        </button>
      </div>
    </div>
  );
}
