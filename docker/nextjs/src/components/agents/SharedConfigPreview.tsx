'use client';

import { useTranslations } from 'next-intl';
import type { AgentConfig } from '@/types/enterprise-agent';

interface SharedConfigPreviewProps {
  config: AgentConfig;
  onImport: () => void;
  onCancel: () => void;
}

export function SharedConfigPreview({ config, onImport, onCancel }: SharedConfigPreviewProps) {
  const t = useTranslations('agentDirectory');

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">{t('sharing.preview')}</h4>
      <div className="text-sm space-y-2 bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
        <div><span className="text-gray-500">{t('agentName')}:</span> <span className="font-medium">{config.agentName}</span></div>
        <div><span className="text-gray-500">{t('description')}:</span> {config.description || '—'}</div>
        <div><span className="text-gray-500">{t('model')}:</span> <span className="font-mono text-xs">{config.foundationModel}</span></div>
        {config.actionGroups && config.actionGroups.length > 0 && (
          <div>
            <span className="text-gray-500">{t('actionGroups')}:</span>
            <ul className="ml-4 list-disc text-xs">
              {config.actionGroups.map((ag, i) => <li key={i}>{ag.name}</li>)}
            </ul>
          </div>
        )}
        {config.guardrail && (
          <div><span className="text-gray-500">Guardrail:</span> {config.guardrail.guardrailId} (v{config.guardrail.guardrailVersion})</div>
        )}
        {config.costTags && (config.costTags.department || config.costTags.project) && (
          <div><span className="text-gray-500">Cost Tags:</span> {config.costTags.department} / {config.costTags.project}</div>
        )}
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-400">{t('sharing.importConfirm')}</p>
      <div className="flex gap-3 justify-end">
        <button onClick={onCancel} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">{t('cancel') || 'Cancel'}</button>
        <button onClick={onImport} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
          {t('sharing.import')}
        </button>
      </div>
    </div>
  );
}
