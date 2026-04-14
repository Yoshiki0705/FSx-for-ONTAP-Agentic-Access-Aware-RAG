'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { validateAgentName } from '@/utils/agentCategoryUtils';
import { ActionGroupSelector } from './ActionGroupSelector';
import { GuardrailSettings } from './GuardrailSettings';
import { InferenceProfileSelector } from './InferenceProfileSelector';
import { KBSelector } from './KBSelector';
import { PolicySection } from './PolicySection';
import type { UpdateAgentFormData } from '@/types/agent-directory';
import type { CostTags } from '@/types/enterprise-agent';

interface AgentCreatorProps {
  initialData: UpdateAgentFormData;
  categoryKey: string;
  onCreate: (data: UpdateAgentFormData & {
    selectedActionGroups?: string[];
    selectedKBIds?: string[];
    guardrailId?: string | null;
    guardrailVersion?: string | null;
    inferenceProfileArn?: string | null;
    costTags?: CostTags;
  }) => Promise<void>;
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

  // Enterprise feature state
  const [selectedActionGroups, setSelectedActionGroups] = useState<string[]>([]);
  const [selectedKBIds, setSelectedKBIds] = useState<string[]>([]);
  const [guardrailEnabled, setGuardrailEnabled] = useState(false);
  const [guardrailId, setGuardrailId] = useState<string | null>(null);
  const [guardrailVersion, setGuardrailVersion] = useState<string | null>(null);
  const [inferenceProfileArn, setInferenceProfileArn] = useState<string | null>(null);
  const [costTags, setCostTags] = useState<CostTags>({ department: '', project: '' });
  const [policyText, setPolicyText] = useState('');

  const nameValid = validateAgentName(formData.agentName);

  const handleCreate = async () => {
    if (!nameValid) return;
    setError(null);
    try {
      await onCreate({
        ...formData,
        selectedActionGroups,
        selectedKBIds,
        guardrailId: guardrailEnabled ? guardrailId : null,
        guardrailVersion: guardrailEnabled ? guardrailVersion : null,
        inferenceProfileArn,
        costTags,
      });
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
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg text-sm">{error}</div>
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
        {/* Agent Name */}
        <div>
          <label htmlFor="createAgentName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('agentName')}</label>
          <input id="createAgentName" type="text" value={formData.agentName}
            onChange={e => setFormData(prev => ({ ...prev, agentName: e.target.value }))} disabled={isCreating}
            className={`w-full px-3 py-2 rounded-lg border text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 disabled:opacity-50 ${!nameValid && formData.agentName.length > 0 ? 'border-red-300 dark:border-red-600' : 'border-gray-300 dark:border-gray-600'}`} />
          {!nameValid && formData.agentName.length > 0 && <p className="text-xs text-red-500 mt-1">{t('nameRequired')}</p>}
        </div>

        {/* Description */}
        <div>
          <label htmlFor="createDescription" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('description')}</label>
          <input id="createDescription" type="text" value={formData.description}
            onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))} disabled={isCreating}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 disabled:opacity-50" />
        </div>

        {/* System Prompt */}
        <div>
          <label htmlFor="createInstruction" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('systemPrompt')}</label>
          <textarea id="createInstruction" rows={8} value={formData.instruction}
            onChange={e => setFormData(prev => ({ ...prev, instruction: e.target.value }))} disabled={isCreating}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 resize-y disabled:opacity-50" />
        </div>

        {/* Model */}
        <div>
          <label htmlFor="createModel" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('model')}</label>
          <select id="createModel" value={formData.foundationModel}
            onChange={e => setFormData(prev => ({ ...prev, foundationModel: e.target.value }))} disabled={isCreating}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 disabled:opacity-50">
            {FOUNDATION_MODELS.map(model => <option key={model} value={model}>{model}</option>)}
          </select>
        </div>

        {/* Divider */}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
          {/* Action Group Selector */}
          <ActionGroupSelector
            selectedGroups={selectedActionGroups}
            onSelectionChange={setSelectedActionGroups}
            disabled={isCreating}
          />
        </div>

        {/* Guardrail Settings */}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
          <GuardrailSettings
            enabled={guardrailEnabled}
            guardrailId={guardrailId}
            guardrailVersion={guardrailVersion}
            onEnabledChange={setGuardrailEnabled}
            onGuardrailChange={(id, ver) => { setGuardrailId(id); setGuardrailVersion(ver); }}
            disabled={isCreating}
          />
        </div>

        {/* Policy Section */}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
          <PolicySection
            policyText={policyText}
            onPolicyChange={setPolicyText}
            disabled={isCreating}
          />
        </div>

        {/* Inference Profile + Cost Tags */}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
          <InferenceProfileSelector
            profileArn={inferenceProfileArn}
            costTags={costTags}
            onProfileChange={setInferenceProfileArn}
            onCostTagsChange={setCostTags}
            disabled={isCreating}
          />
        </div>

        {/* Knowledge Base Selector */}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
          <KBSelector
            selectedKBIds={selectedKBIds}
            onChange={setSelectedKBIds}
            disabled={isCreating}
            locale={locale}
          />
        </div>
      </div>

      {/* Buttons */}
      <div className="flex gap-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
        <button onClick={handleCreate} disabled={isCreating || !nameValid}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium">
          {isCreating ? t('creating') : t('createAndDeploy')}
        </button>
        <button onClick={onCancel} disabled={isCreating}
          className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 text-sm font-medium disabled:opacity-50">
          {t('cancel' as any) || 'Cancel'}
        </button>
      </div>
    </div>
  );
}
