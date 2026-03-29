'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { validateAgentName } from '@/utils/agentCategoryUtils';
import type { UpdateAgentFormData } from '@/types/agent-directory';

interface AgentCreatorProps {
  initialData: UpdateAgentFormData;
  categoryKey: string;
  onCreate: (data: UpdateAgentFormData) => Promise<void>;
  onCancel: () => void;
  isCreating: boolean;
  progressMessage?: string;
  locale: string;
}

const FOUNDATION_MODELS = [
  'anthropic.claude-3-haiku-20240307-v1:0',
  'anthropic.claude-3-sonnet-20240229-v1:0',
  'anthropic.claude-3-5-sonnet-20241022-v2:0',
  'anthropic.claude-3-5-haiku-20241022-v1:0',
  'amazon.nova-pro-v1:0',
  'amazon.nova-lite-v1:0',
  'amazon.nova-micro-v1:0',
];

export function AgentCreator({ initialData, categoryKey, onCreate, onCancel, isCreating, progressMessage, locale }: AgentCreatorProps) {
  const t = useTranslations('agentDirectory');
  const [formData, setFormData] = useState<UpdateAgentFormData>(initialData);
  const [error, setError] = useState<string | null>(null);

  const nameValid = validateAgentName(formData.agentName);

  const handleCreate = async () => {
    if (!nameValid) return;
    setError(null);
    try {
      await onCreate(formData);
    } catch (err: any) {
      setError(err?.message || t('createError'));
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">{t('createAgent')}</h2>
        <span className="px-2 py-0.5 rounded text-xs bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300">
          {categoryKey}
        </span>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg text-sm">
          {error}
        </div>
      )}

      {isCreating && progressMessage && (
        <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg text-sm flex items-center gap-2">
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          {progressMessage}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label htmlFor="createAgentName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('agentName')}
          </label>
          <input
            id="createAgentName"
            type="text"
            value={formData.agentName}
            onChange={e => setFormData(prev => ({ ...prev, agentName: e.target.value }))}
            disabled={isCreating}
            className={`w-full px-3 py-2 rounded-lg border text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 disabled:opacity-50 ${
              !nameValid && formData.agentName.length > 0 ? 'border-red-300 dark:border-red-600' : 'border-gray-300 dark:border-gray-600'
            }`}
          />
          {!nameValid && formData.agentName.length > 0 && (
            <p className="text-xs text-red-500 mt-1">{t('nameRequired')}</p>
          )}
        </div>

        <div>
          <label htmlFor="createDescription" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('description')}
          </label>
          <input
            id="createDescription"
            type="text"
            value={formData.description}
            onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
            disabled={isCreating}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 disabled:opacity-50"
          />
        </div>

        <div>
          <label htmlFor="createInstruction" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('systemPrompt')}
          </label>
          <textarea
            id="createInstruction"
            rows={8}
            value={formData.instruction}
            onChange={e => setFormData(prev => ({ ...prev, instruction: e.target.value }))}
            disabled={isCreating}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 resize-y disabled:opacity-50"
          />
        </div>

        <div>
          <label htmlFor="createModel" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('model')}
          </label>
          <select
            id="createModel"
            value={formData.foundationModel}
            onChange={e => setFormData(prev => ({ ...prev, foundationModel: e.target.value }))}
            disabled={isCreating}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 disabled:opacity-50"
          >
            {FOUNDATION_MODELS.map(model => (
              <option key={model} value={model}>{model}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex gap-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={handleCreate}
          disabled={isCreating || !nameValid}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
        >
          {isCreating ? t('creating') : t('createAndDeploy')}
        </button>
        <button
          onClick={onCancel}
          disabled={isCreating}
          className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 text-sm font-medium disabled:opacity-50"
        >
          {t('cancel' as any) || 'Cancel'}
        </button>
      </div>
    </div>
  );
}
