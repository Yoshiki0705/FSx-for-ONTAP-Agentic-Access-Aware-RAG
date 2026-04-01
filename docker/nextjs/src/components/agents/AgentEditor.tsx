'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { validateAgentName } from '@/utils/agentCategoryUtils';
import { ActionGroupSelector } from './ActionGroupSelector';
import { GuardrailSettings } from './GuardrailSettings';
import { InferenceProfileSelector } from './InferenceProfileSelector';
import { KBSelector } from './KBSelector';
import { useKnowledgeBases } from '@/hooks/useKnowledgeBases';
import type { AgentDetail, UpdateAgentFormData } from '@/types/agent-directory';
import type { CostTags } from '@/types/enterprise-agent';

interface AgentEditorProps {
  agent: AgentDetail;
  onSave: (data: UpdateAgentFormData & {
    selectedActionGroups?: string[];
    guardrailId?: string | null;
    guardrailVersion?: string | null;
    inferenceProfileArn?: string | null;
    costTags?: CostTags;
  }) => Promise<void>;
  onCancel: () => void;
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

export function AgentEditor({ agent, onSave, onCancel, locale }: AgentEditorProps) {
  const t = useTranslations('agentDirectory');
  const [formData, setFormData] = useState<UpdateAgentFormData>({
    agentName: agent.agentName,
    description: agent.description || '',
    instruction: agent.instruction || '',
    foundationModel: agent.foundationModel || FOUNDATION_MODELS[0],
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Enterprise feature state — pre-populated from agent data
  const [selectedActionGroups, setSelectedActionGroups] = useState<string[]>(
    (agent.actionGroups || []).map(ag => ag.actionGroupName)
  );
  const [guardrailEnabled, setGuardrailEnabled] = useState(false);
  const [guardrailId, setGuardrailId] = useState<string | null>(null);
  const [guardrailVersion, setGuardrailVersion] = useState<string | null>(null);
  const [inferenceProfileArn, setInferenceProfileArn] = useState<string | null>(null);
  const [costTags, setCostTags] = useState<CostTags>({ department: '', project: '' });

  // KB Selector state
  const [selectedKBIds, setSelectedKBIds] = useState<string[]>([]);
  const originalConnectedKBIds = useRef<string[]>([]);
  const { fetchConnectedKBs, connectedKBIds } = useKnowledgeBases();

  // On mount: fetch currently connected KBs for this agent
  useEffect(() => {
    fetchConnectedKBs(agent.agentId).then(() => {
      // connectedKBIds will be updated by the hook
    });
  }, [agent.agentId, fetchConnectedKBs]);

  // When connectedKBIds are loaded, set them as initial selection
  useEffect(() => {
    if (connectedKBIds.length > 0 || originalConnectedKBIds.current.length === 0) {
      setSelectedKBIds(connectedKBIds);
      originalConnectedKBIds.current = connectedKBIds;
    }
  }, [connectedKBIds]);

  const nameValid = validateAgentName(formData.agentName);

  const handleSave = async () => {
    if (!nameValid) return;
    setSaving(true);
    setError(null);
    try {
      // Save agent form data first
      await onSave({
        ...formData,
        selectedActionGroups,
        guardrailId: guardrailEnabled ? guardrailId : null,
        guardrailVersion: guardrailEnabled ? guardrailVersion : null,
        inferenceProfileArn,
        costTags,
      });

      // Compute KB diff: added and removed
      const original = originalConnectedKBIds.current;
      const addedKBs = selectedKBIds.filter((id) => !original.includes(id));
      const removedKBs = original.filter((id) => !selectedKBIds.includes(id));

      // Associate added KBs
      for (const kbId of addedKBs) {
        const res = await fetch('/api/bedrock/agent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'associateKnowledgeBase',
            agentId: agent.agentId,
            agentVersion: 'DRAFT',
            knowledgeBaseId: kbId,
          }),
        });
        const data = await res.json();
        if (!data.success) {
          throw new Error(data.error || `Failed to associate KB ${kbId}`);
        }
      }

      // Disassociate removed KBs
      for (const kbId of removedKBs) {
        const res = await fetch('/api/bedrock/agent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'disassociateKnowledgeBase',
            agentId: agent.agentId,
            agentVersion: 'DRAFT',
            knowledgeBaseId: kbId,
          }),
        });
        const data = await res.json();
        if (!data.success) {
          throw new Error(data.error || `Failed to disassociate KB ${kbId}`);
        }
      }

      // Update the original ref after successful save
      originalConnectedKBIds.current = [...selectedKBIds];
    } catch (err: any) {
      setError(err?.message || t('saveError'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">{t('editAgent')}</h2>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg text-sm">{error}</div>
      )}

      <div className="space-y-4">
        {/* Agent Name */}
        <div>
          <label htmlFor="agentName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('agentName')}</label>
          <input id="agentName" type="text" value={formData.agentName}
            onChange={e => setFormData(prev => ({ ...prev, agentName: e.target.value }))} disabled={saving}
            className={`w-full px-3 py-2 rounded-lg border text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 disabled:opacity-50 ${!nameValid && formData.agentName.length > 0 ? 'border-red-300 dark:border-red-600' : 'border-gray-300 dark:border-gray-600'}`} />
          {!nameValid && formData.agentName.length > 0 && <p className="text-xs text-red-500 mt-1">{t('nameRequired')}</p>}
        </div>

        {/* Description */}
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('description')}</label>
          <input id="description" type="text" value={formData.description}
            onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))} disabled={saving}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 disabled:opacity-50" />
        </div>

        {/* Instruction */}
        <div>
          <label htmlFor="instruction" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('systemPrompt')}</label>
          <textarea id="instruction" rows={6} value={formData.instruction}
            onChange={e => setFormData(prev => ({ ...prev, instruction: e.target.value }))} disabled={saving}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 resize-y disabled:opacity-50" />
        </div>

        {/* Foundation Model */}
        <div>
          <label htmlFor="foundationModel" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('model')}</label>
          <select id="foundationModel" value={formData.foundationModel}
            onChange={e => setFormData(prev => ({ ...prev, foundationModel: e.target.value }))} disabled={saving}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 disabled:opacity-50">
            {FOUNDATION_MODELS.map(model => <option key={model} value={model}>{model}</option>)}
          </select>
        </div>

        {/* Action Group Selector */}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
          <ActionGroupSelector
            agentId={agent.agentId}
            selectedGroups={selectedActionGroups}
            onSelectionChange={setSelectedActionGroups}
            disabled={saving}
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
            disabled={saving}
          />
        </div>

        {/* Inference Profile + Cost Tags */}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
          <InferenceProfileSelector
            profileArn={inferenceProfileArn}
            costTags={costTags}
            onProfileChange={setInferenceProfileArn}
            onCostTagsChange={setCostTags}
            disabled={saving}
          />
        </div>

        {/* Knowledge Base Selector */}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
          <KBSelector
            selectedKBIds={selectedKBIds}
            connectedKBIds={originalConnectedKBIds.current}
            onChange={setSelectedKBIds}
            disabled={saving}
            locale={locale}
          />
        </div>
      </div>

      {/* Buttons */}
      <div className="flex gap-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
        <button onClick={handleSave} disabled={saving || !nameValid}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium">
          {saving ? t('saving') : t('save' as any) || 'Save'}
        </button>
        <button onClick={onCancel} disabled={saving}
          className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 text-sm font-medium disabled:opacity-50">
          {t('cancel' as any) || 'Cancel'}
        </button>
      </div>
    </div>
  );
}
