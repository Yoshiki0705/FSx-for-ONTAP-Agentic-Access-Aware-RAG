'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import type { InferenceProfileSummary, CostTags } from '@/types/enterprise-agent';

interface InferenceProfileSelectorProps {
  profileArn: string | null;
  costTags: CostTags;
  onProfileChange: (arn: string | null) => void;
  onCostTagsChange: (tags: CostTags) => void;
  disabled?: boolean;
}

export function InferenceProfileSelector({ profileArn, costTags, onProfileChange, onCostTagsChange, disabled }: InferenceProfileSelectorProps) {
  const t = useTranslations('agentDirectory');
  const [profiles, setProfiles] = useState<InferenceProfileSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfiles = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/bedrock/agent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'listInferenceProfiles' }),
        });
        const data = await res.json();
        if (data.success) {
          setProfiles(data.inferenceProfiles || []);
        } else {
          setError(data.error || t('inferenceProfile.loadError'));
        }
      } catch {
        setError(t('inferenceProfile.loadError'));
      } finally {
        setIsLoading(false);
      }
    };
    fetchProfiles();
  }, []);

  return (
    <div>
      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('inferenceProfile.title')}</h3>

      {/* Inference Profile Selector */}
      {isLoading ? (
        <div className="h-10 bg-gray-100 dark:bg-gray-800 rounded animate-pulse mb-3" />
      ) : error ? (
        <p className="text-xs text-red-500 mb-3">{error}</p>
      ) : (
        <select
          value={profileArn || ''}
          onChange={e => onProfileChange(e.target.value || null)}
          disabled={disabled}
          className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 disabled:opacity-50 mb-3"
        >
          <option value="">{t('inferenceProfile.selectProfile')}</option>
          {profiles.map(p => (
            <option key={p.inferenceProfileArn} value={p.inferenceProfileArn}>
              {p.inferenceProfileName} ({p.status})
            </option>
          ))}
        </select>
      )}

      {/* Cost Tags */}
      <h4 className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">{t('inferenceProfile.costTags')}</h4>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="costDepartment" className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
            {t('inferenceProfile.department')}
          </label>
          <input
            id="costDepartment"
            type="text"
            value={costTags.department}
            onChange={e => onCostTagsChange({ ...costTags, department: e.target.value })}
            disabled={disabled}
            className="w-full px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 text-xs bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 disabled:opacity-50"
          />
        </div>
        <div>
          <label htmlFor="costProject" className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
            {t('inferenceProfile.project')}
          </label>
          <input
            id="costProject"
            type="text"
            value={costTags.project}
            onChange={e => onCostTagsChange({ ...costTags, project: e.target.value })}
            disabled={disabled}
            className="w-full px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 text-xs bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 disabled:opacity-50"
          />
        </div>
      </div>
    </div>
  );
}
