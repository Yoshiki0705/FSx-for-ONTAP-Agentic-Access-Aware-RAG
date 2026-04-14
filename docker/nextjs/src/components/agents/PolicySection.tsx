'use client';

import { useTranslations } from 'next-intl';
import { PolicyTemplateSelector } from './PolicyTemplateSelector';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';

const MAX_POLICY_LENGTH = 2000;

export interface PolicySectionProps {
  policyText: string;
  onPolicyChange: (text: string) => void;
  disabled?: boolean;
}

export function PolicySection({ policyText, onPolicyChange, disabled }: PolicySectionProps) {
  const t = useTranslations('agentDirectory.policy');
  const { agentPolicyEnabled } = useFeatureFlags();
  const isPolicyEnabled = agentPolicyEnabled;

  if (!isPolicyEnabled) return null;

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    if (value.length <= MAX_POLICY_LENGTH) {
      onPolicyChange(value);
    }
  };

  return (
    <div>
      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        {t('sectionTitle')}
      </h3>

      <div className="space-y-3">
        <PolicyTemplateSelector
          onSelect={(text) => onPolicyChange(text)}
          disabled={disabled}
        />

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('inputLabel')}
          </label>
          <textarea
            rows={4}
            value={policyText}
            onChange={handleTextChange}
            placeholder={t('inputPlaceholder')}
            disabled={disabled}
            maxLength={MAX_POLICY_LENGTH}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 resize-y disabled:opacity-50"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-right">
            {t('charCount', { count: policyText.length })}
          </p>
        </div>
      </div>
    </div>
  );
}
